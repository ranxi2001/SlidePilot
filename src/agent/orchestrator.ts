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
import { renderTemplate } from "../prompts/harness.js";
import { generateGlobalCSS, PRESET_STYLES } from "../renderer/style-generator.js";
import { wrapPageHTML, renderPageFromPlanning } from "../renderer/page-renderer.js";
import { assemblePreview } from "../renderer/assembler.js";
import { runBrowserQA } from "../qa/browser-qa.js";
import { exportPdf } from "../export/pdf.js";
import { generateReport } from "../report/generator.js";
import { getRunDir, saveFile, generateRunId, pageFileName, planningFileName } from "../storage/run-store.js";

export type ProgressFn = (step: string, status: "start" | "done" | "error", detail?: string) => void;

export interface PipelineResult {
  runId: string;
  previewUrl: string;
  pdfUrl?: string;
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

  progress("requirement", "start", useLLM ? "llm" : "mock");
  const requirement = await measured(metrics, "requirement", () => buildRequirement(request, useLLM));
  const runId = generateRunId(requirement.topic || request.prompt);
  const runDir = getRunDir(runId);
  saveFile(runId, "requirement.json", JSON.stringify(requirement, null, 2));
  progress("requirement", "done", requirement.topic);

  progress("outline", "start", useLLM ? "llm" : "mock");
  const outline = await measured(metrics, "outline", () => buildOutline(requirement, request, useLLM));
  saveFile(runId, "outline.json", JSON.stringify(outline, null, 2));
  progress("outline", "done", `${outline.totalPages} pages`);

  progress("style", "start", useLLM ? "llm" : "preset");
  const styleSpec = await measured(metrics, "style", () => buildStyle(requirement, request, useLLM));
  const globalCSS = generateGlobalCSS(styleSpec);
  saveFile(runId, "style.json", JSON.stringify(styleSpec, null, 2));
  saveFile(runId, "global.css", globalCSS);
  progress("style", "done", styleSpec.colorScheme);

  progress("pages", "start", useLLM ? `llm concurrency=${PAGE_CONCURRENCY}` : "mock");
  const pageArtifacts = await measured(metrics, "pages", () =>
    mapConcurrent(outline.items, PAGE_CONCURRENCY, async (item) => {
      progress("page", "start", `${item.index}/${outline.totalPages}`);
      const artifact = await buildPage({
        item,
        outline,
        requirement,
        request,
        runId,
        globalCSS,
        useLLM,
      });
      progress("page", "done", `${item.index}/${outline.totalPages}`);
      return artifact;
    }),
  );
  const sortedArtifacts = pageArtifacts.sort((a, b) => a.index - b.index);
  let pageHtmlPaths = sortedArtifacts.map((page) => page.htmlPath);
  progress("pages", "done", `${pageHtmlPaths.length} pages`);

  progress("qa", "start");
  const screenshotDir = join(runDir, "png");
  let qa = await measured(metrics, "qa.initial", () => runBrowserQA({ pagePaths: pageHtmlPaths, screenshotDir }));
  progress("qa", qa.passed ? "done" : "error", `score: ${qa.score}`);

  let repairRound = 0;
  while (!qa.passed && useLLM && repairRound < MAX_REPAIR_ROUNDS) {
    const failedPages = failedPageIndexes(qa);
    if (failedPages.length === 0) break;

    repairRound++;
    progress("repair", "start", `round ${repairRound}: ${failedPages.join(", ")}`);
    await measured(metrics, `repair.round.${repairRound}`, () =>
      mapConcurrent(failedPages, REPAIR_CONCURRENCY, async (pageIndex) => {
        const artifact = sortedArtifacts.find((page) => page.index === pageIndex);
        if (!artifact) return;
        progress("repair-page", "start", `page ${pageIndex}`);
        await repairPage({ runId, outline, globalCSS, qa, artifact });
        progress("repair-page", "done", `page ${pageIndex}`);
      }),
    );
    progress("repair", "done", `round ${repairRound}`);

    pageHtmlPaths = sortedArtifacts.map((page) => page.htmlPath);
    progress("qa", "start", `after repair ${repairRound}`);
    qa = await measured(metrics, `qa.repair.${repairRound}`, () => runBrowserQA({ pagePaths: pageHtmlPaths, screenshotDir }));
    progress("qa", qa.passed ? "done" : "error", `score: ${qa.score}`);
  }

  progress("assemble", "start");
  const previewHtml = assemblePreview(pageHtmlPaths, outline.title);
  saveFile(runId, "preview.html", previewHtml);
  progress("assemble", "done");

  progress("pdf", "start");
  const pdfPath = join(runDir, "deck.pdf");
  const pdfResult = await measured(metrics, "pdf", () => exportPdf({ pagePaths: pageHtmlPaths, outputPath: pdfPath }));
  progress("pdf", pdfResult.success ? "done" : "error", pdfResult.error);

