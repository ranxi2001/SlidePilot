import { Hono } from "hono";
import { createRequestSchema } from "./schemas.js";
import { isConfigured, loadConfig } from "./llm/client.js";
import { runPipeline, type ProgressEventMeta, type ProgressStatus } from "./agent/orchestrator.js";
import { listRuns } from "./storage/run-store.js";

export const apiRoutes = new Hono();

apiRoutes.get("/status", (c) => {
  const configured = isConfigured();
  const cfg = configured ? loadConfig() : null;
  return c.json({
    llm: configured,
    model: cfg?.model || null,
    baseURL: cfg?.baseURL || null,
  });
});

apiRoutes.post("/create", async (c) => {
  const body = await c.req.json();
  const parsed = createRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  try {
    const result = await runPipeline(parsed.data);
    return c.json(result);
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

apiRoutes.post("/create-stream", async (c) => {
  const body = await c.req.json();
  const parsed = createRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const encoder = new TextEncoder();
  const startedAt = Date.now();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`${JSON.stringify({
          ts: new Date().toISOString(),
          elapsedMs: Date.now() - startedAt,
          ...event,
        })}\n`));
      };

      send({
        type: "agent",
        status: "start",
        step: "agent",
        detail: "create-stream",
        kind: "phase",
        message: "Start SlidePilot agent run.",
      });

      try {
        const result = await runPipeline(parsed.data, (
          step: string,
          status: ProgressStatus,
          detail?: string,
          meta?: ProgressEventMeta,
        ) => {
          send({
            type: "progress",
            step,
            status,
            detail,
            kind: meta?.kind || "phase",
            message: meta?.message,
            pageIndex: meta?.pageIndex,
            stepElapsedMs: meta?.elapsedMs,
          });
        });

        send({
          type: "result",
          status: "done",
          step: "agent",
          kind: "artifact",
          message: "Slide deck generation completed.",
          result,
        });
      } catch (err) {
        send({
          type: "error",
          status: "error",
          step: "agent",
          kind: "phase",
          message: String(err),
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
    },
  });
});

apiRoutes.get("/runs", (c) => {
  return c.json({ runs: listRuns() });
});
