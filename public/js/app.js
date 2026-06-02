const btnCreate = document.getElementById("btn-create");
const promptEl = document.getElementById("prompt");
const styleEl = document.getElementById("style");
const pagesEl = document.getElementById("pages");
const agentPanel = document.getElementById("agent-panel");
const agentSummary = document.getElementById("agent-summary");
const stageGrid = document.getElementById("stage-grid");
const eventList = document.getElementById("event-list");
const previewPanel = document.getElementById("preview-panel");
const previewFrame = document.getElementById("preview-frame");
const resultSummary = document.getElementById("result-summary");
const btnPptx = document.getElementById("btn-pptx");
const btnPdf = document.getElementById("btn-pdf");
const btnHtml = document.getElementById("btn-html");
const revisionPageEl = document.getElementById("revision-page");
const revisionInstructionEl = document.getElementById("revision-instruction");
const btnRevise = document.getElementById("btn-revise");
const qualityPanel = document.getElementById("quality-panel");
const qaSummary = document.getElementById("qa-summary");
const qaList = document.getElementById("qa-list");
const screenshotSummary = document.getElementById("screenshot-summary");
const screenshotGallery = document.getElementById("screenshot-gallery");
const assetSummary = document.getElementById("asset-summary");
const assetGallery = document.getElementById("asset-gallery");
const revisionSummary = document.getElementById("revision-summary");
const revisionHistory = document.getElementById("revision-history");
const statusPill = document.getElementById("status-pill");
const statElapsed = document.getElementById("stat-elapsed");
const statEvents = document.getElementById("stat-events");
const filterInputs = [...document.querySelectorAll(".event-toolbar input[type='checkbox']")];

const STAGES = [
  ["requirement", "需求解析"],
  ["outline", "大纲规划"],
  ["style", "风格锁定"],
  ["pages", "页面生成"],
  ["qa", "浏览器 QA"],
  ["repair", "修复回路"],
  ["assemble", "预览组装"],
  ["pdf", "PDF 导出"],
  ["pptx", "PPTX 导出"],
  ["report", "报告归档"],
];

const stageState = new Map();
let eventCount = 0;
let runStart = 0;
let timer = null;
let currentResult = null;

init();

async function init() {
  renderStages();
  filterInputs.forEach((input) => input.addEventListener("change", applyFilters));

  try {
    const res = await fetch("/api/status");
    const data = await res.json();
    statusPill.textContent = data.llm ? `${data.model} 已连接` : "Mock 模式";
    statusPill.classList.toggle("ready", Boolean(data.llm));
  } catch {
    statusPill.textContent = "连接失败";
    statusPill.classList.add("error");
  }
}

btnCreate.addEventListener("click", async () => {
  const prompt = promptEl.value.trim();
  if (!prompt) return;

  resetRun();
  btnCreate.disabled = true;
  btnCreate.textContent = "生成中...";

  try {
    const res = await fetch("/api/create-stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        style: styleEl.value,
        pages: parseInt(pagesEl.value, 10),
        language: "zh-CN",
      }),
    });

    if (!res.ok || !res.body) {
      const text = await res.text();
      throw new Error(text || `HTTP ${res.status}`);
    }

    await consumeEventStream(res.body);
  } catch (err) {
    addEvent({
      type: "error",
      status: "error",
      step: "frontend",
      kind: "phase",
      message: err.message || String(err),
      elapsedMs: Date.now() - runStart,
    });
    agentSummary.textContent = "生成失败";
  } finally {
    btnCreate.disabled = false;
    btnCreate.textContent = "生成演示文稿";
    stopTimer();
  }
});

btnRevise.addEventListener("click", async () => {
  if (!currentResult?.runId) return;

  const pageIndex = parseInt(revisionPageEl.value, 10);
  const instruction = revisionInstructionEl.value.trim();
  if (!Number.isInteger(pageIndex) || pageIndex < 1 || !instruction) return;

  btnRevise.disabled = true;
  btnRevise.textContent = "修订中...";
  resultSummary.textContent = `正在修订第 ${pageIndex} 页...`;
  addEvent({
    type: "progress",
    status: "start",
    step: "revise",
    kind: "tool",
    pageIndex,
    message: "Submit a single-slide revision and regenerate preview/export artifacts.",
    elapsedMs: Date.now() - runStart,
  });

  try {
    const res = await fetch(`/api/runs/${encodeURIComponent(currentResult.runId)}/slides/${pageIndex}/revise`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instruction }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

    addEvent({
      type: "progress",
      status: "done",
      step: "revise",
      kind: "artifact",
      pageIndex,
      message: `Revision saved. QA score ${data.qa?.score ?? "-"}.`,
      elapsedMs: Date.now() - runStart,
    });
    showResult(data);
  } catch (err) {
    addEvent({
      type: "error",
      status: "error",
      step: "revise",
      kind: "tool",
      pageIndex,
      message: err.message || String(err),
      elapsedMs: Date.now() - runStart,
    });
    resultSummary.textContent = "修订失败";
  } finally {
    btnRevise.disabled = false;
    btnRevise.textContent = "修订此页";
  }
});

