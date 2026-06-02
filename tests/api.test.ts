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
    expect(data).toMatchObject({
      llm: false,
      model: null,
      baseURL: null,
      image: {
        configured: false,
        model: null,
        baseURL: null,
        autoGenerate: false,
        maxImagesPerRun: 0,
      },
    });
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

  it("revises a single generated slide in mock mode", async () => {
    const app = createApiTestApp();
    const createRes = await app.fetch(createDeckRequest());
    const created = await createRes.json();

    expect(createRes.status).toBe(200);
    expect(created.runId).toBeTruthy();

    const reviseRes = await app.fetch(new Request(`http://local/api/runs/${created.runId}/slides/2/revise`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instruction: "Make this slide more concise and add a visible revision marker." }),
    }));
    const revised = await reviseRes.json();

    expect(reviseRes.status).toBe(200);
    expect(revised.runId).toBe(created.runId);
    expect(revised.revisedPage).toBe(2);
    expect(revised.previewUrl).toBe(`/runs/${created.runId}/preview.html`);
    expect(revised.pptxUrl).toBe(`/runs/${created.runId}/deck.pptx`);
    expect(revised.qa.screenshots).toHaveLength(4);

    const detailRes = await app.fetch(new Request(`http://local/api/runs/${created.runId}`));
    const detail = await detailRes.json();

    expect(detailRes.status).toBe(200);
    expect(detail.runId).toBe(created.runId);
    expect(detail.qa.checks).toEqual(expect.any(Array));
    expect(detail.screenshots).toHaveLength(4);
    expect(detail.screenshots[0].url).toMatch(/^\/runs\//);
    expect(detail.revisions).toHaveLength(1);
    expect(JSON.stringify(detail)).not.toContain("C:\\");
  }, 120_000);

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

  it("adapts the image generation API and stores returned PNG assets", async () => {
    const previousFetch = globalThis.fetch;
    process.env.IMAGE_BASE_URL = "https://image.local/v1";
    process.env.IMAGE_API_KEY = "test-key";
    process.env.IMAGE_MODEL = "gpt-image-2";
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("https://image.local/v1/images/generations");
      expect(init?.method).toBe("POST");
      const body = JSON.parse(String(init?.body));
      expect(body).toMatchObject({
        model: "gpt-image-2",
        prompt: "a clean product illustration",
        n: 1,
        size: "1024x1024",
      });
      return new Response(JSON.stringify({
        data: [{ b64_json: "iVBORw0KGgo=" }],
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    };

    try {
      const app = createApiTestApp();
      const res = await app.fetch(new Request("http://local/api/images/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "a clean product illustration", size: "1024x1024" }),
      }));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.images).toHaveLength(1);
      expect(data.images[0]).toMatchObject({
        model: "gpt-image-2",
        size: "1024x1024",
      });
      expect(data.images[0].url).toMatch(/^\/runs\/.+\/assets\/generated-01\.png$/);
      expect(data.images[0].path).toBeUndefined();
    } finally {
      globalThis.fetch = previousFetch;
    }
  });

  it("enforces the per-run image asset limit", async () => {
    const previousFetch = globalThis.fetch;
    process.env.IMAGE_BASE_URL = "https://image.local/v1";
    process.env.IMAGE_API_KEY = "test-key";
    process.env.IMAGE_MODEL = "gpt-image-2";
    process.env.IMAGE_MAX_IMAGES_PER_RUN = "1";
    globalThis.fetch = async () => new Response(JSON.stringify({
      data: [{ b64_json: "iVBORw0KGgo=" }],
    }), { status: 200, headers: { "Content-Type": "application/json" } });

    try {
      const app = createApiTestApp();
      const runId = `limit-${Date.now()}`;
      const first = await app.fetch(new Request("http://local/api/images/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "first", runId }),
      }));
      const second = await app.fetch(new Request("http://local/api/images/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "second", runId }),
      }));
      const data = await second.json();

      expect(first.status).toBe(200);
      expect(second.status).toBe(500);
      expect(data.error).toContain("Image asset limit exceeded");
    } finally {
      globalThis.fetch = previousFetch;
    }
  });
});
