/**
 * Report Generator - Markdown summary of the generation run.
 */

import type { QAResult } from "../schemas.js";

export interface ReportData {
  runId: string;
  topic: string;
  totalPages: number;
  style: string;
  qa: QAResult;
  pdfPath?: string;
  pptxPath?: string;
}

export function generateReport(data: ReportData): string {
  const { runId, topic, totalPages, style, qa, pdfPath, pptxPath } = data;
  const status = qa.passed ? "SUCCESS" : "NEEDS_REPAIR";

  const qaLines = qa.checks.length > 0
    ? qa.checks.map((c) => `- [${c.status.toUpperCase()}] ${c.name}${c.message ? `: ${c.message}` : ""}${c.pageIndex ? ` (page ${c.pageIndex})` : ""}`).join("\n")
    : "- All checks passed";

  return `# SlidePilot Report

## Run: ${runId}
- Status: **${status}**
- Score: ${qa.score}

## Topic
${topic}

## Output
- Pages: ${totalPages}
- Style: ${style}
- Preview: preview.html
${pdfPath ? "- PDF: deck.pdf" : "- PDF: not exported"}
${pptxPath ? "- PPTX: deck.pptx" : "- PPTX: not exported"}
- Screenshots: png/

## QA Result
${qaLines}

## Artifacts
\`\`\`
${runId}/
|-- outline.json
|-- style.json
|-- global.css
|-- planning/
|   \`-- planning-01..${String(totalPages).padStart(2, "0")}.json
|-- slides/
|   \`-- slide-01..${String(totalPages).padStart(2, "0")}.html
|-- png/
|   \`-- slide-01..${String(totalPages).padStart(2, "0")}.png
|-- preview.html
|-- deck.pdf
|-- deck.pptx
\`-- report.md
\`\`\`
`;
}
