/**
 * End-to-end pipeline test — runs the full orchestrator with mock data.
 */

import { runPipeline } from "../src/agent/orchestrator.js";

console.log("Running full pipeline...\n");

const result = await runPipeline(
  { prompt: "AI Agent 的发展趋势", pages: 8, style: "tech-dark", language: "zh-CN" },
  (step, status, detail) => {
    const icon = status === "done" ? "✓" : status === "error" ? "✗" : "⏳";
    console.log(`  ${icon} ${step}${detail ? ` (${detail})` : ""}`);
  },
);

console.log(`\nResult:`);
console.log(`  Run ID:   ${result.runId}`);
console.log(`  Pages:    ${result.totalPages}`);
console.log(`  QA Score: ${result.qa.score}`);
console.log(`  QA Pass:  ${result.qa.passed}`);
console.log(`  Preview:  ${result.previewUrl}`);
console.log(`  PDF:      ${result.pdfUrl || "none"}`);

if (result.qa.checks.length > 0) {
  console.log(`\n  QA Issues:`);
  for (const c of result.qa.checks) {
    console.log(`    [${c.status}] ${c.name}: ${c.message}`);
  }
}

console.log(`\n  Screenshots: ${result.qa.screenshots.length} files`);
