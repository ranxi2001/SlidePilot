const btnCreate = document.getElementById("btn-create");
const btnCreateLabel = btnCreate.querySelector(".btn-label");
const btnCreateSub = btnCreate.querySelector(".btn-sub");
const promptEl = document.getElementById("prompt");
const styleEl = document.getElementById("style");
const pagesEl = document.getElementById("pages");
const emptyPanel = document.getElementById("empty-panel");
const livePanel = document.getElementById("live-panel");
const agentPanel = document.getElementById("agent-panel");
const agentHeading = document.getElementById("agent-heading");
const agentSummary = document.getElementById("agent-summary");
const stageGrid = document.getElementById("stage-grid");
const progressFill = document.getElementById("progress-fill");
const progressLabel = document.getElementById("progress-label");
const eventList = document.getElementById("event-list");
const eventModeLabel = document.getElementById("event-mode-label");
const previewPanel = document.getElementById("preview-panel");
const previewShell = document.getElementById("preview-shell");
const previewFallback = document.getElementById("preview-fallback");
const previewImage = document.getElementById("preview-image");
const previewFrame = document.getElementById("preview-frame");
const resultSummary = document.getElementById("result-summary");
const qaBadge = document.getElementById("qa-badge");
const btnOpen = document.getElementById("btn-open");
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
const runPill = document.getElementById("run-pill");
const imageStatus = document.getElementById("image-status");
const statElapsed = document.getElementById("stat-elapsed");
const statEvents = document.getElementById("stat-events");
const filterInputs = [...document.querySelectorAll(".event-controls input[type='checkbox']")];
const promptChips = [...document.querySelectorAll("[data-prompt]")];
const revisionChips = [...document.querySelectorAll("[data-revision]")];

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

const STATUS_LABELS = {
  start: "进行中",
  running: "进行中",
  done: "完成",
  warn: "警告",
  error: "异常",
  pending: "等待",
};

const stageState = new Map();
let eventCount = 0;
let runStart = 0;
let timer = null;
let currentResult = null;
let autoScrollEvents = true;
let previewLoadTimer = null;
let previewFallbackUrl = "";

init();

async function init() {
  renderStages();
  updateProgress();
  filterInputs.forEach((input) => input.addEventListener("change", applyFilters));
  eventList.addEventListener("scroll", handleEventScroll);
  promptChips.forEach((chip) => chip.addEventListener("click", () => applyPromptChip(chip)));
  revisionChips.forEach((chip) => chip.addEventListener("click", () => applyRevisionChip(chip)));

  try {
    const res = await fetch("/api/status");
    const data = await res.json();
    statusPill.textContent = data.llm ? `${data.model || "LLM"} 已连接` : "Mock 模式";
    statusPill.classList.toggle("ready", Boolean(data.llm));
    statusPill.classList.toggle("warn", !data.llm);

    const image = data.image || {};
    imageStatus.textContent = image.configured
      ? image.autoGenerate ? `${image.model || "image"} 自动` : `${image.model || "image"} 手动`
      : "未配置";
  } catch {
    statusPill.textContent = "连接失败";
    statusPill.classList.add("error");
    imageStatus.textContent = "未知";
  }
}

btnCreate.addEventListener("click", async () => {
  const prompt = promptEl.value.trim();
  if (!prompt) {
    promptEl.focus();
    agentSummary.textContent = "请先输入演示需求";
    return;
  }

  resetRun();
  setRunState("running", "生成中");
  btnCreate.disabled = true;
  btnCreateLabel.textContent = "生成中...";
  btnCreateSub.textContent = "实时运行 Agent 管线";

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
      kind: "error",
      message: err.message || String(err),
      elapsedMs: Date.now() - runStart,
    });
    agentHeading.textContent = "生成失败";
    agentSummary.textContent = "请求失败，保留输入后可重新生成";
    setRunState("error", "失败");
  } finally {
    btnCreate.disabled = false;
    btnCreateLabel.textContent = "生成演示文稿";
    btnCreateSub.textContent = "规划 · 生成 · QA · 导出";
    stopTimer();
  }
});

