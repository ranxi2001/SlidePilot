import "dotenv/config";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { apiRoutes } from "./routes.js";
import { isConfigured, loadConfig } from "./llm/client.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const app = new Hono();

app.route("/api", apiRoutes);
app.use("/public/*", serveStatic({ root: ROOT }));
app.use("/runs/*", serveStatic({ root: process.cwd() }));
app.get("/", (c) => {
  const html = readFileSync(join(ROOT, "public", "index.html"), "utf-8");
  return c.html(html);
});

const port = Number(process.env.PORT) || 4321;

serve({ fetch: app.fetch, port }, () => {
  console.log(`SlidePilot running at http://127.0.0.1:${port}`);
  if (isConfigured()) {
    const cfg = loadConfig();
    console.log(`LLM: ${cfg.model} @ ${cfg.baseURL}`);
  } else {
    console.log(`LLM: not configured (using mock data). Copy .env.example → .env to enable.`);
  }
});

export default app;
