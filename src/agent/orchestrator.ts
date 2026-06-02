/**
 * Orchestrator - full slide-generation pipeline.
 *
 * The pipeline uses the LLM when configured, with mock/fallback renderers kept for
 * local development and single-page failure recovery.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  outlineSchema,
  pagePlanningSchema,
  requirementSpecSchema,
  styleSpecSchema,
  type CreateRequest,
  type Outline,
  type OutlineItem,
  type PagePlanning,
  type QAResult,
  type QACheck,
  type RequirementSpec,
  type StyleSpec,
} from "../schemas.js";
import { chat, chatJSON, isConfigured } from "../llm/client.js";
import { canAutoGenerateImages, generateImage } from "../multimodal/image-client.js";
import { renderTemplate } from "../prompts/harness.js";
import { generateGlobalCSS, PRESET_STYLES } from "../renderer/style-generator.js";
import { wrapPageHTML, renderPageFromPlanning } from "../renderer/page-renderer.js";
import { assemblePreview } from "../renderer/assembler.js";
import { runBrowserQA } from "../qa/browser-qa.js";
import { exportPdf } from "../export/pdf.js";
import { exportPptx } from "../export/pptx.js";
import { generateReport } from "../report/generator.js";
import { getRunDir, saveFile, generateRunId, pageFileName, planningFileName } from "../storage/run-store.js";

export type ProgressStatus = "start" | "done" | "error";
export type ProgressKind = "phase" | "thought" | "tool" | "llm" | "artifact" | "qa" | "repair";

export interface ProgressEventMeta {
  kind?: ProgressKind;
  message?: string;
  pageIndex?: number;
  elapsedMs?: number;
}

export type ProgressFn = (step: string, status: ProgressStatus, detail?: string, meta?: ProgressEventMeta) => void;

export interface PipelineResult {
  runId: string;
  previewUrl: string;
  pdfUrl?: string;
  pptxUrl?: string;
  qa: QAResult;
  totalPages: number;
}

interface PageArtifact {
  index: number;
  htmlPath: string;
  planning: PagePlanning;
}

interface PipelineMetric {
  name: string;
  elapsedMs: number;
  ok: boolean;
  detail?: string;
}

const MAX_REPAIR_ROUNDS = Number(process.env.LLM_MAX_REPAIR_ROUNDS) || 3;
const PAGE_CONCURRENCY = clamp(Number(process.env.LLM_PAGE_CONCURRENCY) || 3, 1, 6);
const REPAIR_CONCURRENCY = clamp(Number(process.env.LLM_REPAIR_CONCURRENCY) || 2, 1, 4);

export async function runPipeline(request: CreateRequest, onProgress?: ProgressFn): Promise<PipelineResult> {
  const progress = onProgress ?? (() => {});
  const metrics: PipelineMetric[] = [];
  const useLLM = isConfigured();

  progress("requirement", "start", useLLM ? "llm" : "mock", {
    kind: "thought",
    message: "Analyze the prompt, infer audience and goal, then turn it into a structured deck requirement.",
  });
  const requirement = await measured(metrics, "requirement", () => buildRequirement(request, useLLM, progress), progress);
  const runId = generateRunId(requirement.topic || request.prompt);
  const runDir = getRunDir(runId);
  saveFile(runId, "requirement.json", JSON.stringify(requirement, null, 2));
  progress("artifact.requirement", "done", "requirement.json", {
    kind: "artifact",
    message: "Saved structured requirement.",
  });
  progress("requirement", "done", requirement.topic, { kind: "phase" });

  progress("outline", "start", useLLM ? "llm" : "mock", {
    kind: "thought",
    message: "Plan the presentation storyline, page order, and page types before writing slides.",
  });
  const outline = await measured(metrics, "outline", () => buildOutline(requirement, request, useLLM, progress), progress);
  saveFile(runId, "outline.json", JSON.stringify(outline, null, 2));
  progress("artifact.outline", "done", "outline.json", {
    kind: "artifact",
    message: "Saved the deck outline.",
  });
  progress("outline", "done", `${outline.totalPages} pages`, { kind: "phase" });

  progress("style", "start", useLLM ? "llm" : "preset", {
    kind: "thought",
    message: "Choose a consistent visual system before rendering individual pages.",
  });
  const styleSpec = await measured(metrics, "style", () => buildStyle(requirement, request, useLLM, progress), progress);
  const globalCSS = generateGlobalCSS(styleSpec);
  saveFile(runId, "style.json", JSON.stringify(styleSpec, null, 2));
  saveFile(runId, "global.css", globalCSS);
  progress("artifact.style", "done", "style.json, global.css", {
    kind: "artifact",
    message: "Saved locked style assets.",
  });
  progress("style", "done", styleSpec.colorScheme, { kind: "phase" });

  progress("pages", "start", useLLM ? `llm concurrency=${PAGE_CONCURRENCY}` : "mock", {
    kind: "phase",
    message: "Generate page plans and page HTML with bounded parallelism.",
  });
  const pageArtifacts = await measured(metrics, "pages", () =>
    mapConcurrent(outline.items, PAGE_CONCURRENCY, async (item) => {
      progress("page", "start", `${item.index}/${outline.totalPages}`, {
        kind: "phase",
        pageIndex: item.index,
        message: `Start slide ${item.index}: ${item.title}`,
      });
      const artifact = await buildPage({
        item,
        outline,
        requirement,
        request,
        runId,
        globalCSS,
        useLLM,
        progress,
      });
      progress("page", "done", `${item.index}/${outline.totalPages}`, {
        kind: "phase",
        pageIndex: item.index,
        message: `Finished slide ${item.index}.`,
      });
      return artifact;
    }),
    progress,
  );
  const sortedArtifacts = pageArtifacts.sort((a, b) => a.index - b.index);
  let pageHtmlPaths = sortedArtifacts.map((page) => page.htmlPath);
  progress("pages", "done", `${pageHtmlPaths.length} pages`, { kind: "phase" });

  progress("qa", "start", undefined, {
    kind: "qa",
    message: "Run browser QA: render every slide, capture screenshots, and check dimensions/overflow.",
  });
  const screenshotDir = join(runDir, "png");
  let qa = await measured(metrics, "qa.initial", () => runBrowserQA({ pagePaths: pageHtmlPaths, screenshotDir }), progress);
  progress("qa", qa.passed ? "done" : "error", `score: ${qa.score}`, {
    kind: "qa",
    message: qa.passed ? "Browser QA passed." : "Browser QA found issues and repair will target failed pages.",
  });

  let repairRound = 0;
  while (!qa.passed && useLLM && repairRound < MAX_REPAIR_ROUNDS) {
    const failedPages = failedPageIndexes(qa);
    if (failedPages.length === 0) break;

    repairRound++;
    progress("repair", "start", `round ${repairRound}: ${failedPages.join(", ")}`, {
      kind: "repair",
      message: "Repair only pages that failed QA instead of regenerating the whole deck.",
    });
    await measured(metrics, `repair.round.${repairRound}`, () =>
      mapConcurrent(failedPages, REPAIR_CONCURRENCY, async (pageIndex) => {
        const artifact = sortedArtifacts.find((page) => page.index === pageIndex);
        if (!artifact) return;
        progress("repair-page", "start", `page ${pageIndex}`, {
          kind: "repair",
          pageIndex,
          message: `Repair slide ${pageIndex} using QA failure details.`,
        });
        await repairPage({ runId, outline, globalCSS, qa, artifact, progress });
        progress("repair-page", "done", `page ${pageIndex}`, {
          kind: "repair",
          pageIndex,
          message: `Saved repaired slide ${pageIndex}.`,
        });
      }),
      progress,
    );
    progress("repair", "done", `round ${repairRound}`, { kind: "repair" });

    pageHtmlPaths = sortedArtifacts.map((page) => page.htmlPath);
    progress("qa", "start", `after repair ${repairRound}`, {
      kind: "qa",
      message: "Re-run browser QA after repair.",
    });
    qa = await measured(metrics, `qa.repair.${repairRound}`, () => runBrowserQA({ pagePaths: pageHtmlPaths, screenshotDir }), progress);
    progress("qa", qa.passed ? "done" : "error", `score: ${qa.score}`, { kind: "qa" });
  }

  progress("assemble", "start", undefined, {
    kind: "tool",
    message: "Assemble slide HTML files into a keyboard-navigable preview.",
  });
  const previewHtml = assemblePreview(pageHtmlPaths, outline.title);
  saveFile(runId, "preview.html", previewHtml);
  progress("assemble", "done", "preview.html", { kind: "artifact" });

  progress("pdf", "start", undefined, {
    kind: "tool",
    message: "Export the deck to PDF with Playwright.",
  });
  const pdfPath = join(runDir, "deck.pdf");
  const pdfResult = await measured(metrics, "pdf", () => exportPdf({ pagePaths: pageHtmlPaths, outputPath: pdfPath }), progress);
  progress("pdf", pdfResult.success ? "done" : "error", pdfResult.error || "deck.pdf", { kind: "artifact" });

  progress("pptx", "start", undefined, {
    kind: "tool",
    message: "Export the deck to PPTX by embedding verified slide screenshots.",
  });
  const pptxPath = join(runDir, "deck.pptx");
  const pptxResult = await measured(metrics, "pptx", () => exportPptx({ screenshotPaths: qa.screenshots, outputPath: pptxPath }), progress);
  progress("pptx", pptxResult.success ? "done" : "error", pptxResult.error || "deck.pptx", { kind: "artifact" });

  progress("report", "start", undefined, {
    kind: "tool",
    message: "Write the generation report and run manifest.",
  });
  const report = generateReport({
    runId,
    topic: outline.title,
    totalPages: outline.totalPages,
    style: request.style,
    qa,
    pdfPath: pdfResult.success ? pdfPath : undefined,
    pptxPath: pptxResult.success ? pptxPath : undefined,
  });
  saveFile(runId, "qa.json", JSON.stringify(toPublicQA(qa, runId), null, 2));
  saveFile(runId, "report.md", report);
  progress("report", "done", "report.md", { kind: "artifact" });

  saveFile(runId, "metrics.json", JSON.stringify(metrics, null, 2));
  saveFile(runId, "manifest.json", JSON.stringify({
    runId,
    topic: outline.title,
    totalPages: outline.totalPages,
    style: request.style,
    language: request.language,
    mode: useLLM ? "llm" : "mock",
    createdAt: new Date().toISOString(),
    artifacts: {
      outline: "outline.json",
      style: "style.json",
      globalCss: "global.css",
      pages: sortedArtifacts.map((page) => ({
        index: page.index,
        planning: `planning/${planningFileName(page.index)}`,
        html: `slides/${pageFileName(page.index, "html")}`,
        png: `png/slide-${String(page.index).padStart(2, "0")}.png`,
      })),
      previewHtml: "preview.html",
      pdf: pdfResult.success ? "deck.pdf" : undefined,
      pptx: pptxResult.success ? "deck.pptx" : undefined,
      qa: "qa.json",
    },
  }, null, 2));

  return {
    runId,
    previewUrl: runAssetUrl(runId, "preview.html"),
    pdfUrl: pdfResult.success ? runAssetUrl(runId, "deck.pdf") : undefined,
    pptxUrl: pptxResult.success ? runAssetUrl(runId, "deck.pptx") : undefined,
    qa,
    totalPages: outline.totalPages,
  };
}

function toPublicQA(qa: QAResult, runId: string): QAResult {
  return {
    ...qa,
    screenshots: qa.screenshots.map((path) => runAssetUrl(runId, "png", path.split(/[\\/]/).pop() || "")),
  };
}

function runAssetUrl(runId: string, ...parts: string[]): string {
  return `/runs/${encodeURIComponent(runId)}/${parts.map((part) => encodeURIComponent(part)).join("/")}`;
}

async function buildRequirement(request: CreateRequest, useLLM: boolean, progress: ProgressFn): Promise<RequirementSpec> {
  if (!useLLM) return fallbackRequirement(request);

  try {
    progress("tool.template.requirement", "start", "requirement.md", {
      kind: "tool",
      message: "Render requirement prompt template.",
    });
    const prompt = renderTemplate("requirement", {
      USER_PROMPT: request.prompt,
      LANGUAGE: request.language,
    });
    progress("tool.template.requirement", "done", `${prompt.length} chars`, { kind: "tool" });
    progress("llm.requirement", "start", "structured JSON", {
      kind: "llm",
      message: "Call the model to extract structured requirements.",
    });
    const parsed = requirementSpecSchema.parse(await chatJSON([{ role: "user", content: prompt }]));
    progress("llm.requirement", "done", parsed.topic, { kind: "llm" });
    return {
      ...parsed,
      pageCount: request.pages,
      language: request.language || parsed.language,
      style: request.style || parsed.style,
    };
  } catch (err) {
    return {
      ...fallbackRequirement(request),
      sourceMaterial: `LLM requirement fallback: ${String(err).slice(0, 300)}`,
    };
  }
}

async function buildOutline(requirement: RequirementSpec, request: CreateRequest, useLLM: boolean, progress: ProgressFn): Promise<Outline> {
  if (!useLLM) return generateMockOutline(requirement.topic, request.pages);

  try {
    progress("tool.template.outline", "start", "outline.md", {
      kind: "tool",
      message: "Render outline prompt template.",
    });
    const prompt = renderTemplate("outline", {
      TOPIC: requirement.topic,
      AUDIENCE: requirement.audience,
      GOAL: requirement.goal,
      PAGE_COUNT: String(request.pages),
      LANGUAGE: requirement.language,
      TONE: requirement.tone,
    });
    progress("tool.template.outline", "done", `${prompt.length} chars`, { kind: "tool" });
    progress("llm.outline", "start", `${request.pages} pages`, {
      kind: "llm",
      message: "Call the model to create the storyline and page sequence.",
    });
    const parsed = outlineSchema.parse(await chatJSON([{ role: "user", content: prompt }]));
    progress("llm.outline", "done", `${parsed.items.length} items`, { kind: "llm" });
    return normalizeOutline(parsed, request.pages);
  } catch {
    return generateMockOutline(requirement.topic, request.pages);
  }
}

async function buildStyle(requirement: RequirementSpec, request: CreateRequest, useLLM: boolean, progress: ProgressFn): Promise<StyleSpec> {
  const fallback = PRESET_STYLES[request.style] || PRESET_STYLES["tech-dark"];
  if (!useLLM) return fallback;

  try {
    progress("tool.template.style", "start", "style.md", {
      kind: "tool",
      message: "Render style prompt template.",
    });
    const prompt = renderTemplate("style", {
      TOPIC: requirement.topic,
      AUDIENCE: requirement.audience,
      STYLE_HINT: request.style || requirement.style,
      COLOR_SCHEME: fallback.colorScheme,
    });
    progress("tool.template.style", "done", `${prompt.length} chars`, { kind: "tool" });
    progress("llm.style", "start", request.style, {
      kind: "llm",
      message: "Call the model to define the global style system.",
    });
    return styleSpecSchema.parse(await chatJSON([{ role: "user", content: prompt }]));
  } catch {
    return fallback;
  }
}

async function buildPage(options: {
  item: OutlineItem;
  outline: Outline;
  requirement: RequirementSpec;
  request: CreateRequest;
  runId: string;
  globalCSS: string;
  useLLM: boolean;
  progress: ProgressFn;
}): Promise<PageArtifact> {
  const { item, outline, requirement, request, runId, globalCSS, useLLM, progress } = options;
  let planning: PagePlanning;
  let innerHTML: string;

  try {
    planning = useLLM
      ? await generatePagePlanning(item, outline, requirement, progress)
      : generateMockPlanning(item.index, item, outline);
  } catch {
    planning = generateMockPlanning(item.index, item, outline);
  }

  planning = await attachVisualAssets({
    planning,
    runId,
    useLLM,
    progress,
  });

  saveFile(runId, `planning/${planningFileName(item.index)}`, JSON.stringify(planning, null, 2));
  progress("artifact.planning", "done", `planning/${planningFileName(item.index)}`, {
    kind: "artifact",
    pageIndex: item.index,
    message: `Saved slide ${item.index} planning JSON.`,
  });

  try {
    innerHTML = useLLM ? await generatePageHTML(planning, progress) : renderPageFromPlanning(planning);
  } catch {
    innerHTML = renderPageFromPlanning(planning);
  }

  const fullHTML = wrapPageHTML(innerHTML, globalCSS, item.index, outline.totalPages);
  const htmlPath = saveFile(runId, `slides/${pageFileName(item.index, "html")}`, fullHTML);
  progress("artifact.slide", "done", `slides/${pageFileName(item.index, "html")}`, {
    kind: "artifact",
    pageIndex: item.index,
    message: `Saved slide ${item.index} HTML.`,
  });
  return { index: item.index, htmlPath, planning };
}

async function attachVisualAssets(options: {
  planning: PagePlanning;
  runId: string;
  useLLM: boolean;
  progress: ProgressFn;
}): Promise<PagePlanning> {
  const { planning, runId, useLLM, progress } = options;
  if (!useLLM || !canAutoGenerateImages()) return planning;

  const blocks = [...planning.contentBlocks];
  const firstVisualIndex = blocks.findIndex((block) => block.type === "visual" && typeof block.content === "string" && block.content.trim());
  if (firstVisualIndex < 0) return planning;

  const block = blocks[firstVisualIndex];
  const visualPrompt = String(block.content).trim();

  try {
    progress("tool.image.generate", "start", `page ${planning.pageIndex}`, {
      kind: "tool",
      pageIndex: planning.pageIndex,
      message: "Generate a local visual asset for this slide.",
    });
    const images = await generateImage({
      prompt: `${visualPrompt}. Presentation slide visual asset, clean composition, no text, 16:9 friendly.`,
      size: "1792x1024",
      n: 1,
      runId,
    });
    const image = images[0];
    progress("tool.image.generate", "done", image.url, {
      kind: "artifact",
      pageIndex: planning.pageIndex,
      message: "Saved generated image asset.",
    });

    blocks[firstVisualIndex] = {
      ...block,
      content: {
        prompt: visualPrompt,
        assetUrl: image.url,
        alt: visualPrompt,
      },
    };
    return { ...planning, contentBlocks: blocks };
  } catch (err) {
    progress("tool.image.generate", "error", `page ${planning.pageIndex}`, {
      kind: "tool",
      pageIndex: planning.pageIndex,
      message: String(err).slice(0, 240),
    });
    return planning;
  }
}

async function generatePagePlanning(item: OutlineItem, outline: Outline, requirement: RequirementSpec, progress: ProgressFn): Promise<PagePlanning> {
  const outlineContext = JSON.stringify(outline.items.map(({ index, title, purpose, pageType, density }) => ({
    index,
    title,
    purpose,
    pageType,
    density,
  })), null, 2);

  progress("tool.template.page-planning", "start", `page ${item.index}`, {
    kind: "tool",
    pageIndex: item.index,
    message: "Render page-planning prompt template.",
  });
  const prompt = renderTemplate("page-planning", {
    DECK_TITLE: outline.title,
    PAGE_INDEX: String(item.index),
    TOTAL_PAGES: String(outline.totalPages),
    PAGE_TITLE: item.title,
    PAGE_TYPE: item.pageType,
    PAGE_PURPOSE: item.purpose,
    DENSITY: item.density,
    LANGUAGE: requirement.language,
    OUTLINE_CONTEXT: outlineContext,
    MAX_BULLETS: "5",
    MAX_CARDS: "4",
  });
  progress("tool.template.page-planning", "done", `${prompt.length} chars`, {
    kind: "tool",
    pageIndex: item.index,
  });

  progress("llm.page-planning", "start", `page ${item.index}`, {
    kind: "llm",
    pageIndex: item.index,
    message: "Call the model to plan slide content blocks and layout.",
  });
  const parsed = pagePlanningSchema.parse(await chatJSON([{ role: "user", content: prompt }]));
  progress("llm.page-planning", "done", `${parsed.contentBlocks.length} blocks`, {
    kind: "llm",
    pageIndex: item.index,
  });
  return {
    ...parsed,
    pageIndex: item.index,
    pageType: parsed.pageType || item.pageType,
    densityLabel: parsed.densityLabel || item.density,
  };
}

async function generatePageHTML(planning: PagePlanning, progress: ProgressFn): Promise<string> {
  progress("tool.template.page-html", "start", `page ${planning.pageIndex}`, {
    kind: "tool",
    pageIndex: planning.pageIndex,
    message: "Render page HTML prompt template.",
  });
  const prompt = renderTemplate("page-html", {
    PAGE_PLANNING_JSON: JSON.stringify(planning, null, 2),
  });
  progress("tool.template.page-html", "done", `${prompt.length} chars`, {
    kind: "tool",
    pageIndex: planning.pageIndex,
  });
  progress("llm.page-html", "start", `page ${planning.pageIndex}`, {
    kind: "llm",
    pageIndex: planning.pageIndex,
    message: "Call the model to produce slide inner HTML.",
  });
  const raw = await chat([{ role: "user", content: prompt }]);
  const html = stripToInnerHTML(raw);
  progress("llm.page-html", "done", `${html.length} chars`, {
    kind: "llm",
    pageIndex: planning.pageIndex,
  });
  return html;
}

async function repairPage(options: {
  runId: string;
  outline: Outline;
  globalCSS: string;
  qa: QAResult;
  artifact: PageArtifact;
  progress: ProgressFn;
}): Promise<void> {
  const { runId, outline, globalCSS, qa, artifact, progress } = options;
  const currentHTML = extractBodyInnerHTML(readFileSync(artifact.htmlPath, "utf-8"));
  const failures = qa.checks
    .filter((check) => check.pageIndex === artifact.index)
    .map(formatQACheck)
    .join("\n");

  progress("tool.template.repair", "start", `page ${artifact.index}`, {
    kind: "tool",
    pageIndex: artifact.index,
    message: "Render repair prompt with current HTML and QA failures.",
  });
  const prompt = renderTemplate("repair", {
    CURRENT_HTML: currentHTML,
    QA_FAILURE: failures,
    PAGE_PLANNING_JSON: JSON.stringify(artifact.planning, null, 2),
  });
  progress("tool.template.repair", "done", `${prompt.length} chars`, {
    kind: "tool",
    pageIndex: artifact.index,
  });

  progress("llm.repair", "start", `page ${artifact.index}`, {
    kind: "llm",
    pageIndex: artifact.index,
    message: "Call the model to repair the failed slide layout.",
  });
  const repaired = stripToInnerHTML(await chat([{ role: "user", content: prompt }]));
  progress("llm.repair", "done", `${repaired.length} chars`, {
    kind: "llm",
    pageIndex: artifact.index,
  });
  artifact.htmlPath = saveFile(
    runId,
    `slides/${pageFileName(artifact.index, "html")}`,
    wrapPageHTML(repaired, globalCSS, artifact.index, outline.totalPages),
  );
}

function fallbackRequirement(request: CreateRequest): RequirementSpec {
  return {
    topic: request.prompt,
    audience: "general audience",
    pageCount: request.pages,
    language: request.language,
    tone: "professional",
    style: request.style,
    goal: "Create a clear presentation from the user's request.",
  };
}

function normalizeOutline(outline: Outline, pageCount: number): Outline {
  const fallback = generateMockOutline(outline.title, pageCount);
  const items = outline.items.slice(0, pageCount).map((item, index) => ({
    ...item,
    index: index + 1,
    density: item.density || "medium",
  }));

  while (items.length < pageCount) {
    items.push(fallback.items[items.length]);
  }

  if (items.length > 0) {
    items[0] = { ...items[0], pageType: "cover", density: "low" };
    const last = items.length - 1;
    if (!["summary", "end"].includes(items[last].pageType)) {
      items[last] = { ...items[last], pageType: "summary", density: "low" };
    }
  }

  return {
    ...outline,
    totalPages: pageCount,
    items,
  };
}

function failedPageIndexes(qa: QAResult): number[] {
  return [...new Set(
    qa.checks
      .filter((check) => check.status !== "pass" && typeof check.pageIndex === "number")
      .map((check) => check.pageIndex as number),
  )].sort((a, b) => a - b);
}

function formatQACheck(check: QACheck): string {
  return `[${check.status}] ${check.id}/${check.name}: ${check.message}`;
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

async function measured<T>(metrics: PipelineMetric[], name: string, fn: () => Promise<T>, progress?: ProgressFn): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    const elapsedMs = Date.now() - start;
    metrics.push({ name, elapsedMs, ok: true });
    progress?.(`metric.${name}`, "done", `${elapsedMs}ms`, {
      kind: "tool",
      elapsedMs,
      message: `Finished ${name}.`,
    });
    return result;
  } catch (err) {
    const elapsedMs = Date.now() - start;
    metrics.push({ name, elapsedMs, ok: false, detail: String(err).slice(0, 300) });
    progress?.(`metric.${name}`, "error", `${elapsedMs}ms`, {
      kind: "tool",
      elapsedMs,
      message: String(err).slice(0, 300),
    });
    throw err;
  }
}

async function mapConcurrent<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

// === Mock generators used when the LLM is not configured or a single page fails ===

function generateMockOutline(topic: string, pages: number): Outline {
  const types: OutlineItem["pageType"][] = [
    "cover",
    "content",
    "content",
    "comparison",
    "timeline",
    "metrics",
    "content",
    "summary",
  ];

  const items = Array.from({ length: pages }, (_, index) => ({
    index: index + 1,
    title: index === 0 ? topic.slice(0, 30) : index === pages - 1 ? "Q & A" : `Page ${index + 1}`,
    purpose: index === 0 ? "Cover slide" : index === pages - 1 ? "Closing" : `Content page ${index + 1}`,
    pageType: types[index % types.length],
    density: index === 0 || index === pages - 1 ? "low" as const : "medium" as const,
  }));

  return {
    title: topic,
    storyline: `A concise presentation about ${topic}.`,
    totalPages: pages,
    items,
  };
}

function generateMockPlanning(index: number, item: OutlineItem, outline: Outline): PagePlanning {
  const blocks: PagePlanning["contentBlocks"] = [{ type: "heading", content: item.title }];

  if (item.pageType === "cover" || item.pageType === "end" || item.pageType === "summary") {
    blocks.push({ type: "subheading", content: outline.storyline || "Key message and next steps." });
  } else if (item.pageType === "metrics") {
    blocks.push({ type: "metric", content: [
      { value: "73%", label: "Key metric one" },
      { value: "4.5x", label: "Key metric two" },
      { value: "28B", label: "Market signal" },
    ] });
  } else if (item.pageType === "timeline") {
    blocks.push({ type: "timeline", content: [
      { label: "Phase 1", desc: "Discovery and alignment" },
      { label: "Phase 2", desc: "Pilot and iteration" },
      { label: "Phase 3", desc: "Scale-up and governance" },
    ] });
  } else if (item.pageType === "comparison") {
    blocks.push({ type: "card", content: [
      { title: "Option A", desc: "Fastest path for early validation." },
      { title: "Option B", desc: "More stable path for durable operations." },
      { title: "Option C", desc: "Lower-cost path for constrained teams." },
    ] });
  } else {
    blocks.push({ type: "bullets", content: [
      "Clarify the primary decision the audience needs to make.",
      "Use concrete evidence to support the recommendation.",
      "Close with specific actions and ownership.",
    ] });
  }

  return {
    pageIndex: index,
    title: item.title,
    pageType: item.pageType,
    layoutHint: item.pageType === "cover" ? "center" : "left-aligned",
    densityLabel: item.density || "medium",
    contentBudget: {
      maxCards: 4,
      maxBullets: 5,
      maxCharts: 1,
      minBodyFontPx: 18,
      maxLinesPerCard: 3,
    },
    contentBlocks: blocks,
  };
}
