/**
 * Browser QA — Playwright-based visual quality checks per page.
 *
 * Checks (inspired by ppt-agent-skills visual_qa.py):
 * 1. DIM — Viewport is 1280x720
 * 2. BLANK — No excessive blank/empty area (>60% single color)
 * 3. OVERFLOW — Content doesn't overflow the 1280x720 boundary
 * 4. TEXT — Minimum text content present
 * 5. CONSOLE — No JS errors
 * 6. SCREENSHOT — Capture PNG for each page
 */

import { chromium, type Browser } from "playwright";
import { join } from "node:path";
import { mkdirSync, existsSync, readFileSync, statSync } from "node:fs";
import { PNG } from "pngjs";
import type { QACheck, QAResult } from "../schemas.js";

export interface QAOptions {
  pagePaths: string[];
  screenshotDir: string;
}

export async function runBrowserQA(options: QAOptions): Promise<QAResult> {
  const { pagePaths, screenshotDir } = options;
  const checks: QACheck[] = [];
  const screenshots: string[] = [];

  if (!existsSync(screenshotDir)) {
    mkdirSync(screenshotDir, { recursive: true });
  }

  let browser: Browser | null = null;

  try {
    browser = await chromium.launch();
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    });

    for (let i = 0; i < pagePaths.length; i++) {
      const pageIndex = i + 1;
      const htmlPath = pagePaths[i];
      const page = await context.newPage();

      const consoleErrors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(msg.text());
      });

      // Load page
      const response = await page.goto(`file://${htmlPath}`, { waitUntil: "networkidle" });
      if (!response || !response.ok()) {
        checks.push({ id: "LOAD", name: "page_loads", status: "fail", message: `HTTP ${response?.status() ?? "none"}`, pageIndex });
        await page.close();
        continue;
      }

      // DIM check — verify body is 1280x720
      const dims = await page.evaluate(() => {
        const body = document.body;
        return { w: body.scrollWidth, h: body.scrollHeight };
      });
      if (dims.w > 1300 || dims.h > 740) {
        checks.push({ id: "DIM", name: "dimensions", status: "warn", message: `body ${dims.w}x${dims.h} exceeds 1280x720`, pageIndex });
      }

      // OVERFLOW check — any element overflows viewport
      const overflow = await page.evaluate(() => {
        const els = document.querySelectorAll("h1,h2,h3,p,ul,ol,div.card,.metric-value");
        for (const el of els) {
          const r = el.getBoundingClientRect();
          if (r.bottom > 720 || r.right > 1280) return { el: el.tagName, bottom: r.bottom, right: r.right };
        }
        return null;
      });
      if (overflow) {
        checks.push({ id: "OVERFLOW", name: "overflow", status: "fail", message: `${overflow.el} exceeds bounds (bottom:${Math.round(overflow.bottom)}, right:${Math.round(overflow.right)})`, pageIndex });
      }

      const unsafeBounds = await page.evaluate(() => {
        const els = [...document.querySelectorAll("h1,h2,h3,p,ul,ol,li,.card,.metric-value,.metric-label")];
        for (const el of els) {
          const r = el.getBoundingClientRect();
          const text = (el.textContent || "").trim();
          if (!text) continue;
          if (r.top < 8 || r.left < 8 || r.bottom > 704 || r.right > 1272) {
            return {
              el: el.tagName,
              top: r.top,
              left: r.left,
              bottom: r.bottom,
              right: r.right,
              text: text.slice(0, 40),
            };
          }
        }
        return null;
      });
      if (unsafeBounds) {
        checks.push({
          id: "SAFE-AREA",
          name: "safe_area",
          status: "fail",
          message: `${unsafeBounds.el} is outside safe area (top:${Math.round(unsafeBounds.top)}, left:${Math.round(unsafeBounds.left)}, bottom:${Math.round(unsafeBounds.bottom)}, right:${Math.round(unsafeBounds.right)}): ${unsafeBounds.text}`,
          pageIndex,
        });
      }

      const overlap = await page.evaluate(() => {
        const candidates = [...document.querySelectorAll("h1,h2,h3,p,ul,ol,li,.card,.metric-value,.metric-label")]
          .map((el, index) => {
            const r = el.getBoundingClientRect();
            const text = (el.textContent || "").replace(/\s+/g, " ").trim();
            return {
              index,
              tag: el.tagName,
              text,
              r: { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height },
            };
          })
          .filter((item) => item.text && item.r.width > 8 && item.r.height > 8);

        function area(r: any) {
          return Math.max(0, r.right - r.left) * Math.max(0, r.bottom - r.top);
        }
        function intersect(a: any, b: any) {
          const left = Math.max(a.left, b.left);
          const right = Math.min(a.right, b.right);
          const top = Math.max(a.top, b.top);
          const bottom = Math.min(a.bottom, b.bottom);
          return { left, right, top, bottom };
        }
        function contains(a: any, b: any) {
          return a.left <= b.left + 1 && a.top <= b.top + 1 && a.right >= b.right - 1 && a.bottom >= b.bottom - 1;
        }

        for (let i = 0; i < candidates.length; i++) {
          for (let j = i + 1; j < candidates.length; j++) {
            const a = candidates[i];
            const b = candidates[j];
            if (contains(a.r, b.r) || contains(b.r, a.r)) continue;

            const inter = intersect(a.r, b.r);
            const interArea = area(inter);
            if (interArea <= 80) continue;

            const ratio = interArea / Math.min(area(a.r), area(b.r));
            if (ratio > 0.18) {
              return {
                a: `${a.tag}: ${a.text.slice(0, 32)}`,
                b: `${b.tag}: ${b.text.slice(0, 32)}`,
                ratio,
              };
            }
          }
        }
        return null;
      });
      if (overlap) {
        checks.push({
          id: "OVERLAP",
          name: "element_overlap",
          status: "fail",
          message: `${overlap.a} overlaps ${overlap.b} (${Math.round(overlap.ratio * 100)}%)`,
          pageIndex,
        });
      }

      // TEXT check — minimum text content
      const textLen = await page.evaluate(() => (document.body.textContent || "").trim().length);
      if (textLen < 5) {
        checks.push({ id: "BLANK-TEXT", name: "blank_page", status: "fail", message: `Only ${textLen} chars of text`, pageIndex });
      }

      // BLANK check — screenshot pixel analysis (dominant color ratio)
      const ssPath = join(screenshotDir, `slide-${String(pageIndex).padStart(2, "0")}.png`);
      await page.screenshot({ path: ssPath, clip: { x: 0, y: 0, width: 1280, height: 720 } });
      screenshots.push(ssPath);
      checks.push(...analyzeScreenshot(ssPath, pageIndex));

      // Console errors
      if (consoleErrors.length > 0) {
        checks.push({ id: "CONSOLE", name: "console_error", status: "warn", message: consoleErrors.slice(0, 3).join("; "), pageIndex });
      }

      await page.close();
    }
  } catch (err) {
    checks.push({ id: "RUNTIME", name: "runtime_error", status: "fail", message: String(err) });
  } finally {
    if (browser) await browser.close();
  }

  const failCount = checks.filter((c) => c.status === "fail").length;
  const warnCount = checks.filter((c) => c.status === "warn").length;
  const totalChecks = pagePaths.length * 9;
  const score = totalChecks > 0 ? Math.round(((totalChecks - failCount - warnCount * 0.5) / totalChecks) * 100) / 100 : 1;

  return {
    passed: failCount === 0,
    score: Math.max(0, score),
    checks,
    screenshots,
  };
}

