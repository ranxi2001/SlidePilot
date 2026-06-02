import { Hono } from "hono";
import { apiRoutes } from "../src/routes.js";

const LLM_ENV_KEYS = [
  "LLM_BASE_URL",
  "LLM_API_KEY",
  "LLM_MODEL",
  "LLM_MAX_TOKENS",
  "LLM_TEMPERATURE",
  "OPENAI_BASE_URL",
  "OPENAI_API_KEY",
  "OPENAI_MODEL",
  "IMAGE_BASE_URL",
  "IMAGE_API_KEY",
  "IMAGE_MODEL",
];

export function createApiTestApp(): Hono {
  const app = new Hono();
  app.route("/api", apiRoutes);
  return app;
}

export function forceMockMode(): () => void {
  const previous = new Map<string, string | undefined>();

  for (const key of LLM_ENV_KEYS) {
    previous.set(key, process.env[key]);
    delete process.env[key];
  }

  process.env.LLM_PAGE_CONCURRENCY = "2";
  process.env.LLM_REPAIR_CONCURRENCY = "1";
  process.env.LLM_MAX_REPAIR_ROUNDS = "1";

  return () => {
    for (const key of LLM_ENV_KEYS) {
      const value = previous.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };
}

export async function readNDJSON(response: Response): Promise<any[]> {
  const body = response.body;
  if (!body) return [];

  const reader = body.getReader();
  const decoder = new TextDecoder();
  const events: any[] = [];
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.trim()) events.push(JSON.parse(line));
    }
  }

  if (buffer.trim()) events.push(JSON.parse(buffer));
  return events;
}

export function createDeckRequest(overrides: Record<string, unknown> = {}): Request {
  return new Request("http://local/api/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: "Make a 4 page deck about prompt harness engineering.",
      pages: 4,
      style: "minimal",
      language: "en",
      ...overrides,
    }),
  });
}

export function createStreamRequest(overrides: Record<string, unknown> = {}): Request {
  return new Request("http://local/api/create-stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: "Make a 4 page deck about prompt harness engineering.",
      pages: 4,
      style: "minimal",
      language: "en",
      ...overrides,
    }),
  });
}