btnRevise.addEventListener("click", async () => {
  if (!currentResult?.runId) return;

  const pageIndex = parseInt(revisionPageEl.value, 10);
  const instruction = revisionInstructionEl.value.trim();
  if (!Number.isInteger(pageIndex) || pageIndex < 1) {
    revisionPageEl.focus();
    return;
  }
  if (!instruction) {
    revisionInstructionEl.focus();
    return;
  }

  btnRevise.disabled = true;
  btnRevise.textContent = "修订中...";
  resultSummary.textContent = `正在修订第 ${pageIndex} 页...`;
  setRunState("running", "修订中");
  addEvent({
    type: "progress",
    status: "start",
    step: "revise",
    kind: "tool",
    pageIndex,
    message: "提交单页修订，并重新生成预览、QA 与导出产物。",
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
      message: `修订完成，QA 分数 ${data.qa?.score ?? "-"}`,
      elapsedMs: Date.now() - runStart,
    });
    setRunState("done", "已完成");
    showResult(data);
  } catch (err) {
    addEvent({
      type: "error",
      status: "error",
      step: "revise",
      kind: "error",
      pageIndex,
      message: err.message || String(err),
      elapsedMs: Date.now() - runStart,
    });
    resultSummary.textContent = "修订失败，输入已保留";
    setRunState("error", "修订失败");
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
    agentHeading.textContent = "生成完成";
    agentSummary.textContent = "已完成预览、QA 和导出";
    markStage("report", "done", "完成");
    setRunState("done", "已完成");
    return;
  }

  if (event.type === "error") {
    agentHeading.textContent = "生成失败";
    agentSummary.textContent = event.message || "Agent 运行异常";
    setRunState("error", "失败");
    return;
  }

  const rootStep = normalizeStage(event.step);
  if (rootStep) {
    markStage(rootStep, event.status, event.detail || event.message || "");
  }

  if (event.kind === "llm" && event.status === "start") {
    agentHeading.textContent = "正在调用模型";
    agentSummary.textContent = event.message || "模型正在生成结构化内容";
  } else if (event.kind === "tool" && event.status === "start") {
    agentHeading.textContent = "正在执行工具";
    agentSummary.textContent = event.message || "工具正在处理产物";
  } else if (event.kind === "qa") {
    agentHeading.textContent = "正在运行 QA";
    agentSummary.textContent = event.message || "浏览器正在检查页面质量";
  } else if (event.kind === "repair") {
    agentHeading.textContent = "正在修复页面";
    agentSummary.textContent = event.message || "Agent 正在处理 QA 问题";
  } else if (rootStep && event.status === "start") {
    agentHeading.textContent = STAGES.find(([id]) => id === rootStep)?.[1] || "Agent 运行中";
    agentSummary.textContent = event.message || event.detail || "阶段进行中";
  }
}

function showResult(result) {
  if (!result?.previewUrl) return;

  currentResult = result;
  emptyPanel.hidden = true;
  livePanel.hidden = true;
  previewPanel.hidden = false;
  agentPanel.hidden = false;

  revisionPageEl.max = String(result.totalPages || 1);
  if (!revisionPageEl.value || Number(revisionPageEl.value) > (result.totalPages || 1)) {
    revisionPageEl.value = "1";
  }

  setDownloadLink(btnHtml, result.previewUrl);
  setDownloadLink(btnOpen, result.previewUrl);
  setDownloadLink(btnPptx, result.pptxUrl);
  setDownloadLink(btnPdf, result.pdfUrl);
  updateQABadge(result.qa);

  resultSummary.textContent = "预览加载中...";
  previewFallback.hidden = true;
  previewShell.classList.remove("error", "has-image");
  previewShell.classList.add("loading");
  previewImage.hidden = true;
  previewImage.removeAttribute("src");
  previewFrame.removeAttribute("src");
  previewFallbackUrl = firstScreenshotUrl(result);

  window.clearTimeout(previewLoadTimer);
  previewLoadTimer = window.setTimeout(() => {
    if (previewShell.classList.contains("loading")) {
      setPreviewError("预览加载较慢，已切换到 QA 截图预览。");
    }
  }, 12000);

  previewFrame.onload = () => {
    window.clearTimeout(previewLoadTimer);
    if (isEmbeddedPreviewReady()) {
      previewShell.classList.remove("loading", "error", "has-image");
      previewImage.hidden = true;
      previewFallback.hidden = true;
      resultSummary.textContent = `HTML 预览已就绪，QA 分数 ${result.qa?.score ?? "-"}`;
    } else {
      setPreviewError("HTML 预览未正确显示，已切换到 QA 截图预览。");
    }
  };
  previewFrame.onerror = () => setPreviewError("预览加载失败");
  previewFrame.src = `${result.previewUrl}?t=${Date.now()}`;

  loadRunDetail(result.runId);
}

