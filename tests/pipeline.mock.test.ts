import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runPipeline, type ProgressKind, type ProgressStatus } from "../src/agent/orchestrator.js";
import { forceMockMode } from "./test-utils.js";

let restoreEnv: (() => void) | undefined;

beforeEach(() => {
  restoreEnv = forceMockMode();
});

afterEach(() => {
  restoreEnv?.();
});

describe("mock pipeline", () => {
  it("generates a complete deck without using an LLM", async () => {
    const events: Array<{
      step: string;
      status: ProgressStatus;
      detail?: string;
      kind?: ProgressKind;
      pageIndex?: number;
    }> = [];

    const result = await runPipeline(
      {
        prompt: "Harness engineering overview",
        pages: 4,
        style: "minimal",
        language: "en",
      },
      (step, status, detail, meta) => {
        events.push({ step, status, detail, kind: meta?.kind, pageIndex: meta?.pageIndex });
      },
    );

    expect(result.totalPages).toBe(4);
    expect(result.previewUrl).toMatch(/^\/runs\//);
    expect(result.pdfUrl).toMatch(/^\/runs\//);
    expect(result.pptxUrl).toMatch(/^\/runs\//);
    expect(result.qa.screenshots).toHaveLength(4);
    expect(events.some((event) => event.step === "requirement" && event.detail === "mock")).toBe(true);
    expect(events.some((event) => event.step === "pages" && event.status === "done")).toBe(true);
    expect(events.some((event) => event.kind === "qa")).toBe(true);
    expect(events.some((event) => event.kind === "artifact")).toBe(true);
    expect(events.some((event) => event.step === "pptx" && event.status === "done")).toBe(true);
  }, 120_000);
});
