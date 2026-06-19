import { Hono } from "hono";
import { createRequestSchema, imageGenerationRequestSchema, imageSizeSchema, revisionRequestSchema } from "./schemas.js";
import { isConfigured, loadConfig } from "./llm/client.js";
import { editImage, generateImage, isImageToolConfigured, loadImageToolConfig } from "./multimodal/image-client.js";
import { runPipeline, type ProgressEventMeta, type ProgressStatus } from "./agent/orchestrator.js";
import { reviseRunSlide } from "./agent/reviser.js";
import { exportPptx, isEditablePptxExportAvailable, isPptxExportAvailable } from "./export/pptx.js";
import { generateRunId, getRunDir, listRuns } from "./storage/run-store.js";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const apiRoutes = new Hono();

apiRoutes.get("/status", (c) => {
  const configured = isConfigured();
  const cfg = configured ? loadConfig() : null;
  const imageConfigured = isImageToolConfigured();
  const imageCfg = loadImageToolConfig();
  return c.json({
    llm: configured,
    model: cfg?.model || null,
    baseURL: cfg?.baseURL || null,
    image: {
      configured: imageConfigured,
      model: imageConfigured ? imageCfg.model : null,
      baseURL: imageConfigured ? imageCfg.baseURL : null,
      autoGenerate: imageConfigured ? imageCfg.autoGenerate : false,
      maxImagesPerRun: imageConfigured ? imageCfg.maxImagesPerRun : 0,
    },
    capabilities: {
      imageGen: imageConfigured,
      pptxExport: isPptxExportAvailable(),
      editablePptxExport: isEditablePptxExportAvailable(),
    },
  });
});

apiRoutes.post("/create", async (c) => {
  const body = await c.req.json();
  const parsed = createRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  try {
    const result = await runPipeline(parsed.data);
    return c.json(result);
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

apiRoutes.post("/create-stream", async (c) => {
  const body = await c.req.json();
  const parsed = createRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const encoder = new TextEncoder();
  const startedAt = Date.now();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`${JSON.stringify({
          ts: new Date().toISOString(),
          elapsedMs: Date.now() - startedAt,
          ...event,
        })}\n`));
      };

      send({
        type: "agent",
        status: "start",
        step: "agent",
        detail: "create-stream",
        kind: "phase",
        message: "Start SlidePilot agent run.",
      });

      try {
        const result = await runPipeline(parsed.data, (
          step: string,
          status: ProgressStatus,
          detail?: string,
          meta?: ProgressEventMeta,
        ) => {
          send({
            type: "progress",
            step,
            status,
            detail,
            kind: meta?.kind || "phase",
            message: meta?.message,
            pageIndex: meta?.pageIndex,
            stepElapsedMs: meta?.elapsedMs,
          });
        });

        send({
          type: "result",
          status: "done",
          step: "agent",
          kind: "artifact",
          message: "Slide deck generation completed.",
          result,
        });
      } catch (err) {
        send({
          type: "error",
          status: "error",
          step: "agent",
          kind: "phase",
          message: String(err),
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
    },
  });
});

apiRoutes.post("/runs/:runId/slides/:pageIndex/revise", async (c) => {
  const runId = decodeRunId(c.req.param("runId"));
  const pageIndex = Number(c.req.param("pageIndex"));
  if (!Number.isInteger(pageIndex) || pageIndex < 1) {
    return c.json({ error: "Invalid page index." }, 400);
  }

  const body = await c.req.json();
  const parsed = revisionRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  try {
    const result = await reviseRunSlide({
      runId,
      pageIndex,
      instruction: parsed.data.instruction,
    });
    return c.json(result);
  } catch (err) {
    const message = String(err);
    const status = message.includes("not found") || message.includes("missing") ? 404 : 500;
    return c.json({ error: message }, status);
  }
});

