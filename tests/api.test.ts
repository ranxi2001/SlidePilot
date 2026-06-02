import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApiTestApp, createDeckRequest, createStreamRequest, forceMockMode, readNDJSON } from "./test-utils.js";

let restoreEnv: (() => void) | undefined;

beforeEach(() => {
  restoreEnv = forceMockMode();
});

afterEach(() => {
  restoreEnv?.();
});

describe("api routes", () => {
  it("reports mock mode when no LLM environment is configured", async () => {
    const app = createApiTestApp();
    const res = await app.fetch(new Request("http://local/api/status"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({ llm: false, model: null, baseURL: null });
  });

  it("rejects invalid create payloads", async () => {
    const app = createApiTestApp();
    const res = await app.fetch(createDeckRequest({ pages: 2 }));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error.fieldErrors.pages?.[0]).toContain("greater than or equal to 4");
  });

  it("lists run directories", async () => {
    const app = createApiTestApp();
    const res = await app.fetch(new Request("http://local/api/runs"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(Array.isArray(data.runs)).toBe(true);
  });

  it("streams observable agent events in mock mode", async () => {
    const app = createApiTestApp();
    const res = await app.fetch(createStreamRequest());
    const events = await readNDJSON(res);

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/x-ndjson");
    expect(events[0]).toMatchObject({ type: "agent", status: "start", step: "agent" });
    expect(events.some((event) => event.type === "progress" && event.kind === "thought")).toBe(true);
    expect(events.some((event) => event.kind === "artifact")).toBe(true);
    expect(events.some((event) => event.type === "progress" && event.step === "pptx")).toBe(true);
    expect(events.at(-1)).toMatchObject({ type: "result", status: "done" });
    expect(events.at(-1).result.previewUrl).toMatch(/^\/runs\//);
    expect(events.at(-1).result.pptxUrl).toMatch(/^\/runs\//);
  }, 120_000);
});
