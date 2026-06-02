/**
 * Run Storage — per-page artifact management.
 *
 * Directory layout:
 *   runs/{runId}/
 *     manifest.json
 *     global.css
 *     outline.json
 *     style.json
 *     planning/
 *       planning-01.json
 *       planning-02.json
 *     slides/
 *       slide-01.html
 *       slide-02.html
 *     png/
 *       slide-01.png
 *       slide-02.png
 *     preview.html
 *     deck.pdf
 *     deck.pptx
 *     report.md
 */

import { existsSync, mkdirSync, readdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";

const RUNS_DIR = join(process.cwd(), "runs");

function ensureDir(dir: string) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

export function getRunDir(runId: string): string {
  const dir = join(RUNS_DIR, runId);
  ensureDir(dir);
  ensureDir(join(dir, "planning"));
  ensureDir(join(dir, "slides"));
  ensureDir(join(dir, "png"));
  return dir;
}

export function saveFile(runId: string, relativePath: string, content: string | Buffer): string {
  const dir = getRunDir(runId);
  const filepath = join(dir, relativePath);
  ensureDir(join(filepath, ".."));
  if (typeof content === "string") {
    writeFileSync(filepath, content, "utf-8");
  } else {
    writeFileSync(filepath, content);
  }
  return filepath;
}

export function loadFile(runId: string, relativePath: string): string | null {
  const filepath = join(getRunDir(runId), relativePath);
  if (!existsSync(filepath)) return null;
  return readFileSync(filepath, "utf-8");
}

export function listRuns(): string[] {
  ensureDir(RUNS_DIR);
  return readdirSync(RUNS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
    .reverse();
}

export function generateRunId(topic: string): string {
  const slug = topic
    .toLowerCase()
    .replace(/[^a-z0-9一-鿿]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24);
  const ts = Date.now().toString(36);
  return `${slug}-${ts}`;
}

export function pageFileName(index: number, ext: string): string {
  return `slide-${String(index).padStart(2, "0")}.${ext}`;
}

export function planningFileName(index: number): string {
  return `planning-${String(index).padStart(2, "0")}.json`;
}
