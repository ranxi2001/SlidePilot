<div align="center">
  <h1>SlidePilot</h1>
  <p><strong>AI Presentation Agent — describe your idea, get a polished deck.</strong></p>
  <p>
    <a href="#quick-start"><img src="https://img.shields.io/badge/Quick_Start-blue?style=for-the-badge" alt="Quick Start" /></a>
    <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="License" /></a>
    <a href="README-ZH.md"><img src="https://img.shields.io/badge/中文文档-black?style=for-the-badge" alt="中文" /></a>
  </p>
  <p>
    <img src="https://img.shields.io/badge/Pipeline-7_stages-6366f1?style=flat-square" />
    <img src="https://img.shields.io/badge/Themes-3_built--in-818cf8?style=flat-square" />
    <img src="https://img.shields.io/badge/Page_Types-11-34d399?style=flat-square" />
    <img src="https://img.shields.io/badge/QA_Checks-5_automated-f59e0b?style=flat-square" />
    <img src="https://img.shields.io/badge/LLM-Any_OpenAI--compatible-09090b?style=flat-square" />
  </p>
</div>

---

**SlidePilot** is an open-source AI presentation agent that turns a topic, outline, or document into a professional HTML slide deck — with automatic browser-based QA, visual repair, and PDF export. No PowerPoint, no code, no design skills required.

Unlike traditional PPT generators that stop at text generation, SlidePilot treats presentation creation as a **complete agent workflow**: understand → plan → style → render → inspect → repair → export.

## Why SlidePilot

| Pain Point | SlidePilot's Answer |
|---|---|
| Generated slides look generic | **Planning-first**: per-page content budget and layout contract before any HTML |
| No visual QA after generation | **Playwright QA**: automated overflow, blank, dimension checks on every page |
| Style inconsistency across pages | **Global CSS lock**: one `style.json` → `global.css` applied to all pages |
| Can't iterate without code | **Web UI**: type your prompt, preview in browser, download PDF |
| Locked to one LLM provider | **Any OpenAI-compatible API**: OpenAI, DeepSeek, Ollama, vLLM, etc. |
| Prompts buried in code | **Prompt Harness**: all LLM prompts as editable `.md` templates |

## Demo

```bash
# Open http://127.0.0.1:4321, type:
"Make a 10-slide presentation about the future of AI Agents for undergraduate students, dark tech style"
```

```
✓ Requirement parsed
✓ Outline generated (10 pages)
✓ Style locked (tech-dark)
✓ Pages rendered (10/10)
✓ Browser QA passed (score: 1.0)
✓ PDF exported

Preview: http://127.0.0.1:4321/runs/{id}/preview.html
```

<!-- TODO: Add screenshot grid here -->
<!-- <img src="docs/assets/demo-grid.png" width="100%" /> -->

## Quick Start

```bash
git clone https://github.com/ranxi2001/SlidePilot
cd SlidePilot
npm install
npx playwright install chromium

# Start the web server (works without LLM config — uses mock data)
npm run dev
# → http://127.0.0.1:4321
```

### Enable LLM

```bash
cp .env.example .env
# Edit .env with your API credentials:
#   LLM_BASE_URL=https://api.openai.com/v1
#   LLM_API_KEY=sk-...
#   LLM_MODEL=gpt-4o
```

SlidePilot works with **any OpenAI-compatible API** — OpenAI, DeepSeek, Ollama, vLLM, Azure OpenAI, etc.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Web UI (Browser)                                           │
│  Prompt → Progress → Preview (iframe) → Download            │
└──────────────────────────────┬──────────────────────────────┘
                               │ POST /api/create
