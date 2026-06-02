/**
 * Prompt Harness — template-based prompt generation.
 *
 * All LLM prompts go through this harness. Templates live as .md files
 * in src/prompts/templates/. Variables are injected via {{VAR}} syntax.
 *
 * Benefits:
 * - Prompts are version-controlled, auditable, independently editable
 * - No prompt logic leaks into agent code
 * - Variables are validated (missing {{VAR}} throws)
 * - Easy to A/B test different prompt versions
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = join(__dirname, "templates");

export function loadTemplate(name: string): string {
  const path = join(TEMPLATES_DIR, `${name}.md`);
  return readFileSync(path, "utf-8");
}

export function render(template: string, vars: Record<string, string>): string {
  let result = template;

  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{{${key}}}`, value);
  }

  // Check for unresolved variables
  const unresolved = result.match(/\{\{[A-Z_]+\}\}/g);
  if (unresolved) {
    throw new Error(`Unresolved template variables: ${unresolved.join(", ")}`);
  }

  return result;
}

export function renderTemplate(name: string, vars: Record<string, string>): string {
  const template = loadTemplate(name);
  return render(template, vars);
}
