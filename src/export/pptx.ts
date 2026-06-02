/**
 * PPTX Export - embeds QA screenshots as full-slide PowerPoint images.
 *
 * This is the stable PPTX MVP path: it preserves the visual result exactly,
 * while editable-object export can be layered on later via SVG/DrawingML.
 */

import PptxGenJS from "pptxgenjs";
import { existsSync } from "node:fs";

export interface PptxExportOptions {
  screenshotPaths: string[];
  outputPath: string;
}

export interface PptxExportResult {
  success: boolean;
  path: string;
  error?: string;
}

const SLIDE_W_IN = 13.333333;
const SLIDE_H_IN = 7.5;

export async function exportPptx(options: PptxExportOptions): Promise<PptxExportResult> {
  const { screenshotPaths, outputPath } = options;

  try {
    const images = screenshotPaths.filter((path) => existsSync(path));
    if (images.length === 0) {
      return { success: false, path: outputPath, error: "No screenshots available for PPTX export." };
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
    return { success: true, path: outputPath };
  } catch (err) {
    return { success: false, path: outputPath, error: String(err) };
  }
}