function resetRun() {
  eventCount = 0;
  runStart = Date.now();
  currentResult = null;
  previewFallbackUrl = "";
  autoScrollEvents = true;
  emptyPanel.hidden = true;
  livePanel.hidden = false;
  agentPanel.hidden = false;
  previewPanel.hidden = true;
  qualityPanel.hidden = true;
  btnPptx.hidden = true;
  btnPdf.hidden = true;
  btnOpen.hidden = true;
  previewFrame.removeAttribute("src");
  previewImage.hidden = true;
  previewImage.removeAttribute("src");
  previewShell.classList.remove("error", "has-image");
  previewShell.classList.add("loading");
  previewFallback.hidden = true;
  eventList.innerHTML = "";
  agentHeading.textContent = "启动 Agent";
  agentSummary.textContent = "正在建立生成管线";
  eventModeLabel.textContent = "关键事件";
  stageState.clear();
  renderStages();
  updateProgress();
  startTimer();
  statEvents.textContent = "0 events";
  setQABadge("pending", "等待 QA");
}

async function loadRunDetail(runId) {
  if (!runId) return;
  try {
    const res = await fetch(`/api/runs/${encodeURIComponent(runId)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    renderRunDetail(await res.json());
  } catch (err) {
    renderRunDetail({
      qa: currentResult?.qa,
      screenshots: screenshotFilesFromResult(currentResult),
      assets: [],
      revisions: [],
      detailError: err.message || String(err),
    });
  }
}

function renderRunDetail(detail) {
  qualityPanel.hidden = false;
  renderQA(detail.qa || currentResult?.qa);
  if (detail.detailError) {
    qaList.insertAdjacentHTML("beforeend", `<li><strong class="warn">DETAIL</strong>详情接口不可用，已使用本次生成结果降级展示：${escapeHTML(detail.detailError)}</li>`);
  }
  renderGallery(screenshotGallery, detail.screenshots || [], "截图", { selectable: true });
  screenshotSummary.textContent = `${(detail.screenshots || []).length} 张`;
  const screenshotUrl = firstScreenshotUrl(detail);
  if (screenshotUrl) {
    previewFallbackUrl = screenshotUrl;
    if (previewShell.classList.contains("error")) {
      showPreviewImage(screenshotUrl, `QA 截图预览已就绪，分数 ${(detail.qa || currentResult?.qa)?.score ?? "-"}`);
    }
  }
  renderGallery(assetGallery, detail.assets || [], "资产", { selectable: false });
  assetSummary.textContent = `${(detail.assets || []).length} 个`;
  renderRevisions(detail.revisions || []);
}

function screenshotFilesFromResult(result) {
  const screenshots = result?.qa?.screenshots || [];
  return screenshots.map((rawUrl, index) => ({
    name: `slide-${String(index + 1).padStart(2, "0")}.png`,
    url: normalizeAssetUrl(rawUrl),
    bytes: undefined,
    pageIndex: index + 1,
  })).filter((file) => file.url);
}

function normalizeAssetUrl(value) {
  const url = String(value || "");
  if (url.startsWith("/runs/") || url.startsWith("http://") || url.startsWith("https://")) return url;
  const match = url.replaceAll("\\", "/").match(/\/runs\/(.+)$/);
  return match ? `/runs/${match[1]}` : "";
}

function firstScreenshotUrl(source) {
  const fromFiles = source?.screenshots?.find?.((item) => item?.url)?.url;
  if (fromFiles) return normalizeAssetUrl(fromFiles);
  const fromQA = source?.qa?.screenshots?.find?.((item) => item);
  return fromQA ? normalizeAssetUrl(fromQA) : "";
}

function showPreviewImage(url, summary) {
  if (!url) return;
  window.clearTimeout(previewLoadTimer);
  previewImage.src = `${url}?t=${Date.now()}`;
  previewImage.hidden = false;
  previewFallback.hidden = true;
  previewShell.classList.remove("loading", "error");
  previewShell.classList.add("has-image");
  resultSummary.textContent = summary;
}

function isEmbeddedPreviewReady() {
  try {
    const doc = previewFrame.contentDocument;
    if (!doc) return true;
    const activeSlide = doc.querySelector(".slide.active");
    if (activeSlide) {
      return activeSlide.textContent.trim().length > 0;
    }
    const bodyText = doc.body?.textContent?.trim() || "";
    return bodyText.length > 0 && !bodyText.includes("404 Not Found");
  } catch {
    return true;
  }
}

function renderQA(qa) {
  updateQABadge(qa);

  if (!qa) {
    qaSummary.textContent = "无 QA 数据";
    qaList.innerHTML = `<li><strong class="warn">EMPTY</strong>当前结果没有 QA 数据。</li>`;
    return;
  }

  const checks = qa.checks || [];
  const failCount = checks.filter((check) => check.status === "fail").length;
  const warnCount = checks.filter((check) => check.status === "warn").length;
  qaSummary.textContent = `score ${qa.score ?? "-"} | fail ${failCount} | warn ${warnCount}`;

  if (checks.length === 0) {
    qaList.innerHTML = `<li><strong class="pass">PASS</strong>未发现 QA 问题，可以下载交付。</li>`;
    return;
  }

  const sorted = checks.slice().sort((a, b) => severityRank(a.status) - severityRank(b.status));
  qaList.innerHTML = sorted.map((check) => `
    <li data-page="${escapeHTML(check.pageIndex || "")}">
      <strong class="${escapeHTML(check.status)}">${escapeHTML(check.status).toUpperCase()}</strong>
      ${check.pageIndex ? `P${escapeHTML(check.pageIndex)} ` : ""}${escapeHTML(check.id || check.name)}:
      ${escapeHTML(check.message || "")}
    </li>
  `).join("");

  [...qaList.querySelectorAll("[data-page]")].forEach((item) => {
    item.addEventListener("click", () => {
      const page = Number(item.dataset.page);
      if (page) selectRevisionPage(page);
    });
  });
}

function renderGallery(container, files, label, options = {}) {
  if (!files.length) {
    container.innerHTML = `<div class="empty-list-item">${label}为空</div>`;
    return;
  }

  container.innerHTML = files.map((file, index) => {
    const pageIndex = file.pageIndex || index + 1;
    return `
      <a class="thumb" href="${escapeHTML(file.url)}" target="_blank" rel="noreferrer" data-page="${escapeHTML(pageIndex)}">
        <img src="${escapeHTML(file.url)}?t=${Date.now()}" alt="${escapeHTML(file.name || `${label} ${index + 1}`)}">
        <span><b>${escapeHTML(file.name || `${label} ${index + 1}`)}</b><em>${formatBytes(file.bytes)}</em></span>
      </a>
    `;
  }).join("");

  if (options.selectable) {
    [...container.querySelectorAll(".thumb")].forEach((thumb) => {
      thumb.addEventListener("click", (event) => {
        event.preventDefault();
        selectRevisionPage(Number(thumb.dataset.page));
        window.open(thumb.href, "_blank", "noreferrer");
      });
    });
    highlightSelectedThumb();
  }
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
  const normalized = status === "start" ? "running" : status;
  stageState.set(id, {
    status: normalized,
    detail: detail || current.detail || (status === "start" ? "进行中" : statusText(status)),
  });
  renderStages();
  updateProgress();
}

function updateProgress() {
  const done = STAGES.filter(([id]) => stageState.get(id)?.status === "done").length;
  const active = STAGES.filter(([id]) => ["running", "warn", "error"].includes(stageState.get(id)?.status)).length;
  const completed = Math.max(done, active ? done + 0.5 : done);
  const percent = Math.min(100, Math.round((completed / STAGES.length) * 100));
  progressFill.style.width = `${percent}%`;
  progressLabel.textContent = `${done} / ${STAGES.length} 阶段`;
}

function addEvent(event) {
  eventCount += 1;
  statEvents.textContent = `${eventCount} events`;

  const item = document.createElement("li");
  const kind = event.status === "error" ? "error" : normalizeKind(event.kind || event.type || "phase");
  item.className = `event-item ${kind} ${event.status === "error" ? "error" : ""}`;
  item.dataset.kind = kind;
  item.innerHTML = `
    <span class="event-time">${formatElapsed(event.elapsedMs)}</span>
    <span class="event-kind">${escapeHTML(kindLabel(kind))}</span>
    <div class="event-body">
      <strong>${escapeHTML(formatTitle(event))}</strong>
      <p>${escapeHTML(formatMessage(event))}</p>
    </div>
  `;

  eventList.appendChild(item);
  applyFilters();
  if (autoScrollEvents) eventList.scrollTop = eventList.scrollHeight;
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

function handleEventScroll() {
  const threshold = 18;
  autoScrollEvents = eventList.scrollHeight - eventList.scrollTop - eventList.clientHeight < threshold;
  eventModeLabel.textContent = autoScrollEvents ? "关键事件" : "已暂停自动滚动";
}

function normalizeStage(step) {
  if (!step) return null;
  if (step.startsWith("repair")) return "repair";
  if (step.startsWith("qa")) return "qa";
  if (step.startsWith("page") || step.includes("page-") || step.includes("page.")) return "pages";
  if (step.startsWith("artifact.") || step.startsWith("tool.") || step.startsWith("llm.") || step.startsWith("metric.")) return null;
  return STAGES.some(([id]) => id === step) ? step : null;
}

function normalizeKind(kind) {
  if (kind === "error") return "error";
  if (kind === "agent") return "phase";
  return ["phase", "llm", "tool", "artifact", "qa", "repair"].includes(kind) ? kind : "phase";
}

function kindLabel(kind) {
  return {
    phase: "阶段",
    llm: "模型",
    tool: "工具",
    artifact: "产物",
    qa: "QA",
    repair: "修复",
    error: "异常",
  }[kind] || kind;
}

function formatTitle(event) {
  const page = event.pageIndex ? `P${event.pageIndex} ` : "";
  const step = stepLabel(event.step || event.type);
  return `${page}${step} · ${statusText(event.status)}`;
}

function formatMessage(event) {
  const pieces = [];
  if (event.message) pieces.push(event.message);
  if (event.detail) pieces.push(event.detail);
  if (event.stepElapsedMs) pieces.push(`${event.stepElapsedMs}ms`);
  return pieces.join(" | ") || "-";
}

function stepLabel(step) {
  if (!step) return "事件";
  const normalized = normalizeStage(step);
  if (normalized) return STAGES.find(([id]) => id === normalized)?.[1] || step;
  const labels = {
    agent: "Agent",
    frontend: "前端请求",
    revise: "单页修订",
  };
  return labels[step] || step.replace(/^llm\./, "模型.").replace(/^tool\./, "工具.").replace(/^artifact\./, "产物.");
}

function statusClass(status) {
  if (status === "done") return "done";
  if (status === "warn") return "warn";
  if (status === "error") return "error";
  if (status === "running" || status === "start") return "running";
  return "";
}

function statusText(status) {
  return STATUS_LABELS[status] || "等待";
}

function updateQABadge(qa) {
  if (!qa) {
    setQABadge("pending", "等待 QA");
    return;
  }
  const checks = qa.checks || [];
  const failCount = checks.filter((check) => check.status === "fail").length;
  const warnCount = checks.filter((check) => check.status === "warn").length;
  if (failCount > 0 || qa.passed === false) {
    setQABadge("bad", `失败 · ${failCount} fail`);
  } else if (warnCount > 0 || Number(qa.score) < 0.92) {
    setQABadge("warn", `需修订 · ${warnCount} warn`);
  } else {
    setQABadge("good", `可交付 · ${qa.score ?? "-"}`);
  }
}

function setQABadge(state, text) {
  qaBadge.className = `qa-badge ${state}`;
  qaBadge.textContent = text;
}

function setRunState(state, text) {
  runPill.className = `status-pill run ${state}`;
  runPill.textContent = text;
}

function setDownloadLink(node, url) {
  if (url) {
    node.href = url;
    node.hidden = false;
  } else {
    node.removeAttribute("href");
    node.hidden = true;
  }
}

function setPreviewError(message) {
  window.clearTimeout(previewLoadTimer);
  if (previewFallbackUrl) {
    showPreviewImage(previewFallbackUrl, message);
    return;
  }
  previewShell.classList.remove("loading", "has-image");
  previewShell.classList.add("error");
  previewImage.hidden = true;
  previewFallback.hidden = false;
  resultSummary.textContent = message;
}

function selectRevisionPage(pageIndex) {
  if (!Number.isInteger(pageIndex) || pageIndex < 1) return;
  revisionPageEl.value = String(pageIndex);
  highlightSelectedThumb();
}

function highlightSelectedThumb() {
  const selected = Number(revisionPageEl.value);
  [...screenshotGallery.querySelectorAll(".thumb")].forEach((thumb) => {
    thumb.classList.toggle("selected", Number(thumb.dataset.page) === selected);
  });
}

revisionPageEl.addEventListener("change", highlightSelectedThumb);

function applyPromptChip(chip) {
  promptEl.value = chip.dataset.prompt || "";
  promptEl.focus();
}

function applyRevisionChip(chip) {
  const text = chip.dataset.revision || "";
  const current = revisionInstructionEl.value.trim();
  revisionInstructionEl.value = current ? `${current}\n${text}` : text;
  revisionInstructionEl.focus();
}

function severityRank(status) {
  if (status === "fail") return 0;
  if (status === "warn") return 1;
  return 2;
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
