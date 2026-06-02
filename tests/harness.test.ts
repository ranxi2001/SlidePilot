import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  clearTemplateCache,
  extractVariables,
  listTemplates,
  loadTemplateInfo,
  render,
  renderTemplate,
  renderWithDiagnostics,
  resolveTemplatePath,
  validateTemplates,
} from "../src/prompts/harness.js";

const tmpDirs: string[] = [];

afterEach(() => {
  clearTemplateCache();
  for (const dir of tmpDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function tempTemplateDir(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "slidepilot-prompts-"));
  tmpDirs.push(dir);
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(dir, `${name}.md`), content, "utf-8");
  }
  return dir;
}

describe("prompt harness", () => {
  it("renders templates with typed values", () => {
    const result = render("Topic: {{TOPIC}}, pages: {{PAGES}}, ok: {{OK}}", {
      TOPIC: "AI Agent",
      PAGES: 8,
      OK: true,
    });

    expect(result).toBe("Topic: AI Agent, pages: 8, ok: true");
  });

  it("throws for missing variables with clear names", () => {
    expect(() => render("Topic: {{TOPIC}} / {{AUDIENCE}}", { TOPIC: "AI" }))
      .toThrow("{{AUDIENCE}}");
  });

  it("can report unused variables without failing by default", () => {
    const diagnostics = renderWithDiagnostics("Topic: {{TOPIC}}", {
      TOPIC: "AI",
      EXTRA: "ignored",
    });

    expect(diagnostics.text).toBe("Topic: AI");
    expect(diagnostics.unusedVars).toEqual(["EXTRA"]);
    expect(() => render("Topic: {{TOPIC}}", { TOPIC: "AI", EXTRA: "ignored" }, { strictUnusedVars: true }))
      .toThrow("Unused template variables");
  });

  it("rejects invalid placeholders and unsafe template names", () => {
    expect(() => render("Bad: {{topic}}", { topic: "AI" })).toThrow("Invalid template placeholders");
    expect(() => resolveTemplatePath("../secret")).toThrow("Invalid prompt template name");
  });

  it("extracts variables once per unique placeholder", () => {
    expect(extractVariables("{{TOPIC}} {{TOPIC}} {{PAGE_COUNT}}")).toEqual(["TOPIC", "PAGE_COUNT"]);
  });

  it("loads, lists, and validates templates from a custom directory", () => {
    const dir = tempTemplateDir({
      outline: "Topic: {{TOPIC}}\nAudience: {{AUDIENCE}}",
      broken: "Bad placeholder: {{topic}}",
    });

    const info = loadTemplateInfo("outline", { templateDirs: [dir] });
    expect(info.variables).toEqual(["TOPIC", "AUDIENCE"]);
    expect(renderTemplate("outline", { TOPIC: "AI", AUDIENCE: "CEO" }, { templateDirs: [dir] }))
      .toContain("CEO");

    expect(listTemplates({ templateDirs: [dir] }).map((template) => template.name))
      .toEqual(["broken", "outline"]);

    const validations = validateTemplates({ templateDirs: [dir] });
    expect(validations.find((item) => item.name === "outline")?.errors).toEqual([]);
    expect(validations.find((item) => item.name === "broken")?.errors[0]).toContain("Invalid placeholder");
  });

  it("uses cache but invalidates it when the file changes", () => {
    const dir = tempTemplateDir({ demo: "v1 {{VALUE}}" });

    expect(renderTemplate("demo", { VALUE: "x" }, { templateDirs: [dir] })).toBe("v1 x");
    writeFileSync(join(dir, "demo.md"), "v2 {{VALUE}}", "utf-8");
    clearTemplateCache();

    expect(renderTemplate("demo", { VALUE: "x" }, { templateDirs: [dir] })).toBe("v2 x");
  });
});
