import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { chat, isConfigured } from "../llm/client.js";
import { renderTemplate } from "../prompts/harness.js";
import { wrapPageHTML } from "../renderer/page-renderer.js";
import { assemblePreview } from "../renderer/assembler.js";
import { runBrowserQA } from "../qa/browser-qa.js";
import { exportPdf } from "../export/pdf.js";
import { exportPptx } from "../export/pptx.js";
import { generateReport } from "../report/generator.js";
import { getRunDir, loadFile, saveFile, pageFileName, planningFileName } from "../storage/run-store.js";
import { pagePlanningSchema, runManifestSchema, type PagePlanning } from "../schemas.js";
import type { PipelineResult } from "./orchestrator.js";

export interface ReviseSlideOptions {
  runId: string;
  pageIndex: number;
  instruction: string;
}

export interface ReviseSlideResult extends PipelineResult {
  revisedPage: number;
}

export async function reviseRunSlide(options: ReviseSlideOptions): Promise<ReviseSlideResult> {
  const { runId, pageIndex, instruction } = options;
  const runDir = getRunDir(runId);
  const manifestRaw = loadFile(runId, "manifest.json");
  if (!manifestRaw) {
    throw new Error(`Run not found: ${runId}`);
  }

  const manifest = runManifestSchema.parse(JSON.parse(manifestRaw));
  if (!Number.isInteger(pageIndex) || pageIndex < 1 || pageIndex > manifest.totalPages) {
    throw new Error(`Page index must be between 1 and ${manifest.totalPages}.`);
  }

  const globalCSS = loadFile(runId, "global.css");
  if (!globalCSS) {
    throw new Error(`Run ${runId} is missing global.css.`);
  }

  const slideRel = `slides/${pageFileName(pageIndex, "html")}`;
  const planningRel = `planning/${planningFileName(pageIndex)}`;
  const currentFullHTML = loadFile(runId, slideRel);
  if (!currentFullHTML) {
    throw new Error(`Run ${runId} is missing ${slideRel}.`);
  }

  const planning = loadPlanning(runId, planningRel, pageIndex);
  const currentInnerHTML = extractBodyInnerHTML(currentFullHTML);
  const revisedInnerHTML = isConfigured()
    ? await reviseWithLLM({ currentInnerHTML, planning, instruction })
    : reviseWithFallback(currentInnerHTML, instruction);

  saveFile(
    runId,
    slideRel,
    wrapPageHTML(revisedInnerHTML, globalCSS, pageIndex, manifest.totalPages),
  );

  const pageHtmlPaths = pagePaths(runDir, manifest.totalPages);
  const screenshotDir = join(runDir, "png");
  const qa = await runBrowserQA({ pagePaths: pageHtmlPaths, screenshotDir });

  const previewHtml = assemblePreview(pageHtmlPaths, manifest.topic);
  saveFile(runId, "preview.html", previewHtml);

  const pdfPath = join(runDir, "deck.pdf");
  const pdfResult = await exportPdf({ pagePaths: pageHtmlPaths, outputPath: pdfPath });

  const pptxPath = join(runDir, "deck.pptx");
  const pptxResult = await exportPptx({ screenshotPaths: qa.screenshots, outputPath: pptxPath });

  const report = generateReport({
    runId,
    topic: manifest.topic,
    totalPages: manifest.totalPages,
    style: manifest.style,
    qa,
    pdfPath: pdfResult.success ? pdfPath : undefined,
    pptxPath: pptxResult.success ? pptxPath : undefined,
  });
  saveFile(runId, "qa.json", JSON.stringify(toPublicQA(qa, runId), null, 2));
  saveFile(runId, "report.md", report);

  const revisions = loadRevisions(runId);
  revisions.push({
    pageIndex,
    instruction,
    mode: isConfigured() ? "llm" : "mock",
    revisedAt: new Date().toISOString(),
    qaScore: qa.score,
  });
  saveFile(runId, "revisions.json", JSON.stringify(revisions, null, 2));

  const nextManifest = {
    ...manifest,
    updatedAt: new Date().toISOString(),
    artifacts: {
      ...manifest.artifacts,
      pages: manifest.artifacts.pages.map((page) => page.index === pageIndex
        ? {
            ...page,
            html: slideRel,
            png: `png/slide-${String(pageIndex).padStart(2, "0")}.png`,
          }
        : page),
      previewHtml: "preview.html",
      pdf: pdfResult.success ? "deck.pdf" : undefined,
      pptx: pptxResult.success ? "deck.pptx" : undefined,
      qa: "qa.json",
      revisions: "revisions.json",
    },
  };
  saveFile(runId, "manifest.json", JSON.stringify(nextManifest, null, 2));

  return {
    runId,
    previewUrl: runAssetUrl(runId, "preview.html"),
    pdfUrl: pdfResult.success ? runAssetUrl(runId, "deck.pdf") : undefined,
    pptxUrl: pptxResult.success ? runAssetUrl(runId, "deck.pptx") : undefined,
    qa,
    totalPages: manifest.totalPages,
    revisedPage: pageIndex,
  };
}

