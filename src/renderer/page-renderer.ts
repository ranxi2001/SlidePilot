/**
 * Page Renderer — wraps per-page HTML content into a self-contained 1280x720 page.
 *
 * In the full pipeline, the LLM generates the inner HTML for each page.
 * This module provides:
 * 1. The page shell (viewport, global.css injection)
 * 2. A fallback renderer that turns PagePlanning into HTML without LLM (for testing)
 */

import type { PagePlanning } from "../schemas.js";

export function wrapPageHTML(innerHTML: string, globalCSS: string, pageIndex: number, totalPages: number): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=1280">
<style>${globalCSS}</style>
</head>
<body>
${innerHTML}
<span class="page-number">${pageIndex} / ${totalPages}</span>
</body>
</html>`;
}

/**
 * Fallback renderer: turns a PagePlanning into inner HTML.
 * Used when LLM is not connected. Produces reasonable defaults.
 */
export function renderPageFromPlanning(planning: PagePlanning): string {
  const blocks = planning.contentBlocks || [];
  const parts: string[] = [];

  // Page container with appropriate layout
  const layoutStyle = getLayoutStyle(planning.pageType, planning.layoutHint);
  parts.push(`<div style="${layoutStyle}">`);

  for (const block of blocks) {
    switch (block.type) {
      case "heading":
        parts.push(`  <h1>${block.content}</h1>`);
        break;
      case "subheading":
        parts.push(`  <h3>${block.content}</h3>`);
        break;
      case "bullets": {
        const items = Array.isArray(block.content) ? block.content : [];
        parts.push(`  <ul>`);
        for (const item of items) {
          parts.push(`    <li>${item}</li>`);
        }
        parts.push(`  </ul>`);
        break;
      }
      case "paragraph":
        parts.push(`  <p>${block.content}</p>`);
        break;
      case "card": {
        const cards = Array.isArray(block.content) ? block.content : [];
        const cols = cards.length <= 2 ? cards.length : cards.length <= 4 ? 2 : 3;
        parts.push(`  <div style="display:grid;grid-template-columns:repeat(${cols},1fr);gap:16px;margin-top:20px;">`);
        for (const card of cards) {
          const c = card as { title?: string; desc?: string };
          parts.push(`    <div class="card">`);
          if (c.title) parts.push(`      <div style="font-weight:650;margin-bottom:0.3em;">${c.title}</div>`);
          if (c.desc) parts.push(`      <div style="opacity:0.65;font-size:0.9em;line-height:1.5;">${c.desc}</div>`);
          parts.push(`    </div>`);
        }
        parts.push(`  </div>`);
        break;
      }
      case "metric": {
        const metrics = Array.isArray(block.content) ? block.content : [];
        parts.push(`  <div style="display:flex;gap:48px;margin-top:28px;">`);
        for (const m of metrics) {
          const metric = m as { value?: string; label?: string };
          parts.push(`    <div style="text-align:center;">`);
          parts.push(`      <div class="metric-value">${metric.value || ""}</div>`);
          parts.push(`      <div class="metric-label">${metric.label || ""}</div>`);
          parts.push(`    </div>`);
        }
        parts.push(`  </div>`);
        break;
      }
      case "timeline": {
        const items = Array.isArray(block.content) ? block.content : [];
        parts.push(`  <div style="margin-top:20px;padding-left:24px;border-left:3px solid var(--accent);display:flex;flex-direction:column;gap:18px;">`);
        for (const item of items) {
          const t = item as { label?: string; desc?: string };
          parts.push(`    <div style="position:relative;">`);
          parts.push(`      <div style="position:absolute;left:-31px;top:5px;width:10px;height:10px;border-radius:50%;background:var(--accent);"></div>`);
          parts.push(`      <div style="font-weight:650;">${t.label || ""}</div>`);
          parts.push(`      <div style="opacity:0.6;font-size:0.9em;">${t.desc || ""}</div>`);
          parts.push(`    </div>`);
        }
        parts.push(`  </div>`);
        break;
      }
      case "quote":
        parts.push(`  <div style="text-align:center;max-width:700px;margin:0 auto;">`);
        parts.push(`    <div style="font-size:4em;opacity:0.15;line-height:1;font-family:Georgia,serif;">"</div>`);
        parts.push(`    <p style="font-size:1.4em;font-style:italic;line-height:1.6;">${block.content}</p>`);
        parts.push(`  </div>`);
        break;
      case "visual":
        parts.push(renderVisualBlock(block.content));
        break;
    }
  }

  parts.push(`</div>`);
  return parts.join("\n");
}

function renderVisualBlock(content: unknown): string {
  if (content && typeof content === "object" && "assetUrl" in content) {
    const visual = content as { assetUrl?: string; alt?: string; prompt?: string };
    const alt = escapeHTML(visual.alt || visual.prompt || "Generated visual");
    return `  <figure style="margin-top:20px;display:flex;flex-direction:column;gap:10px;max-height:360px;">
    <img src="${escapeHTML(visual.assetUrl || "")}" alt="${alt}" style="width:100%;max-height:320px;object-fit:cover;border-radius:12px;border:1px solid var(--card-border);">
  </figure>`;
  }

  return `  <div style="margin-top:20px;padding:32px;border:2px dashed rgba(128,128,128,0.2);border-radius:12px;text-align:center;opacity:0.5;">${escapeHTML(String(content ?? ""))}</div>`;
}

function escapeHTML(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getLayoutStyle(pageType: string, layoutHint: string): string {
  const base = "width:1280px;height:720px;padding:56px 72px;display:flex;flex-direction:column;position:relative;overflow:hidden;";

  if (pageType === "cover" || pageType === "end" || layoutHint.includes("center")) {
    return base + "justify-content:center;align-items:center;text-align:center;";
  }
  if (pageType === "section") {
    return base + "justify-content:center;";
  }
  return base + "justify-content:center;";
}
