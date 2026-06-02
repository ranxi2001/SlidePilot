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

  previewPanel.hidden = false;
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
}

function resetRun() {
  eventCount = 0;
  runStart = Date.now();
  agentPanel.hidden = false;
  previewPanel.hidden = true;
  btnPptx.hidden = true;
  btnPdf.hidden = true;
  eventList.innerHTML = "";
  agentSummary.textContent = "启动 Agent";
  stageState.clear();
  renderStages();
  startTimer();
  statEvents.textContent = "0 events";
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

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
