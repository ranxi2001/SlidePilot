import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { generateRunId, getRunDir } from "../storage/run-store.js";
import type { ImageSize } from "../schemas.js";

export interface ImageToolConfig {
  baseURL: string;
  apiKey: string;
  model: string;
  autoGenerate: boolean;
  maxImagesPerRun: number;
}

export interface GeneratedImage {
  runId: string;
  path: string;
  url: string;
  model: string;
  size: ImageSize;
}

const DEFAULT_IMAGE_MODEL = "gpt-image-2";

export function loadImageToolConfig(): ImageToolConfig {
  const baseURL = normalizeBaseURL(
    process.env.IMAGE_BASE_URL ||
    process.env.LLM_BASE_URL ||
    process.env.OPENAI_BASE_URL ||
    "https://api.openai.com/v1",
  );
  const apiKey = process.env.IMAGE_API_KEY || process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || "";
  const model = process.env.IMAGE_MODEL || DEFAULT_IMAGE_MODEL;
  const autoGenerate = parseBool(process.env.IMAGE_AUTO_GENERATE, true);
  const maxImagesPerRun = clamp(Number(process.env.IMAGE_MAX_IMAGES_PER_RUN) || 8, 0, 50);
  return { baseURL, apiKey, model, autoGenerate, maxImagesPerRun };
}

export function isImageToolConfigured(): boolean {
  const cfg = loadImageToolConfig();
  return Boolean(cfg.baseURL && cfg.apiKey && cfg.model);
}

export function canAutoGenerateImages(): boolean {
  const cfg = loadImageToolConfig();
  return isImageToolConfigured() && cfg.autoGenerate && cfg.maxImagesPerRun > 0;
}

export async function generateImage(options: {
  prompt: string;
  size?: ImageSize;
  n?: number;
  runId?: string;
}): Promise<GeneratedImage[]> {
  const cfg = requireImageConfig();
  const size = options.size || "1024x1024";
  const n = options.n || 1;

  const response = await fetch(`${cfg.baseURL}/images/generations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      prompt: options.prompt,
      n,
      size,
    }),
  });

  const data = await response.json() as ImageResponse;
  if (!response.ok) {
    throw new Error(formatImageError(response.status, data));
  }

  return saveImageResponse({
    data,
    runId: options.runId || generateRunId("image-generation"),
    size,
    model: cfg.model,
    prefix: "generated",
  });
}

export async function editImage(options: {
  prompt: string;
  imagePath: string;
  size?: ImageSize;
  runId?: string;
}): Promise<GeneratedImage[]> {
  const cfg = requireImageConfig();
  const size = options.size || "1024x1024";
  if (!existsSync(options.imagePath)) {
    throw new Error(`Image file not found: ${options.imagePath}`);
  }

  const form = new FormData();
  form.set("model", cfg.model);
  form.set("prompt", options.prompt);
  form.set("size", size);
  form.set("image", new Blob([readFileSync(options.imagePath)]), basename(options.imagePath));

  const response = await fetch(`${cfg.baseURL}/images/edits`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${cfg.apiKey}`,
    },
    body: form,
  });

  const data = await response.json() as ImageResponse;
  if (!response.ok) {
    throw new Error(formatImageError(response.status, data));
  }

  const stem = basename(options.imagePath, extname(options.imagePath)).replace(/[^a-z0-9_-]+/gi, "-").slice(0, 40) || "image";
  return saveImageResponse({
    data,
    runId: options.runId || generateRunId("image-edit"),
    size,
    model: cfg.model,
    prefix: `edited-${stem}`,
  });
}

function requireImageConfig(): ImageToolConfig {
  const cfg = loadImageToolConfig();
  if (!cfg.baseURL || !cfg.apiKey || !cfg.model) {
    throw new Error("Image tool not configured. Set IMAGE_API_KEY or LLM_API_KEY plus IMAGE_BASE_URL/LLM_BASE_URL.");
  }
  return cfg;
}

function saveImageResponse(options: {
  data: ImageResponse;
  runId: string;
  size: ImageSize;
  model: string;
  prefix: string;
}): GeneratedImage[] {
  const items = options.data.data || [];
  if (items.length === 0) {
    throw new Error("Image API response did not include data[].");
  }

  const runDir = getRunDir(options.runId);
  const assetDir = join(runDir, "assets");
  if (!existsSync(assetDir)) mkdirSync(assetDir, { recursive: true });
  enforceImageLimit(assetDir, items.length);

  return items.map((item, index) => {
    if (!item.b64_json) {
      throw new Error("Image API response did not include data[].b64_json.");
    }
    const name = `${options.prefix}-${String(index + 1).padStart(2, "0")}.png`;
    const path = join(assetDir, name);
    writeFileSync(path, Buffer.from(item.b64_json, "base64"));
    return {
      runId: options.runId,
      path,
      url: `/runs/${options.runId}/assets/${name}`,
      model: options.model,
      size: options.size,
    };
  });
}

function normalizeBaseURL(baseURL: string): string {
  const trimmed = baseURL.trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  if (trimmed === "https://api.openai.com") return "https://api.openai.com/v1";
  return trimmed;
}

function enforceImageLimit(assetDir: string, incomingCount: number): void {
  const cfg = loadImageToolConfig();
  if (cfg.maxImagesPerRun <= 0) {
    throw new Error("Image generation disabled by IMAGE_MAX_IMAGES_PER_RUN=0.");
  }

  const existing = existsSync(assetDir)
    ? readImageNames(assetDir).length
    : 0;
  if (existing + incomingCount > cfg.maxImagesPerRun) {
    throw new Error(`Image asset limit exceeded for this run (${existing}+${incomingCount}/${cfg.maxImagesPerRun}).`);
  }
}

function readImageNames(assetDir: string): string[] {
  return existsSync(assetDir)
    ? readdirSync(assetDir).filter((name) => /\.(png|jpg|jpeg|webp)$/i.test(name))
    : [];
}

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === "") return fallback;
  return !["0", "false", "no", "off"].includes(value.toLowerCase());
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function formatImageError(status: number, data: ImageResponse): string {
  const message = data?.error?.message || JSON.stringify(data).slice(0, 240);
  return `Image API failed (${status}): ${message}`;
}

interface ImageResponse {
  data?: Array<{ b64_json?: string }>;
  error?: { message?: string };
}
