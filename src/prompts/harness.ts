/**
 * Prompt Harness - template loading, validation, and rendering.
 *
 * Templates use {{VARIABLE_NAME}} placeholders. Variable names are intentionally
 * restricted to uppercase snake case so missing prompt inputs are easy to spot.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { delimiter, dirname, extname, join, parse, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type TemplateValue = string | number | boolean | null | undefined;
export type TemplateVars = Record<string, TemplateValue>;

export interface HarnessOptions {
  templateDirs?: string[];
  useCache?: boolean;
  strictUnusedVars?: boolean;
}

export interface LoadedTemplate {
  name: string;
  path: string;
  content: string;
  variables: string[];
}

export interface RenderDiagnostics {
  text: string;
  requiredVars: string[];
  providedVars: string[];
  missingVars: string[];
  unusedVars: string[];
}

export interface TemplateValidation {
  name: string;
  path: string;
  variables: string[];
  errors: string[];
}

interface CacheEntry {
  content: string;
  mtimeMs: number;
  size: number;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
const VARIABLE_NAME_RE = /^[A-Z][A-Z0-9_]*$/;
const PLACEHOLDER_RE = /\{\{\s*([A-Z][A-Z0-9_]*)\s*\}\}/g;
const ANY_PLACEHOLDER_RE = /\{\{\s*([^}]+?)\s*\}\}/g;
const templateCache = new Map<string, CacheEntry>();

export function defaultTemplateDirs(): string[] {
  const envDirs = [
    ...(process.env.PROMPT_TEMPLATE_DIRS || "").split(delimiter),
    process.env.PROMPT_TEMPLATE_DIR || "",
  ].filter(Boolean);

  return unique([
    ...envDirs,
    join(__dirname, "templates"),
    join(process.cwd(), "src", "prompts", "templates"),
    join(process.cwd(), "dist", "prompts", "templates"),
  ].map((dir) => resolve(dir)));
}

export function clearTemplateCache(): void {
  templateCache.clear();
}

export function listTemplates(options?: HarnessOptions): LoadedTemplate[] {
  const seen = new Set<string>();
  const templates: LoadedTemplate[] = [];

  for (const dir of getTemplateDirs(options)) {
    if (!existsSync(dir)) continue;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isFile() || extname(entry.name) !== ".md") continue;

      const name = parse(entry.name).name;
      if (seen.has(name) || !TEMPLATE_NAME_RE.test(name)) continue;

      seen.add(name);
      templates.push(loadTemplateInfo(name, { ...options, templateDirs: [dir] }));
    }
  }

  return templates.sort((a, b) => a.name.localeCompare(b.name));
}

export function resolveTemplatePath(name: string, options?: HarnessOptions): string {
  assertValidTemplateName(name);
  const dirs = getTemplateDirs(options);

  for (const dir of dirs) {
    const path = resolve(dir, `${name}.md`);
    if (existsSync(path)) return path;
  }

  throw new Error(`Prompt template not found: ${name}. Searched: ${dirs.join(", ")}`);
}

export function loadTemplateInfo(name: string, options?: HarnessOptions): LoadedTemplate {
  const path = resolveTemplatePath(name, options);
  const content = readTemplateFile(path, options?.useCache !== false);
  return {
    name,
    path,
    content,
    variables: extractVariables(content),
  };
}

export function loadTemplate(name: string, options?: HarnessOptions): string {
  return loadTemplateInfo(name, options).content;
}

export function extractVariables(template: string): string[] {
  const variables = new Set<string>();
  for (const match of template.matchAll(PLACEHOLDER_RE)) {
    variables.add(match[1]);
  }
  return [...variables];
}

export function validateTemplate(name: string, options?: HarnessOptions): TemplateValidation {
  const loaded = loadTemplateInfo(name, options);
  return {
    name: loaded.name,
    path: loaded.path,
    variables: loaded.variables,
    errors: findInvalidPlaceholders(loaded.content).map((placeholder) =>
      `Invalid placeholder ${placeholder}. Use uppercase snake case, for example {{TOPIC}}.`,
    ),
  };
}

export function validateTemplates(options?: HarnessOptions): TemplateValidation[] {
  return listTemplates(options).map((template) => validateTemplate(template.name, options));
}

export function render(template: string, vars: TemplateVars, options?: HarnessOptions): string {
  return renderWithDiagnostics(template, vars, options).text;
}

export function renderWithDiagnostics(template: string, vars: TemplateVars, options?: HarnessOptions): RenderDiagnostics {
  const invalidPlaceholders = findInvalidPlaceholders(template);
  if (invalidPlaceholders.length > 0) {
    throw new Error(`Invalid template placeholders: ${invalidPlaceholders.join(", ")}`);
  }

  const requiredVars = extractVariables(template);
  const providedVars = Object.keys(vars);
  const requiredSet = new Set(requiredVars);
  const missingVars = requiredVars.filter((key) => !(key in vars));
  const unusedVars = providedVars.filter((key) => !requiredSet.has(key));

  if (missingVars.length > 0) {
    throw new Error(`Unresolved template variables: ${missingVars.map((key) => `{{${key}}}`).join(", ")}`);
  }

  if (options?.strictUnusedVars && unusedVars.length > 0) {
    throw new Error(`Unused template variables: ${unusedVars.join(", ")}`);
  }

  const text = template.replace(PLACEHOLDER_RE, (_match, key: string) => stringifyValue(vars[key]));

  return {
    text,
    requiredVars,
    providedVars,
    missingVars,
    unusedVars,
  };
}

export function renderTemplate(name: string, vars: TemplateVars, options?: HarnessOptions): string {
  const template = loadTemplate(name, options);
  return render(template, vars, options);
}

function getTemplateDirs(options?: HarnessOptions): string[] {
  return unique((options?.templateDirs ?? defaultTemplateDirs()).map((dir) => resolve(dir)));
}

function readTemplateFile(path: string, useCache: boolean): string {
  if (!useCache) return readFileSync(path, "utf-8");

  const stat = statSync(path);
  const cached = templateCache.get(path);
  if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) {
    return cached.content;
  }

  const content = readFileSync(path, "utf-8");
  templateCache.set(path, { content, mtimeMs: stat.mtimeMs, size: stat.size });
  return content;
}

function findInvalidPlaceholders(template: string): string[] {
  const invalid = new Set<string>();
  for (const match of template.matchAll(ANY_PLACEHOLDER_RE)) {
    const key = match[1].trim();
    if (!VARIABLE_NAME_RE.test(key)) invalid.add(match[0]);
  }
  return [...invalid];
}

function assertValidTemplateName(name: string): void {
  if (!TEMPLATE_NAME_RE.test(name)) {
    throw new Error(`Invalid prompt template name: ${name}`);
  }
}

function stringifyValue(value: TemplateValue): string {
  return value == null ? "" : String(value);
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}