apiRoutes.post("/images/generate", async (c) => {
  const body = await c.req.json();
  const parsed = imageGenerationRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  try {
    const images = await generateImage(parsed.data);
    return c.json({ images: toPublicImages(images) });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

apiRoutes.post("/images/edit", async (c) => {
  const body = await c.req.parseBody();
  const prompt = stringField(body.prompt);
  const runId = stringField(body.runId) || generateRunId("image-edit");
  const size = imageSizeSchema.safeParse(stringField(body.size) || "1024x1024");
  const image = body.image;

  if (!prompt) {
    return c.json({ error: "Missing prompt." }, 400);
  }
  if (!size.success) {
    return c.json({ error: size.error.flatten() }, 400);
  }
  if (!isUploadedFile(image)) {
    return c.json({ error: "Missing image file." }, 400);
  }

  try {
    const sourcePath = await saveUploadedImage(runId, image);
    const images = await editImage({
      prompt,
      imagePath: sourcePath,
      size: size.data,
      runId,
    });
    return c.json({ images: toPublicImages(images) });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

apiRoutes.get("/runs", (c) => {
  return c.json({ runs: listRuns() });
});

apiRoutes.post("/export/pptx", async (c) => {
  const body = await c.req.json();
  const runId = typeof body.runId === "string" ? decodeRunId(body.runId) : "";
  if (!runId || /[\\/]|(^|\/)\.\.($|\/)/.test(runId)) {
    return c.json({ error: "Invalid runId." }, 400);
  }

  const runDir = getRunDir(runId);
  const manifest = readJsonIfExists(join(runDir, "manifest.json")) as { totalPages?: number } | null;
  const totalPages = Number(manifest?.totalPages) || listFiles(runDir, "png", [".png"]).length || 1;
  const port = Number(process.env.PORT) || 4321;
  const mode = body.mode === "screenshots" ? "screenshots" : "editable";
  const result = await exportPptx({
    previewUrl: `http://127.0.0.1:${port}/runs/${encodeURIComponent(runId)}/preview.html`,
    outputDir: runDir,
    filename: "deck",
    totalPages,
    mode,
  });

  if (!result.success) {
    return c.json({ error: result.error || "PPTX export failed." }, 500);
  }

  return c.json({
    pptxUrl: runAssetUrl(runId, "deck.pptx"),
    mode: result.mode,
    flags: result.flags || [],
  });
});

apiRoutes.get("/runs/:runId", (c) => {
  const runId = decodeRunId(c.req.param("runId"));
  try {
    return c.json(readRunDetail(runId));
  } catch (err) {
    return c.json({ error: String(err) }, 404);
  }
});

function toPublicImages(images: Array<{ runId: string; url: string; model: string; size: string }>) {
  return images.map((image) => ({
    runId: image.runId,
    url: image.url,
    model: image.model,
    size: image.size,
  }));
}

function decodeRunId(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function runAssetUrl(runId: string, ...parts: string[]): string {
  return `/runs/${encodeURIComponent(runId)}/${parts.map((part) => encodeURIComponent(part)).join("/")}`;
}

function stringField(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isUploadedFile(value: unknown): value is { name?: string; arrayBuffer: () => Promise<ArrayBuffer> } {
  return Boolean(value && typeof value === "object" && "arrayBuffer" in value && typeof (value as any).arrayBuffer === "function");
}

async function saveUploadedImage(runId: string, image: { name?: string; arrayBuffer: () => Promise<ArrayBuffer> }): Promise<string> {
  const runDir = getRunDir(runId);
  const assetDir = join(runDir, "assets");
  if (!existsSync(assetDir)) mkdirSync(assetDir, { recursive: true });

  const safeName = (image.name || "source.png").replace(/[^a-z0-9._-]+/gi, "-").slice(0, 80) || "source.png";
  const sourcePath = join(assetDir, `source-${Date.now()}-${safeName}`);
  writeFileSync(sourcePath, Buffer.from(await image.arrayBuffer()));
  return sourcePath;
}

function readRunDetail(runId: string) {
  const runDir = join(process.cwd(), "runs", runId);
  if (!existsSync(runDir)) {
    throw new Error(`Run not found: ${runId}`);
  }

  const manifestPath = join(runDir, "manifest.json");
  const assets = listFiles(runDir, "assets", [".png", ".jpg", ".jpeg", ".webp"]);
  const screenshots = listFiles(runDir, "png", [".png"]);
  if (!existsSync(manifestPath) && assets.length === 0 && screenshots.length === 0) {
    throw new Error(`Run not found: ${runId}`);
  }

  const manifest = existsSync(manifestPath)
    ? JSON.parse(readFileSync(manifestPath, "utf-8"))
    : {
        topic: runId,
        totalPages: 0,
        style: null,
        language: null,
        mode: "asset",
        createdAt: null,
      };
  const qa = readJsonIfExists(join(runDir, "qa.json")) || {
    passed: null,
    score: null,
    checks: [],
    screenshots: screenshots.map((file) => file.url),
  };
  const revisions = readJsonIfExists(join(runDir, "revisions.json")) || [];

  return {
    runId,
    topic: manifest.topic,
    totalPages: manifest.totalPages,
    style: manifest.style,
    language: manifest.language,
    mode: manifest.mode,
    createdAt: manifest.createdAt,
    updatedAt: manifest.updatedAt || null,
    artifacts: {
      previewUrl: existsSync(join(runDir, "preview.html")) ? runAssetUrl(runId, "preview.html") : null,
      pdfUrl: existsSync(join(runDir, "deck.pdf")) ? runAssetUrl(runId, "deck.pdf") : null,
      pptxUrl: existsSync(join(runDir, "deck.pptx")) ? runAssetUrl(runId, "deck.pptx") : null,
      reportUrl: existsSync(join(runDir, "report.md")) ? runAssetUrl(runId, "report.md") : null,
    },
    qa,
    screenshots,
    assets,
    revisions,
  };
}

function readJsonIfExists(path: string): unknown {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return null;
  }
}

function listFiles(runDir: string, relativeDir: string, extensions: string[]) {
  const dir = join(runDir, relativeDir);
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && extensions.some((ext) => entry.name.toLowerCase().endsWith(ext)))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((entry) => {
      const path = join(dir, entry.name);
      return {
        name: entry.name,
        url: runAssetUrl(runDir.split(/[\\/]/).pop() || "", relativeDir, entry.name),
        bytes: statSync(path).size,
      };
    });
}
