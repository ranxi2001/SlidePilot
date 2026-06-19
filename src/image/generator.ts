/**
 * Image Generator — wrapper around baoyu-image-gen skill.
 *
 * Calls the baoyu-image-gen scripts to generate images for slides.
 * Falls back gracefully when the skill is not configured (returns placeholder path).
 */

import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

const exec = promisify(execFile);

const SKILL_DIR = resolve(process.cwd(), ".agents/skills/baoyu-image-gen");
const SCRIPT_PATH = join(SKILL_DIR, "scripts/main.ts");

export interface ImageGenRequest {
  prompt: string;
  outputDir: string;
  filename: string;
  aspectRatio?: string;
  provider?: string;
}

export interface ImageGenResult {
  success: boolean;
  path?: string;
  error?: string;
}

export function isImageGenAvailable(): boolean {
  return existsSync(SCRIPT_PATH);
}

export async function generateImage(request: ImageGenRequest): Promise<ImageGenResult> {
  if (!isImageGenAvailable()) {
    return { success: false, error: "baoyu-image-gen skill not available" };
  }

  const outputPath = join(request.outputDir, request.filename);
  const args = [
    SCRIPT_PATH,
    "--prompt", request.prompt,
    "--output", outputPath,
  ];

  if (request.aspectRatio) {
    args.push("--ar", request.aspectRatio);
  }
  if (request.provider) {
    args.push("--provider", request.provider);
  }

  try {
    const bunPath = process.env.BUN_PATH || "bunx";
    await exec(bunPath, args, {
      cwd: SKILL_DIR,
      timeout: 60_000,
      env: { ...process.env, NODE_ENV: "production" },
    });
    if (existsSync(outputPath)) {
      return { success: true, path: outputPath };
    }
    return { success: false, error: "Image file not created" };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function generateImagesForSlides(
  imageBlocks: Array<{ pageIndex: number; prompt: string; aspectRatio?: string }>,
  runDir: string,
): Promise<Map<number, string>> {
  const results = new Map<number, string>();
  const imgsDir = join(runDir, "imgs");
  const CONCURRENCY = 3;

  const queue = [...imageBlocks];
  async function worker() {
    while (queue.length > 0) {
      const block = queue.shift()!;
      const filename = `slide-${String(block.pageIndex).padStart(2, "0")}.png`;
      const result = await generateImage({
        prompt: block.prompt,
        outputDir: imgsDir,
        filename,
        aspectRatio: block.aspectRatio || "16:9",
      });
      if (result.success && result.path) {
        results.set(block.pageIndex, result.path);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, imageBlocks.length) }, () => worker()));
  return results;
}
