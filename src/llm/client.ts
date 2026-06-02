/**
 * LLM Client — thin wrapper over OpenAI-compatible API.
 *
 * Reads config from environment variables:
 *   LLM_BASE_URL  — API endpoint (supports OpenAI, DeepSeek, Ollama, vLLM, etc.)
 *   LLM_API_KEY   — API key
 *   LLM_MODEL     — model name
 *   LLM_MAX_TOKENS — max output tokens (default 4096)
 *   LLM_TEMPERATURE — temperature (default 0.7)
 */

import OpenAI from "openai";

export interface LLMConfig {
  baseURL: string;
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
}

export function loadConfig(): LLMConfig {
  const baseURL = normalizeBaseURL(process.env.LLM_BASE_URL || process.env.OPENAI_BASE_URL || "");
  const apiKey = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || "";
  const model = process.env.LLM_MODEL || process.env.OPENAI_MODEL || "";
  const maxTokens = Number(process.env.LLM_MAX_TOKENS) || 4096;
  const temperature = Number(process.env.LLM_TEMPERATURE) || 0.7;

  return { baseURL, apiKey, model, maxTokens, temperature };
}

function normalizeBaseURL(baseURL: string): string {
  const trimmed = baseURL.trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  if (trimmed === "https://api.openai.com") return "https://api.openai.com/v1";
  return trimmed;
}

export function isConfigured(): boolean {
  const cfg = loadConfig();
  return !!(cfg.baseURL && cfg.apiKey && cfg.model);
}

let _client: OpenAI | null = null;

export function getClient(): OpenAI {
  if (!_client) {
    const cfg = loadConfig();
    if (!cfg.baseURL || !cfg.apiKey) {
      throw new Error("LLM not configured. Copy .env.example to .env and fill in your API credentials.");
    }
    _client = new OpenAI({ baseURL: cfg.baseURL, apiKey: cfg.apiKey });
  }
  return _client;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function chat(messages: ChatMessage[], options?: { json?: boolean }): Promise<string> {
  const cfg = loadConfig();
  const client = getClient();

  const response = await client.chat.completions.create({
    model: cfg.model,
    messages,
    max_tokens: cfg.maxTokens,
    temperature: cfg.temperature,
    ...(options?.json ? { response_format: { type: "json_object" } } : {}),
  });

  const content = response.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error("LLM response did not include choices[0].message.content. Check LLM_BASE_URL includes the OpenAI-compatible /v1 path.");
  }
  return content;
}

export async function chatJSON<T = unknown>(messages: ChatMessage[]): Promise<T> {
  const raw = await chat(messages, { json: true });
  return JSON.parse(extractJSON(raw)) as T;
}

function extractJSON(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const text = fenced?.[1]?.trim() || trimmed;

  if (text.startsWith("{") || text.startsWith("[")) return text;

  const firstObject = text.indexOf("{");
  const lastObject = text.lastIndexOf("}");
  if (firstObject >= 0 && lastObject > firstObject) {
    return text.slice(firstObject, lastObject + 1);
  }

  const firstArray = text.indexOf("[");
  const lastArray = text.lastIndexOf("]");
  if (firstArray >= 0 && lastArray > firstArray) {
    return text.slice(firstArray, lastArray + 1);
  }

  throw new Error(`LLM response was not valid JSON: ${trimmed.slice(0, 160)}`);
}
