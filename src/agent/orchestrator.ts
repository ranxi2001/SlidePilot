/**
 * Orchestrator — the full pipeline:
 *
 * 1. Parse requirement
 * 2. Generate outline
 * 3. Lock style → global.css
 * 4. Per-page: planning → HTML → QA → repair
 * 5. Assemble preview.html
 * 6. Export PDF
 * 7. Generate report
 */

import { join, resolve } from "node:path";
import type { CreateRequest, Outline, PagePlanning, QAResult, StyleSpec } from "../schemas.js";
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

const MAX_REPAIR_ROUNDS = 3;

export async function runPipeline(request: CreateRequest, onProgress?: ProgressFn): Promise<PipelineResult> {
  const progress = onProgress ?? (() => {});

  // === 1. Requirement parsing (TODO: LLM) ===
  progress("requirement", "start");
  const topic = request.prompt;
  const runId = generateRunId(topic);
  const runDir = getRunDir(runId);
  progress("requirement", "done");

  // === 2. Outline (TODO: LLM) ===
  progress("outline", "start");
  const outline: Outline = generateMockOutline(topic, request.pages);
  saveFile(runId, "outline.json", JSON.stringify(outline, null, 2));
  progress("outline", "done");

  // === 3. Style lock → global.css ===
  progress("style", "start");
  const styleSpec: StyleSpec = PRESET_STYLES[request.style] || PRESET_STYLES["tech-dark"];
  const globalCSS = generateGlobalCSS(styleSpec);
  saveFile(runId, "style.json", JSON.stringify(styleSpec, null, 2));
  saveFile(runId, "global.css", globalCSS);
  progress("style", "done");

  // === 4. Per-page: planning → HTML ===
  progress("pages", "start");
  const pageHtmlPaths: string[] = [];

  for (const item of outline.items) {
    // 4a. Planning (TODO: LLM)
    const planning = generateMockPlanning(item.index, item, outline);
    saveFile(runId, `planning/${planningFileName(item.index)}`, JSON.stringify(planning, null, 2));

    // 4b. HTML generation (TODO: LLM generates raw HTML, fallback uses template)
    const innerHTML = renderPageFromPlanning(planning);
    const fullHTML = wrapPageHTML(innerHTML, globalCSS, item.index, outline.totalPages);
    const htmlPath = saveFile(runId, `slides/${pageFileName(item.index, "html")}`, fullHTML);
    pageHtmlPaths.push(htmlPath);
  }
  progress("pages", "done", `${outline.totalPages} pages`);

  // === 5. QA ===
  progress("qa", "start");
  const screenshotDir = join(runDir, "png");
  let qa = await runBrowserQA({ pagePaths: pageHtmlPaths, screenshotDir });
  progress("qa", "done", `score: ${qa.score}`);

  // === 6. Repair loop ===
  let repairRound = 0;
  while (!qa.passed && repairRound < MAX_REPAIR_ROUNDS) {
    repairRound++;
    progress("repair", "start", `round ${repairRound}`);
    // TODO: LLM-based repair of failed pages
    progress("repair", "done");
    qa = await runBrowserQA({ pagePaths: pageHtmlPaths, screenshotDir });
  }

  // === 7. Assemble preview ===
  progress("assemble", "start");
  const previewHtml = assemblePreview(pageHtmlPaths, outline.title);
  saveFile(runId, "preview.html", previewHtml);
  progress("assemble", "done");

  // === 8. PDF export (per-page → merged) ===
  progress("pdf", "start");
  const pdfPath = join(runDir, "deck.pdf");
  const pdfResult = await exportPdf({ pagePaths: pageHtmlPaths, outputPath: pdfPath });
  progress("pdf", pdfResult.success ? "done" : "error", pdfResult.error);

  // === 9. Report ===
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

  // Save manifest
  saveFile(runId, "manifest.json", JSON.stringify({
    runId,
    topic: outline.title,
    totalPages: outline.totalPages,
    style: request.style,
    language: request.language,
    createdAt: new Date().toISOString(),
  }, null, 2));

  return {
    runId,
    previewUrl: `/runs/${runId}/preview.html`,
    pdfUrl: pdfResult.success ? `/runs/${runId}/deck.pdf` : undefined,
    qa,
    totalPages: outline.totalPages,
  };
}

// === Mock generators (replaced by LLM in production) ===

function generateMockOutline(topic: string, pages: number): Outline {
  const types: Array<"cover" | "content" | "section" | "metrics" | "comparison" | "timeline" | "quote" | "summary" | "end"> = [
    "cover", "content", "content", "comparison", "timeline", "metrics", "content", "summary",
  ];

  const items = Array.from({ length: pages }, (_, i) => ({
    index: i + 1,
    title: i === 0 ? topic : i === pages - 1 ? "Q & A" : `第 ${i + 1} 页`,
    purpose: i === 0 ? "Cover slide" : i === pages - 1 ? "Closing" : `Content page ${i + 1}`,
    pageType: types[i % types.length] as any,
    density: "medium" as const,
  }));

  return {
    title: topic,
    subtitle: undefined,
    storyline: `关于 ${topic} 的演示`,
    totalPages: pages,
    items,
  };
}

function generateMockPlanning(index: number, item: any, outline: Outline): PagePlanning {
  const blocks: PagePlanning["contentBlocks"] = [];

  blocks.push({ type: "heading", content: item.title });

  if (item.pageType === "cover" || item.pageType === "end") {
    blocks.push({ type: "subheading", content: outline.storyline || "" });
  } else if (item.pageType === "metrics") {
    blocks.push({ type: "metric", content: [
      { value: "73%", label: "关键指标一" },
      { value: "4.5x", label: "关键指标二" },
      { value: "$28B", label: "关键指标三" },
    ]});
  } else if (item.pageType === "timeline") {
    blocks.push({ type: "timeline", content: [
      { label: "阶段一", desc: "初始探索与概念验证" },
      { label: "阶段二", desc: "产品开发与迭代" },
      { label: "阶段三", desc: "规模化推广" },
    ]});
  } else if (item.pageType === "comparison") {
    blocks.push({ type: "card", content: [
      { title: "方案 A", desc: "优势明显，适合快速迭代" },
      { title: "方案 B", desc: "稳定性高，适合长期运行" },
      { title: "方案 C", desc: "成本最低，适合初创团队" },
    ]});
  } else {
    blocks.push({ type: "bullets", content: [
      "核心观点一：清晰表达主要论点",
      "核心观点二：数据支撑关键结论",
      "核心观点三：行动建议与下一步",
    ]});
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
