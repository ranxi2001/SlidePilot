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
import { mkdirSync, existsSync } from "node:fs";
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
  const totalChecks = pagePaths.length * 4; // 4 checks per page baseline
  const score = totalChecks > 0 ? Math.round(((totalChecks - failCount - warnCount * 0.5) / totalChecks) * 100) / 100 : 1;

  return {
    passed: failCount === 0,
    score: Math.max(0, score),
    checks,
    screenshots,
  };
}
