import { Hono } from "hono";
import { createRequestSchema } from "./schemas.js";
import { isConfigured, loadConfig } from "./llm/client.js";
import { runPipeline } from "./agent/orchestrator.js";
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

apiRoutes.get("/runs", (c) => {
  return c.json({ runs: listRuns() });
});
