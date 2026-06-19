/**
 * PPTX Export - exports via the editable gen-pptx CLI when available, with a
 * stable screenshot-embedding fallback.
 *
 * This is the stable PPTX MVP path: it preserves the visual result exactly,
 * while editable-object export can be layered on later via SVG/DrawingML.
 */

import PptxGenJS from "pptxgenjs";
import { execFile } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";

export interface PptxExportOptions {
  screenshotPaths?: string[];
  outputPath?: string;
  previewUrl?: string;
  outputDir?: string;
  filename?: string;
  totalPages?: number;
  mode?: "editable" | "screenshots";
  width?: number;
  height?: number;
}

export interface PptxExportResult {
  success: boolean;
  path?: string;
  flags?: string[];
  mode?: "editable" | "screenshots";
  error?: string;
}

const exec = promisify(execFile);
const SKILL_DIR = resolve(process.cwd(), ".agents/skills/baoyu-design");
const GEN_PPTX_CLI = join(SKILL_DIR, "agents/gen-pptx/dist/cli.mjs");
const SLIDE_W_IN = 13.333333;
const SLIDE_H_IN = 7.5;

export function isEditablePptxExportAvailable(): boolean {
  return existsSync(GEN_PPTX_CLI);
}

export function isPptxExportAvailable(): boolean {
  return true;
}

export async function exportPptx(options: PptxExportOptions): Promise<PptxExportResult> {
  if (options.previewUrl && options.outputDir && options.mode !== "screenshots" && isEditablePptxExportAvailable()) {
    const editable = await exportEditablePptx(options);
    if (editable.success || options.mode === "editable") {
      return editable;
    }
  }

  const outputPath = options.outputPath || join(options.outputDir || process.cwd(), `${options.filename || "deck"}.pptx`);
  const screenshotPaths = options.screenshotPaths || discoverScreenshots(options.outputDir);

  try {
    const images = screenshotPaths.filter((path) => existsSync(path));
    if (images.length === 0) {
      return { success: false, path: outputPath, mode: "screenshots", error: "No screenshots available for PPTX export." };
    }

    const pptx = new PptxGenJS();
    pptx.layout = "LAYOUT_WIDE";
    pptx.author = "SlidePilot";
    pptx.subject = "SlidePilot generated presentation";
    pptx.title = "SlidePilot Deck";
    pptx.company = "SlidePilot";
    pptx.theme = {
      headFontFace: "Microsoft YaHei",
      bodyFontFace: "Microsoft YaHei",
    };

    for (const imagePath of images) {
      const slide = pptx.addSlide();
      slide.background = { color: "FFFFFF" };
      slide.addImage({
        path: imagePath,
        x: 0,
        y: 0,
        w: SLIDE_W_IN,
        h: SLIDE_H_IN,
      });
    }

    await pptx.writeFile({ fileName: outputPath });
    return { success: true, path: outputPath, mode: "screenshots" };
  } catch (err) {
    return { success: false, path: outputPath, mode: "screenshots", error: String(err) };
  }
}

async function exportEditablePptx(options: PptxExportOptions): Promise<PptxExportResult> {
  const {
    previewUrl,
    outputDir = dirname(options.outputPath || ""),
    filename = "deck",
    totalPages = Math.max(1, options.screenshotPaths?.length || 1),
    width = 1280,
    height = 720,
  } = options;

  if (!previewUrl || !outputDir) {
    return { success: false, mode: "editable", error: "Missing previewUrl or outputDir for editable PPTX export." };
  }

  const slides = Array.from({ length: totalPages }, (_, i) => ({
    showJs: `document.querySelectorAll('.slide').forEach(s=>s.classList.remove('active'));const sl=document.querySelectorAll('.slide')[${i}];if(sl)sl.classList.add('active')`,
    selector: ".slide.active",
  }));
  const configPath = join(outputDir, "pptx-config.json");
  writeFileSync(configPath, JSON.stringify({
    width,
    height,
    slides,
    hideSelectors: [".page-number"],
    filename,
  }, null, 2), "utf-8");

  try {
    const { stdout } = await exec("node", [GEN_PPTX_CLI, "--url", previewUrl, "--config", configPath, "--out", outputDir], {
      timeout: 120_000,
      env: { ...process.env },
    });
    const pptxPath = join(outputDir, `${filename}.pptx`);
    if (!existsSync(pptxPath)) {
      return { success: false, mode: "editable", error: "PPTX file not created." };
    }

    let flags: string[] = [];
    try {
      flags = JSON.parse(stdout).flags || [];
    } catch {}
    return { success: true, path: pptxPath, flags, mode: "editable" };
  } catch (err) {
    return { success: false, mode: "editable", error: String(err) };
  }
}

function discoverScreenshots(outputDir?: string): string[] {
  if (!outputDir) return [];
  return Array.from({ length: 60 }, (_, i) => join(outputDir, "png", `slide-${String(i + 1).padStart(2, "0")}.png`))
    .filter((path) => existsSync(path));
}
