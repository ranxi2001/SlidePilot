import { describe, it, expect } from "vitest";
import { runPipeline } from "../src/agent/orchestrator.js";

describe("Pipeline (mock mode)", () => {
  it("generates a complete deck with all artifacts", async () => {
    const result = await runPipeline({
      prompt: "AI Agent 的发展趋势",
      pages: 8,
      style: "tech-dark",
      language: "zh-CN",
    });

    expect(result.runId).toBeTruthy();
    expect(result.totalPages).toBe(8);
    expect(result.previewUrl).toContain("/preview.html");
    expect(result.pdfUrl).toContain("/deck.pdf");
    expect(result.qa.passed).toBe(true);
    expect(result.qa.score).toBeGreaterThanOrEqual(0.8);
    expect(result.qa.screenshots.length).toBe(8);
  });

  it("respects custom page count", async () => {
    const result = await runPipeline({
      prompt: "简短报告",
      pages: 4,
      style: "minimal",
      language: "zh-CN",
    });

    expect(result.totalPages).toBe(4);
    expect(result.qa.screenshots.length).toBe(4);
  });
});