  progress("report", "start");
  const report = generateReport({
    runId,
    topic: outline.title,
    totalPages: outline.totalPages,
    style: request.style,
    qa,
    pdfPath: pdfResult.success ? pdfPath : undefined,
  });
  saveFile(runId, "report.md", report);
  progress("report", "done");

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
    },
  }, null, 2));

  return {
    runId,
    previewUrl: `/runs/${runId}/preview.html`,
    pdfUrl: pdfResult.success ? `/runs/${runId}/deck.pdf` : undefined,
    qa,
    totalPages: outline.totalPages,
  };
}

async function buildRequirement(request: CreateRequest, useLLM: boolean): Promise<RequirementSpec> {
  if (!useLLM) return fallbackRequirement(request);

  try {
    const prompt = renderTemplate("requirement", {
      USER_PROMPT: request.prompt,
      LANGUAGE: request.language,
    });
    const parsed = requirementSpecSchema.parse(await chatJSON([{ role: "user", content: prompt }]));
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

async function buildOutline(requirement: RequirementSpec, request: CreateRequest, useLLM: boolean): Promise<Outline> {
  if (!useLLM) return generateMockOutline(requirement.topic, request.pages);

  try {
    const prompt = renderTemplate("outline", {
      TOPIC: requirement.topic,
      AUDIENCE: requirement.audience,
      GOAL: requirement.goal,
      PAGE_COUNT: String(request.pages),
      LANGUAGE: requirement.language,
      TONE: requirement.tone,
    });
    const parsed = outlineSchema.parse(await chatJSON([{ role: "user", content: prompt }]));
    return normalizeOutline(parsed, request.pages);
  } catch {
    return generateMockOutline(requirement.topic, request.pages);
  }
}

async function buildStyle(requirement: RequirementSpec, request: CreateRequest, useLLM: boolean): Promise<StyleSpec> {
  const fallback = PRESET_STYLES[request.style] || PRESET_STYLES["tech-dark"];
  if (!useLLM) return fallback;

  try {
    const prompt = renderTemplate("style", {
      TOPIC: requirement.topic,
      AUDIENCE: requirement.audience,
      STYLE_HINT: request.style || requirement.style,
      COLOR_SCHEME: fallback.colorScheme,
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
}): Promise<PageArtifact> {
  const { item, outline, requirement, request, runId, globalCSS, useLLM } = options;
  let planning: PagePlanning;
  let innerHTML: string;

  try {
    planning = useLLM
      ? await generatePagePlanning(item, outline, requirement)
      : generateMockPlanning(item.index, item, outline);
  } catch {
    planning = generateMockPlanning(item.index, item, outline);
  }

  saveFile(runId, `planning/${planningFileName(item.index)}`, JSON.stringify(planning, null, 2));

  try {
    innerHTML = useLLM ? await generatePageHTML(planning) : renderPageFromPlanning(planning);
  } catch {
    innerHTML = renderPageFromPlanning(planning);
  }

  const fullHTML = wrapPageHTML(innerHTML, globalCSS, item.index, outline.totalPages);
  const htmlPath = saveFile(runId, `slides/${pageFileName(item.index, "html")}`, fullHTML);
  return { index: item.index, htmlPath, planning };
}

async function generatePagePlanning(item: OutlineItem, outline: Outline, requirement: RequirementSpec): Promise<PagePlanning> {
  const outlineContext = JSON.stringify(outline.items.map(({ index, title, purpose, pageType, density }) => ({
    index,
    title,
    purpose,
    pageType,
    density,
  })), null, 2);

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

  const parsed = pagePlanningSchema.parse(await chatJSON([{ role: "user", content: prompt }]));
  return {
    ...parsed,
    pageIndex: item.index,
    pageType: parsed.pageType || item.pageType,
    densityLabel: parsed.densityLabel || item.density,
  };
}

async function generatePageHTML(planning: PagePlanning): Promise<string> {
  const prompt = renderTemplate("page-html", {
    PAGE_PLANNING_JSON: JSON.stringify(planning, null, 2),
  });
  const raw = await chat([{ role: "user", content: prompt }]);
  return stripToInnerHTML(raw);
}

async function repairPage(options: {
  runId: string;
  outline: Outline;
  globalCSS: string;
  qa: QAResult;
  artifact: PageArtifact;
}): Promise<void> {
  const { runId, outline, globalCSS, qa, artifact } = options;
  const currentHTML = extractBodyInnerHTML(readFileSync(artifact.htmlPath, "utf-8"));
  const failures = qa.checks
    .filter((check) => check.pageIndex === artifact.index)
    .map(formatQACheck)
    .join("\n");

  const prompt = renderTemplate("repair", {
    CURRENT_HTML: currentHTML,
    QA_FAILURE: failures,
    PAGE_PLANNING_JSON: JSON.stringify(artifact.planning, null, 2),
  });

  const repaired = stripToInnerHTML(await chat([{ role: "user", content: prompt }]));
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

async function measured<T>(metrics: PipelineMetric[], name: string, fn: () => Promise<T>): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    metrics.push({ name, elapsedMs: Date.now() - start, ok: true });
    return result;
  } catch (err) {
    metrics.push({ name, elapsedMs: Date.now() - start, ok: false, detail: String(err).slice(0, 300) });
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