┌──────────────────────────────▼──────────────────────────────┐
│  Agent Pipeline                                             │
│                                                             │
│  ┌─────────┐  ┌─────────┐  ┌──────────┐  ┌─────────────┐  │
│  │Requirement│→│ Outline │→│  Style   │→│ Per-Page Gen │  │
│  │  Parser  │  │ Planner │  │   Lock   │  │  (parallel) │  │
│  └─────────┘  └─────────┘  └──────────┘  └──────┬──────┘  │
│                                                   │         │
│                              ┌─────────┐  ┌──────▼──────┐  │
│                              │ Repair  │←─│ Browser QA  │  │
│                              │  Agent  │  │ (Playwright)│  │
│                              └────┬────┘  └─────────────┘  │
│                                   │                         │
│                    ┌──────────────▼──────────────┐          │
│                    │  Assemble + PDF Export      │          │
│                    └────────────────────────────-┘          │
└─────────────────────────────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│  Artifacts (per run)                                        │
│  runs/{id}/                                                 │
│  ├── outline.json        — narrative structure              │
│  ├── style.json          — locked visual system             │
│  ├── global.css          — generated from style.json        │
│  ├── planning/*.json     — per-page content contract        │
│  ├── slides/*.html       — per-page HTML (1280×720)         │
│  ├── png/*.png           — per-page screenshots             │
│  ├── preview.html        — assembled deck with navigation   │
│  ├── deck.pdf            — print-ready export               │
│  └── report.md           — QA summary                       │
└─────────────────────────────────────────────────────────────┘
```

## Core Design

### Per-Page HTML (1280×720)

Each slide is a **self-contained HTML file** with a fixed 1280×720 viewport — like PPTAgent and ppt-agent-skills. This enables:
- Independent QA and repair per page
- Parallel generation
- Individual screenshots
- Clean PDF page breaks

### Planning-First Rendering

Inspired by ppt-agent-skills' density contract system:

```
Outline → PagePlanning (JSON) → HTML
```

The LLM first outputs a structured **content plan** (layout, density, content budget, blocks), then generates HTML that must conform to it. This prevents "attention collapse" from trying to plan + design + code simultaneously.

### Prompt Harness

All LLM prompts live as **editable Markdown templates** in `src/prompts/templates/`:

```
requirement.md   — parse user intent
outline.md       — narrative structure
style.md         — visual system
page-planning.md — per-page content contract
page-html.md     — HTML generation
repair.md        — fix QA failures
```

Variables are injected via `{{VAR}}` syntax. Missing variables throw errors. No prompt logic in application code.

### Pixel-Level QA

Playwright checks every page automatically:

| Check | What it detects |
|-------|-----------------|
| DIM | Viewport exceeds 1280×720 |
| OVERFLOW | Content elements exceed slide bounds |
| BLANK | Page has < 5 characters of text |
| CONSOLE | JavaScript errors |
| SCREENSHOT | Captures PNG for visual review |

Failed pages enter a **repair loop** (max 3 rounds) where the LLM fixes issues based on QA feedback.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 20+ |
| Language | TypeScript |
| Web Server | Hono |
| Schema Validation | Zod |
| Browser Automation | Playwright |
| LLM Interface | OpenAI SDK (any compatible API) |
| PDF Export | Playwright Print |

## Project Structure

```
SlidePilot/
├── src/
│   ├── server.ts                 # Web server entry
│   ├── routes.ts                 # API endpoints
│   ├── schemas.ts                # Zod schemas (all data models)
│   ├── llm/
│   │   └── client.ts             # OpenAI-compatible LLM client
│   ├── prompts/
│   │   ├── harness.ts            # Template engine
│   │   └── templates/*.md        # Editable prompt templates
│   ├── agent/
│   │   └── orchestrator.ts       # Pipeline coordinator
│   ├── renderer/
│   │   ├── style-generator.ts    # StyleSpec → global.css
│   │   ├── page-renderer.ts      # PagePlanning → HTML
│   │   └── assembler.ts          # Pages → preview deck
│   ├── qa/
│   │   └── browser-qa.ts         # Playwright visual checks
│   ├── export/
│   │   └── pdf.ts                # Per-page PDF merge
│   ├── storage/
│   │   └── run-store.ts          # Artifact persistence
│   └── report/
│       └── generator.ts          # Markdown report
├── public/                       # Web UI (zero-build)
├── tests/
├── docs/PRD.md
├── .env.example                  # LLM config template
├── package.json
└── tsconfig.json
```

## Comparison

| Feature | PPTAgent | ppt-master | ppt-agent-skills | **SlidePilot** |
|---------|----------|------------|------------------|----------------|
| Output format | PPTX | PPTX | HTML→PPTX | **HTML/PDF** |
| Target user | Researchers | Office users | Developers | **Non-technical** |
| Browser QA | Vision LLM | No | Pixel analysis | **Pixel + Playwright** |
| Per-page HTML | Yes | No | Yes | **Yes** |
| Planning-first | No | No | Yes (JSON contract) | **Yes** |
| Prompt templates | Jinja2 | N/A | Harness + playbooks | **Markdown harness** |
| Web UI | Gradio | N/A | N/A | **Built-in** |
| LLM provider | Any | OpenAI | Any | **Any** |
| Language | Python | Python | Python (skill) | **TypeScript** |

## Roadmap

- [x] Per-page HTML rendering (1280×720)
- [x] Planning-first architecture
- [x] Global style system (StyleSpec → CSS)
- [x] Playwright browser QA
- [x] Per-page PDF export
- [x] Prompt harness (template-based)
- [x] Web UI skeleton
- [ ] Full LLM integration (outline → planning → HTML)
- [ ] SSE real-time progress in Web UI
- [ ] Natural language iterative editing
- [ ] Image search & embedding
- [ ] PPTX export
- [ ] More themes & layout types
- [ ] Docker deployment
- [ ] Demo video & screenshots

## Contributing

Contributions welcome! See [docs/PRD.md](docs/PRD.md) for the full product requirements document.

## License

[MIT](LICENSE)
