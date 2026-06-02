const btnCreate = document.getElementById("btn-create");
const promptEl = document.getElementById("prompt");
const styleEl = document.getElementById("style");
const pagesEl = document.getElementById("pages");
const progressPanel = document.getElementById("progress-panel");
const progressList = document.getElementById("progress-list");
const previewPanel = document.getElementById("preview-panel");
const previewFrame = document.getElementById("preview-frame");
const btnPdf = document.getElementById("btn-pdf");
const btnHtml = document.getElementById("btn-html");

btnCreate.addEventListener("click", async () => {
  const prompt = promptEl.value.trim();
  if (!prompt) return;

  progressPanel.hidden = false;
  previewPanel.hidden = true;
  progressList.innerHTML = "";
  btnCreate.disabled = true;

  try {
    const res = await fetch("/api/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        style: styleEl.value,
        pages: parseInt(pagesEl.value, 10),
      }),
    });

    const data = await res.json();

    if (data.previewUrl) {
      previewPanel.hidden = false;
      previewFrame.src = data.previewUrl;
      if (data.pdfUrl) {
        btnPdf.href = data.pdfUrl;
        btnPdf.hidden = false;
      }
      btnHtml.href = data.previewUrl;
    }

    addProgress("完成", true);
  } catch (err) {
    addProgress(`Error: ${err.message}`, false);
  } finally {
    btnCreate.disabled = false;
  }
});

function addProgress(text, done) {
  const li = document.createElement("li");
  li.textContent = text;
  if (done) li.classList.add("done");
  progressList.appendChild(li);
}
