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
  const baseURL = process.env.LLM_BASE_URL || "";
  const apiKey = process.env.LLM_API_KEY || "";
  const model = process.env.LLM_MODEL || "";
  const maxTokens = Number(process.env.LLM_MAX_TOKENS) || 4096;
  const temperature = Number(process.env.LLM_TEMPERATURE) || 0.7;

  return { baseURL, apiKey, model, maxTokens, temperature };
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

  return response.choices[0]?.message?.content || "";
}

export async function chatJSON<T = unknown>(messages: ChatMessage[]): Promise<T> {
  const raw = await chat(messages, { json: true });
  return JSON.parse(raw) as T;
}