async function consumeEventStream(body) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) continue;
      handleStreamEvent(JSON.parse(line));
    }
  }

  if (buffer.trim()) handleStreamEvent(JSON.parse(buffer));
}

function handleStreamEvent(event) {
  addEvent(event);

  if (event.type === "result") {
    showResult(event.result);
    agentSummary.textContent = "生成完成";
    markStage("report", "done", "完成");
    return;
  }

  if (event.type === "error") {
    agentSummary.textContent = "生成失败";
    return;
  }

  const rootStep = normalizeStage(event.step);
  if (rootStep) {
    markStage(rootStep, event.status, event.detail || event.message || "");
  }

  if (event.kind === "llm" && event.status === "start") {
    agentSummary.textContent = event.message || "正在调用模型";
  } else if (event.kind === "tool" && event.status === "start") {
    agentSummary.textContent = event.message || "正在执行工具";
  } else if (event.kind === "qa") {
    agentSummary.textContent = event.message || "正在运行 QA";
  } else if (event.kind === "repair") {
    agentSummary.textContent = event.message || "正在修复页面";
  }
}

function showResult(result) {
  if (!result?.previewUrl) return;

  currentResult = result;
  previewPanel.hidden = false;
  revisionPageEl.max = String(result.totalPages || 1);
  if (!revisionPageEl.value || Number(revisionPageEl.value) > (result.totalPages || 1)) {
    revisionPageEl.value = "1";
  }
  resultSummary.textContent = "预览加载中...";
  previewFrame.src = `${result.previewUrl}?t=${Date.now()}`;
  previewFrame.onload = () => {
    resultSummary.textContent = `预览已就绪，QA 分数 ${result.qa?.score ?? "-"}`;
  };

  btnHtml.href = result.previewUrl;
  if (result.pptxUrl) {
    btnPptx.href = result.pptxUrl;
    btnPptx.hidden = false;
  } else {
    btnPptx.hidden = true;
  }

  if (result.pdfUrl) {
    btnPdf.href = result.pdfUrl;
    btnPdf.hidden = false;
  } else {
    btnPdf.hidden = true;
  }

  loadRunDetail(result.runId);
}

function resetRun() {
  eventCount = 0;
  runStart = Date.now();
  currentResult = null;
  agentPanel.hidden = false;
  previewPanel.hidden = true;
  qualityPanel.hidden = true;
  btnPptx.hidden = true;
  btnPdf.hidden = true;
  eventList.innerHTML = "";
  agentSummary.textContent = "启动 Agent";
  stageState.clear();
  renderStages();
  startTimer();
  statEvents.textContent = "0 events";
}