function toPublicQA(qa: PipelineResult["qa"], runId: string): PipelineResult["qa"] {
  return {
    ...qa,
    screenshots: qa.screenshots.map((path) => runAssetUrl(runId, "png", path.split(/[\\/]/).pop() || "")),
  };
}

function runAssetUrl(runId: string, ...parts: string[]): string {
  return `/runs/${encodeURIComponent(runId)}/${parts.map((part) => encodeURIComponent(part)).join("/")}`;
}

async function reviseWithLLM(options: {
  currentInnerHTML: string;
  planning: PagePlanning;
  instruction: string;
}): Promise<string> {
  const prompt = renderTemplate("revise", {
    INSTRUCTION: options.instruction,
    PAGE_PLANNING_JSON: JSON.stringify(options.planning, null, 2),
    CURRENT_HTML: options.currentInnerHTML,
  });
  return stripToInnerHTML(await chat([{ role: "user", content: prompt }]));
}

function reviseWithFallback(currentInnerHTML: string, instruction: string): string {
  const escaped = escapeHTML(instruction).slice(0, 240);
  const badge = `
<div class="revision-note" style="position:absolute;left:56px;bottom:42px;max-width:760px;padding:10px 14px;border:1px solid rgba(91,140,255,0.35);border-radius:8px;background:rgba(91,140,255,0.10);font-size:14px;line-height:1.45;">
  Manual revision: ${escaped}
</div>`;
  return `${currentInnerHTML.replace(/<div class="revision-note"[\s\S]*?<\/div>/g, "").trim()}\n${badge}`;
}

function loadPlanning(runId: string, relativePath: string, pageIndex: number): PagePlanning {
  const raw = loadFile(runId, relativePath);
  if (!raw) {
    throw new Error(`Run ${runId} is missing ${relativePath}.`);
  }
  return pagePlanningSchema.parse({
    ...JSON.parse(raw),
    pageIndex,
  });
}

function pagePaths(runDir: string, totalPages: number): string[] {
  return Array.from({ length: totalPages }, (_, i) => {
    const path = join(runDir, "slides", pageFileName(i + 1, "html"));
    if (!existsSync(path)) throw new Error(`Missing slide HTML: ${path}`);
    return path;
  });
}

function loadRevisions(runId: string): Array<Record<string, unknown>> {
  const raw = loadFile(runId, "revisions.json");
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function stripToInnerHTML(raw: string): string {
  let text = raw.trim();
  text = text.replace(/^```(?:html)?\s*/i, "").replace(/\s*```$/i, "").trim();

  const bodyMatch = text.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch?.[1]) return bodyMatch[1].trim();

  return text
    .replace(/<!doctype[^>]*>/i, "")
    .replace(/<\/?html[^>]*>/gi, "")
    .replace(/<head[\s\S]*?<\/head>/i, "")
    .trim();
}

function extractBodyInnerHTML(fullHTML: string): string {
  const bodyMatch = fullHTML.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const body = bodyMatch?.[1] || fullHTML;
  return body.replace(/<span class="page-number">[\s\S]*?<\/span>/g, "").trim();
}

function escapeHTML(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