interface PixelImage {
  width: number;
  height: number;
  data: Buffer;
}

interface RGB {
  r: number;
  g: number;
  b: number;
}

function analyzeScreenshot(screenshotPath: string, pageIndex: number): QACheck[] {
  const checks: QACheck[] = [];

  try {
    const size = statSync(screenshotPath).size;
    if (size < 8_000) {
      checks.push({
        id: "PNG-SIZE",
        name: "screenshot_file_size",
        status: "fail",
        message: `Screenshot is too small (${size} bytes).`,
        pageIndex,
      });
    } else if (size < 24_000) {
      checks.push({
        id: "PNG-SIZE",
        name: "screenshot_file_size",
        status: "warn",
        message: `Screenshot is unusually small (${size} bytes).`,
        pageIndex,
      });
    }

    const image = PNG.sync.read(readFileSync(screenshotPath)) as PixelImage;
    if (image.width !== 1280 || image.height !== 720) {
      checks.push({
        id: "PIXEL-DIM",
        name: "screenshot_dimensions",
        status: "fail",
        message: `Screenshot is ${image.width}x${image.height}, expected 1280x720.`,
        pageIndex,
      });
    }

    const dominant = dominantColor(image);
    checks.push(...blankAreaChecks(image, dominant, pageIndex));
    checks.push(...edgeCutoffChecks(image, dominant, pageIndex));
    checks.push(...contrastChecks(image, dominant, pageIndex));
    checks.push(...verticalTextChecks(image, dominant, pageIndex));
  } catch (err) {
    checks.push({
      id: "PIXEL",
      name: "pixel_analysis",
      status: "warn",
      message: `Unable to analyze screenshot pixels: ${String(err).slice(0, 160)}`,
      pageIndex,
    });
  }

  return checks;
}

