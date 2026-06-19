import { describe, it, expect } from "vitest";
import { renderPageFromPlanning } from "../src/renderer/page-renderer.js";
import type { PagePlanning } from "../src/schemas.js";

describe("XSS prevention in page-renderer", () => {
  it("escapes heading content — no raw HTML tags injected", () => {
    const planning: PagePlanning = {
      pageType: "content",
      layoutHint: "",
      contentBlocks: [{ type: "heading", content: '<script>alert(1)</script>' }],
    };
    const html = renderPageFromPlanning(planning);
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  });

  it("escapes attribute breakout in heading", () => {
    const planning: PagePlanning = {
      pageType: "content",
      layoutHint: "",
      contentBlocks: [{ type: "heading", content: '" onload="alert(1)' }],
    };
    const html = renderPageFromPlanning(planning);
    expect(html).toContain("&quot;");
    // The escaped output is safe — quotes can't break attribute boundaries
    expect(html).not.toMatch(/<h1[^>]*onload/);
  });

  it("escapes bullet items — no raw tags", () => {
    const payloads = ['<img src=x onerror=alert(1)>', '<script>xss</script>'];
    const planning: PagePlanning = {
      pageType: "content",
      layoutHint: "",
      contentBlocks: [{ type: "bullets", content: payloads }],
    };
    const html = renderPageFromPlanning(planning);
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img ");
    expect(html).toContain("&lt;img");
    expect(html).toContain("&lt;script&gt;");
  });

  it("escapes image path — prevents attribute breakout", () => {
    const planning: PagePlanning = {
      pageType: "content",
      layoutHint: "",
      contentBlocks: [{
        type: "image",
        content: {
          path: '/img.png" onload="alert(1)',
          alt: '<script>alert(1)</script>',
          prompt: "test",
          layout: "inset",
        },
      }],
    };
    const html = renderPageFromPlanning(planning);
    // Path attribute breakout should be escaped
    expect(html).toContain('src="/img.png&quot; onload=&quot;alert(1)"');
    // Alt should be escaped
    expect(html).toContain("&lt;script&gt;");
    // No unescaped script tag
    expect(html).not.toContain("<script>");
  });

  it("escapes card title and desc", () => {
    const planning: PagePlanning = {
      pageType: "content",
      layoutHint: "",
      contentBlocks: [{
        type: "card",
        content: [{ title: "<b>xss</b>", desc: "<script>alert(1)</script>" }],
      }],
    };
    const html = renderPageFromPlanning(planning);
    expect(html).not.toContain("<script>");
    expect(html).not.toMatch(/<b>xss<\/b>/);
    expect(html).toContain("&lt;b&gt;xss&lt;/b&gt;");
    expect(html).toContain("&lt;script&gt;");
  });

  it("escapes metric values", () => {
    const planning: PagePlanning = {
      pageType: "content",
      layoutHint: "",
      contentBlocks: [{
        type: "metric",
        content: [{ value: "<script>alert(1)</script>", label: "test" }],
      }],
    };
    const html = renderPageFromPlanning(planning);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("escapes timeline labels and descriptions", () => {
    const planning: PagePlanning = {
      pageType: "content",
      layoutHint: "",
      contentBlocks: [{
        type: "timeline",
        content: [{ label: "<b>xss</b>", desc: '"><img onerror=x>' }],
      }],
    };
    const html = renderPageFromPlanning(planning);
    expect(html).not.toContain("<b>xss</b>");
    expect(html).not.toContain("<img ");
    expect(html).toContain("&lt;b&gt;");
  });
});
