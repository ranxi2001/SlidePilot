import { renderTemplate } from "../src/prompts/harness.js";

const result = renderTemplate("outline", {
  TOPIC: "AI Agent 的发展趋势",
  AUDIENCE: "本科生",
  GOAL: "理解 Agent 的核心概念和应用",
  PAGE_COUNT: "8",
  LANGUAGE: "zh-CN",
  TONE: "clear",
});

console.log("=== Rendered outline prompt ===");
console.log(result.slice(0, 400));
console.log("...");
console.log(`\nTotal: ${result.length} chars\n`);

// Test page-planning template
const planResult = renderTemplate("page-planning", {
  DECK_TITLE: "AI Agent 的发展趋势",
  PAGE_INDEX: "3",
  TOTAL_PAGES: "8",
  PAGE_TITLE: "什么是 AI Agent",
  PAGE_TYPE: "content",
  PAGE_PURPOSE: "解释 Agent 核心概念",
  DENSITY: "medium",
  LANGUAGE: "zh-CN",
  OUTLINE_CONTEXT: "前一页介绍了背景，下一页是对比分析",
  MAX_BULLETS: "5",
  MAX_CARDS: "4",
});

console.log("=== Rendered page-planning prompt ===");
console.log(planResult.slice(0, 300));
console.log("...");
console.log(`Total: ${planResult.length} chars`);