function blankAreaChecks(image: PixelImage, background: RGB, pageIndex: number): QACheck[] {
  let samples = 0;
  let backgroundLike = 0;
  let transparent = 0;

  samplePixels(image, 6, (x, y, offset) => {
    samples++;
    if (image.data[offset + 3] < 12) transparent++;
    if (distance(colorAt(image, offset), background) < 26) backgroundLike++;
  });

  const blankRatio = (backgroundLike + transparent) / Math.max(1, samples);
  if (blankRatio > 0.94) {
    return [{
      id: "BLANK-PIXEL",
      name: "blank_ratio",
      status: "fail",
      message: `Screenshot is almost entirely one background color (${percent(blankRatio)} blank-like pixels).`,
      pageIndex,
    }];
  }

  if (blankRatio > 0.86) {
    return [{
      id: "BLANK-PIXEL",
      name: "blank_ratio",
      status: "warn",
      message: `Screenshot has a high blank-like area ratio (${percent(blankRatio)}).`,
      pageIndex,
    }];
  }

  return [];
}

function edgeCutoffChecks(image: PixelImage, background: RGB, pageIndex: number): QACheck[] {
  const edge = 8;
  const edgeStats = [
    ["top", foregroundRatioInRect(image, background, 0, 0, image.width, edge)],
    ["right", foregroundRatioInRect(image, background, image.width - edge, 0, edge, image.height)],
    ["bottom", foregroundRatioInRect(image, background, 0, image.height - edge, image.width, edge)],
    ["left", foregroundRatioInRect(image, background, 0, 0, edge, image.height)],
  ] as const;

  const suspicious = edgeStats.filter(([, ratio]) => ratio > 0.1);
  if (suspicious.length === 0) return [];

  return [{
    id: "EDGE-CUT",
    name: "edge_cutoff",
    status: "warn",
    message: `Possible clipped content at ${suspicious.map(([edgeName, ratio]) => `${edgeName} ${percent(ratio)}`).join(", ")}.`,
    pageIndex,
  }];
}

function contrastChecks(image: PixelImage, background: RGB, pageIndex: number): QACheck[] {
  const cellsX = 8;
  const cellsY = 5;
  let contentCells = 0;
  let lowContrastCells = 0;

  for (let gy = 0; gy < cellsY; gy++) {
    for (let gx = 0; gx < cellsX; gx++) {
      const cell = measureCell(
        image,
        background,
        Math.round((gx * image.width) / cellsX),
        Math.round((gy * image.height) / cellsY),
        Math.round(image.width / cellsX),
        Math.round(image.height / cellsY),
      );

      if (cell.foregroundRatio < 0.04) continue;
      contentCells++;
      if (cell.brightnessRange < 42 && cell.avgForegroundContrast < 54) {
        lowContrastCells++;
      }
    }
  }

  if (contentCells >= 3 && lowContrastCells / contentCells > 0.65) {
    return [{
      id: "LOW-CONTRAST",
      name: "low_contrast",
      status: "warn",
      message: `Many content regions have weak luminance separation (${lowContrastCells}/${contentCells} cells).`,
      pageIndex,
    }];
  }

  return [];
}

