import { z } from "zod";

// === API Request ===

export const createRequestSchema = z.object({
  prompt: z.string().min(1),
  pages: z.number().int().min(4).max(30).default(8),
  style: z.string().default("tech-dark"),
  language: z.string().default("zh-CN"),
});

export type CreateRequest = z.infer<typeof createRequestSchema>;

// === Requirement Spec ===

export const requirementSpecSchema = z.object({
  topic: z.string(),
  audience: z.string(),
  pageCount: z.number().int(),
  language: z.string().default("zh-CN"),
  tone: z.string().default("clear"),
  style: z.string().default("modern"),
  goal: z.string(),
  sourceMaterial: z.string().optional(),
});

export type RequirementSpec = z.infer<typeof requirementSpecSchema>;

// === Outline ===

export const outlineItemSchema = z.object({
  index: z.number().int(),
  title: z.string(),
  purpose: z.string(),
  pageType: z.enum([
    "cover", "toc", "section", "content", "comparison",
    "timeline", "metrics", "quote", "case", "summary", "end",
  ]),
  density: z.enum(["low", "mid_low", "medium", "high"]).default("medium"),
});

export type OutlineItem = z.infer<typeof outlineItemSchema>;

export const outlineSchema = z.object({
  title: z.string(),
  subtitle: z.string().optional(),
  storyline: z.string(),
  totalPages: z.number().int(),
  items: z.array(outlineItemSchema),
});

export type Outline = z.infer<typeof outlineSchema>;

// === Style Spec (global.css source of truth) ===

export const styleSpecSchema = z.object({
  fontFamily: z.string(),
  titleFontWeight: z.number().default(700),
  baseFontSize: z.number().default(18),
  colorScheme: z.enum(["dark", "light"]),
  bgColor: z.string(),
  textColor: z.string(),
  accentColor: z.string(),
  accentSecondary: z.string().optional(),
  cardBg: z.string().optional(),
  cardBorder: z.string().optional(),
});

export type StyleSpec = z.infer<typeof styleSpecSchema>;

// === Page Planning (per-page, before HTML generation) ===

export const pagePlanningSchema = z.object({
  pageIndex: z.number().int(),
  title: z.string(),
  pageType: z.string(),
  layoutHint: z.string(),
  densityLabel: z.enum(["low", "mid_low", "medium", "high"]),
  contentBudget: z.object({
    maxCards: z.number().int().default(4),
    maxBullets: z.number().int().default(5),
    maxCharts: z.number().int().default(1),
    minBodyFontPx: z.number().default(18),
    maxLinesPerCard: z.number().int().default(3),
  }),
  contentBlocks: z.array(z.object({
    type: z.enum(["heading", "subheading", "bullets", "paragraph", "card", "metric", "timeline", "quote", "visual"]),
    content: z.unknown(),
  })),
  speakerNotes: z.string().optional(),
});

export type PagePlanning = z.infer<typeof pagePlanningSchema>;

// === QA Models ===

export const qaCheckSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(["pass", "fail", "warn"]),
  message: z.string(),
  pageIndex: z.number().int().optional(),
});

export type QACheck = z.infer<typeof qaCheckSchema>;

export const qaResultSchema = z.object({
  passed: z.boolean(),
  score: z.number(),
  checks: z.array(qaCheckSchema),
  screenshots: z.array(z.string()),
});

export type QAResult = z.infer<typeof qaResultSchema>;

// === Run Manifest ===

export const runManifestSchema = z.object({
  runId: z.string(),
  topic: z.string(),
  totalPages: z.number().int(),
  style: z.string(),
  language: z.string(),
  createdAt: z.string(),
  artifacts: z.object({
    outline: z.string().optional(),
    style: z.string().optional(),
    globalCss: z.string().optional(),
    pages: z.array(z.object({
      index: z.number().int(),
      planning: z.string().optional(),
      html: z.string().optional(),
      png: z.string().optional(),
    })),
    previewHtml: z.string().optional(),
    pdf: z.string().optional(),
  }),
});

export type RunManifest = z.infer<typeof runManifestSchema>;
