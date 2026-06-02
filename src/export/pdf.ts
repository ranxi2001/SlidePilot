/**
 * PDF Export — renders each per-page HTML individually and merges into one PDF.
 * Each page is 1280x720, exported as a landscape PDF page.
 */

import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface PdfExportOptions {
  pagePaths: string[];
  outputPath: string;
}

export async function exportPdf(options: PdfExportOptions): Promise<{ success: boolean; path: string; error?: string }>;
export async function exportPdf(options: { htmlPath: string; outputPath: string }): Promise<{ success: boolean; path: string; error?: string }>;
export async function exportPdf(options: any): Promise<{ success: boolean; path: string; error?: string }> {
  // Handle legacy single-file API
  if (options.htmlPath && !options.pagePaths) {
    return exportFromPreview(options.htmlPath, options.outputPath);
  }
  return exportFromPages(options.pagePaths, options.outputPath);
}

async function exportFromPages(pagePaths: string[], outputPath: string): Promise<{ success: boolean; path: string; error?: string }> {
  let browser;
  try {
    browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();

    // Generate a combined HTML where all pages are visible for print
    const pagesHtml = pagePaths.map((p) => {
      const content = readFileSync(p, "utf-8");
      const bodyMatch = content.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      const styleMatch = content.match(/<style>([\s\S]*?)<\/style>/);
      return { body: bodyMatch?.[1] || "", style: styleMatch?.[1] || "" };
    });

    const globalStyle = pagesHtml[0]?.style || "";
    const printHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
${globalStyle}
@page { size: 1280px 720px; margin: 0; }
body { width: 1280px; margin: 0; padding: 0; }
.print-page {
  width: 1280px;
  height: 720px;
  overflow: hidden;
  page-break-after: always;
  position: relative;
}
.print-page:last-child { page-break-after: auto; }
</style>
</head>
<body>
${pagesHtml.map((p) => `<div class="print-page">${p.body}</div>`).join("\n")}
</body>
</html>`;

    const tmpPath = outputPath.replace(".pdf", ".tmp.html");
    writeFileSync(tmpPath, printHtml, "utf-8");

    await page.goto(`file://${tmpPath}`, { waitUntil: "networkidle" });
    await page.pdf({
      path: outputPath,
      width: "1280px",
      height: "720px",
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });

    // Clean up temp file
    try { require("node:fs").unlinkSync(tmpPath); } catch {}

    return { success: true, path: outputPath };
  } catch (err) {
    return { success: false, path: outputPath, error: String(err) };
  } finally {
    if (browser) await browser.close();
  }
}

async function exportFromPreview(htmlPath: string, outputPath: string): Promise<{ success: boolean; path: string; error?: string }> {
  let browser;
  try {
    browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto(`file://${htmlPath}`, { waitUntil: "networkidle" });

    // Make all slides visible and set up print layout
    await page.evaluate(() => {
      const slides = document.querySelectorAll(".slide, .print-page");
      slides.forEach((s) => {
        (s as HTMLElement).style.display = "block";
        (s as HTMLElement).style.position = "relative";
        (s as HTMLElement).style.transform = "none";
        (s as HTMLElement).style.top = "0";
        (s as HTMLElement).style.left = "0";
        (s as HTMLElement).style.pageBreakAfter = "always";
        (s as HTMLElement).style.width = "1280px";
        (s as HTMLElement).style.height = "720px";
        (s as HTMLElement).style.overflow = "hidden";
      });
      document.body.style.width = "1280px";
      document.body.style.overflow = "visible";
      document.body.style.height = "auto";
    });

    await page.pdf({
      path: outputPath,
      width: "1280px",
      height: "720px",
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });

    return { success: true, path: outputPath };
  } catch (err) {
    return { success: false, path: outputPath, error: String(err) };
  } finally {
    if (browser) await browser.close();
  }
}