function verticalTextChecks(image: PixelImage, background: RGB, pageIndex: number): QACheck[] {
  const binWidth = 16;
  const bins = Math.ceil(image.width / binWidth);
  const foregroundByColumn = new Array<number>(bins).fill(0);
  const samplesByColumn = new Array<number>(bins).fill(0);

  samplePixels(image, 6, (x, y, offset) => {
    const bin = Math.floor(x / binWidth);
    samplesByColumn[bin]++;
    if (isForeground(image, background, offset)) {
      foregroundByColumn[bin]++;
    }
  });

  let narrowTallRuns = 0;
  for (let i = 0; i < bins; i++) {
    const ratio = foregroundByColumn[i] / Math.max(1, samplesByColumn[i]);
    if (ratio <= 0.16) continue;

    const runStart = i;
    while (i + 1 < bins && foregroundByColumn[i + 1] / Math.max(1, samplesByColumn[i + 1]) > 0.16) {
      i++;
    }
    const runWidth = (i - runStart + 1) * binWidth;
    if (runWidth <= 64) narrowTallRuns++;
  }

  if (narrowTallRuns >= 3) {
    return [{
      id: "VERTICAL-TEXT",
      name: "suspected_vertical_text",
      status: "warn",
      message: `Detected ${narrowTallRuns} narrow vertical foreground bands; text may be stacked or rotated.`,
      pageIndex,
    }];
  }

  return [];
}

function dominantColor(image: PixelImage): RGB {
  const counts = new Map<string, { count: number; color: RGB }>();

  samplePixels(image, 8, (x, y, offset) => {
    if (image.data[offset + 3] < 12) return;
    const rgb = colorAt(image, offset);
    const quantized = {
      r: Math.round(rgb.r / 16) * 16,
      g: Math.round(rgb.g / 16) * 16,
      b: Math.round(rgb.b / 16) * 16,
    };
    const key = `${quantized.r},${quantized.g},${quantized.b}`;
    const item = counts.get(key) || { count: 0, color: quantized };
    item.count++;
    counts.set(key, item);
  });

  let best = { count: -1, color: { r: 255, g: 255, b: 255 } };
  for (const item of counts.values()) {
    if (item.count > best.count) best = item;
  }
  return best.color;
}

function foregroundRatioInRect(image: PixelImage, background: RGB, x: number, y: number, w: number, h: number): number {
  let foreground = 0;
  let samples = 0;

  for (let yy = y; yy < Math.min(image.height, y + h); yy += 2) {
    for (let xx = x; xx < Math.min(image.width, x + w); xx += 2) {
      samples++;
      const offset = offsetAt(image, xx, yy);
      if (isForeground(image, background, offset)) foreground++;
    }
  }

  return foreground / Math.max(1, samples);
}

function measureCell(image: PixelImage, background: RGB, x: number, y: number, w: number, h: number) {
  let minBrightness = 255;
  let maxBrightness = 0;
  let foreground = 0;
  let samples = 0;
  let totalForegroundContrast = 0;
  const bgBrightness = brightness(background);

  for (let yy = y; yy < Math.min(image.height, y + h); yy += 8) {
    for (let xx = x; xx < Math.min(image.width, x + w); xx += 8) {
      samples++;
      const offset = offsetAt(image, xx, yy);
      const rgb = colorAt(image, offset);
      const lum = brightness(rgb);
      minBrightness = Math.min(minBrightness, lum);
      maxBrightness = Math.max(maxBrightness, lum);
      if (isForeground(image, background, offset)) {
        foreground++;
        totalForegroundContrast += Math.abs(lum - bgBrightness);
      }
    }
  }

  return {
    foregroundRatio: foreground / Math.max(1, samples),
    brightnessRange: maxBrightness - minBrightness,
    avgForegroundContrast: foreground > 0 ? totalForegroundContrast / foreground : 255,
  };
}

function samplePixels(image: PixelImage, step: number, visit: (x: number, y: number, offset: number) => void): void {
  for (let y = 0; y < image.height; y += step) {
    for (let x = 0; x < image.width; x += step) {
      visit(x, y, offsetAt(image, x, y));
    }
  }
}

function isForeground(image: PixelImage, background: RGB, offset: number): boolean {
  if (image.data[offset + 3] < 12) return false;
  return distance(colorAt(image, offset), background) > 38;
}

function offsetAt(image: PixelImage, x: number, y: number): number {
  return (image.width * y + x) * 4;
}

function colorAt(image: PixelImage, offset: number): RGB {
  return {
    r: image.data[offset],
    g: image.data[offset + 1],
    b: image.data[offset + 2],
  };
}

function brightness(color: RGB): number {
  return color.r * 0.299 + color.g * 0.587 + color.b * 0.114;
}

function distance(a: RGB, b: RGB): number {
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}