async function loadRunDetail(runId) {
  if (!runId) return;
  try {
    const res = await fetch(`/api/runs/${encodeURIComponent(runId)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    renderRunDetail(await res.json());
  } catch (err) {
    qualityPanel.hidden = false;
    qaSummary.textContent = "详情加载失败";
    qaList.innerHTML = `<li><strong class="fail">ERROR</strong>${escapeHTML(err.message || String(err))}</li>`;
  }
}

function renderRunDetail(detail) {
  qualityPanel.hidden = false;
  renderQA(detail.qa || currentResult?.qa);
  renderGallery(screenshotGallery, detail.screenshots || [], "截图");
  screenshotSummary.textContent = `${(detail.screenshots || []).length} 张`;
  renderGallery(assetGallery, detail.assets || [], "资产");
  assetSummary.textContent = `${(detail.assets || []).length} 个`;
  renderRevisions(detail.revisions || []);
}

function renderQA(qa) {
  if (!qa) {
    qaSummary.textContent = "无 QA 数据";
    qaList.innerHTML = "";
    return;
  }

  const checks = qa.checks || [];
  const failCount = checks.filter((check) => check.status === "fail").length;
  const warnCount = checks.filter((check) => check.status === "warn").length;
  qaSummary.textContent = `score ${qa.score ?? "-"} | fail ${failCount} | warn ${warnCount}`;

  if (checks.length === 0) {
    qaList.innerHTML = `<li><strong class="pass">PASS</strong>未发现 QA 问题</li>`;
    return;
  }

  qaList.innerHTML = checks.map((check) => `
    <li>
      <strong class="${escapeHTML(check.status)}">${escapeHTML(check.status).toUpperCase()}</strong>
      ${check.pageIndex ? `P${check.pageIndex} ` : ""}${escapeHTML(check.id || check.name)}:
      ${escapeHTML(check.message || "")}
    </li>
  `).join("");
}

function renderGallery(container, files, label) {
  if (!files.length) {
    container.innerHTML = `<div class="qa-list"><li>${label}为空</li></div>`;
    return;
  }

  container.innerHTML = files.map((file, index) => `
    <a class="thumb" href="${escapeHTML(file.url)}" target="_blank" rel="noreferrer">
      <img src="${escapeHTML(file.url)}?t=${Date.now()}" alt="${escapeHTML(file.name || `${label} ${index + 1}`)}">
      <span><b>${escapeHTML(file.name || `${label} ${index + 1}`)}</b><em>${formatBytes(file.bytes)}</em></span>
    </a>
  `).join("");
}

function renderRevisions(revisions) {
  revisionSummary.textContent = `${revisions.length} 次`;
  if (!revisions.length) {
    revisionHistory.innerHTML = `<li>暂无人工修订</li>`;
    return;
  }

  revisionHistory.innerHTML = revisions.slice().reverse().map((revision) => `
    <li>
      <strong>P${escapeHTML(revision.pageIndex || "-")}</strong>
      ${escapeHTML(revision.instruction || "")}
      <br>
      ${escapeHTML(revision.mode || "-")} | ${escapeHTML(revision.revisedAt || "-")} | QA ${escapeHTML(revision.qaScore ?? "-")}
    </li>
  `).join("");
}

function renderStages() {
  stageGrid.innerHTML = "";
  for (const [id, label] of STAGES) {
    const state = stageState.get(id) || { status: "pending", detail: "等待" };
    const card = document.createElement("div");
    card.className = `stage-card ${statusClass(state.status)}`;
    card.dataset.stage = id;
    card.innerHTML = `<strong>${label}</strong><span>${escapeHTML(state.detail || "等待")}</span>`;
    stageGrid.appendChild(card);
  }
}

function markStage(id, status, detail) {
  const current = stageState.get(id) || {};
  stageState.set(id, {
    status: status === "start" ? "running" : status,
    detail: detail || current.detail || (status === "start" ? "进行中" : statusText(status)),
  });
  renderStages();
}

function addEvent(event) {
  eventCount += 1;
  statEvents.textContent = `${eventCount} events`;

  const item = document.createElement("li");
  const kind = event.kind || "phase";
  item.className = `event-item ${kind} ${event.status === "error" ? "error" : ""}`;
  item.dataset.kind = kind;
  item.innerHTML = `
    <span class="event-time">${formatElapsed(event.elapsedMs)}</span>
    <span class="event-kind">${escapeHTML(kind)}</span>
    <div class="event-body">
      <strong>${escapeHTML(formatTitle(event))}</strong>
      <p>${escapeHTML(formatMessage(event))}</p>
    </div>
  `;

  eventList.appendChild(item);
  applyFilters();
  eventList.scrollTop = eventList.scrollHeight;
}

function applyFilters() {
  const hiddenKinds = new Set(
    filterInputs
      .filter((input) => !input.checked)
      .map((input) => input.id.replace("filter-", "")),
  );

  for (const item of eventList.children) {
    item.classList.toggle("hidden-kind", hiddenKinds.has(item.dataset.kind));
  }
}

function normalizeStage(step) {
  if (!step) return null;
  if (step.startsWith("repair")) return "repair";
  if (step.startsWith("qa")) return "qa";
  if (step.startsWith("page") || step.includes("page-") || step.includes("page.")) return "pages";
  if (step.startsWith("artifact.") || step.startsWith("tool.") || step.startsWith("llm.") || step.startsWith("metric.")) return null;
  return STAGES.some(([id]) => id === step) ? step : null;
}

function formatTitle(event) {
  const page = event.pageIndex ? `P${event.pageIndex} ` : "";
  return `${page}${event.step || event.type} · ${statusText(event.status)}`;
}

function formatMessage(event) {
  const pieces = [];
  if (event.message) pieces.push(event.message);
  if (event.detail) pieces.push(event.detail);
  if (event.stepElapsedMs) pieces.push(`${event.stepElapsedMs}ms`);
  return pieces.join(" | ") || "-";
}

function statusClass(status) {
  if (status === "done") return "done";
  if (status === "error") return "error";
  if (status === "running" || status === "start") return "running";
  return "";
}

function statusText(status) {
  if (status === "start" || status === "running") return "进行中";
  if (status === "done") return "完成";
  if (status === "error") return "异常";
  return "等待";
}

function startTimer() {
  stopTimer();
  timer = window.setInterval(() => {
    statElapsed.textContent = formatElapsed(Date.now() - runStart);
  }, 250);
}

function stopTimer() {
  if (timer) window.clearInterval(timer);
  timer = null;
}

function formatElapsed(ms = 0) {
  if (!Number.isFinite(ms)) return "0.0s";
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
