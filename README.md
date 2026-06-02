# SlidePilot

> Result-first HTML Presentation Agent for non-technical users.

SlidePilot is an open-source AI Presentation Agent. It turns a topic, rough outline, Markdown document, or project material into a structured HTML slide deck, runs browser-based visual QA, repairs common layout issues, and exports shareable HTML/PDF deliverables.

Unlike traditional coding agents that ask users to review code, diffs, and terminal logs, SlidePilot is built around **result review**: users inspect the rendered deck, screenshots, PDF, and QA report.

## Why SlidePilot

Most AI presentation tools stop at generation. SlidePilot treats presentation creation as an agent workflow:

1. Understand the user's audience, goal, tone, and source material.
2. Build a story-first outline.
3. Convert the outline into a typed Deck Spec.
4. Render HTML slides.
5. Open the result in a browser and check for visual problems.
6. Repair overflow, blank slides, contrast issues, and broken assets.
7. Export HTML/PDF plus a readable generation report.

The core idea is simple: **non-technical users should judge the final result, not the code behind it.**

## Target Users

- Students preparing course reports or defenses
- Teachers creating lecture slides
- Product managers writing launch decks
- Researchers turning papers or notes into presentations
- Founders preparing pitch decks
- Developers who want polished technical talks without hand-designing slides

## MVP Scope

The first version focuses on HTML-native presentation generation.

### Included

- Prompt / Markdown input
- Requirement understanding
- Storyline planning
- Typed Deck Spec generation
- HTML slide rendering
- Browser QA with Playwright
- Repair loop for common visual defects
- PDF export
- Markdown generation report
- Natural-language iterative edits

### Not Included Yet

- Native `.pptx` editing
- Multi-user collaboration
- Template marketplace
- Cloud account system
- Video export
- Full document-format parsing for every file type

## Agent Workflow

```text
Prompt / Markdown / Source Material
        ↓
Requirement Spec
        ↓
Storyline Plan
        ↓
Deck Spec
        ↓
HTML Slides
        ↓
Browser QA
        ↓
Repair Loop
        ↓
PDF Export + Report
```

## Planned Architecture

```text
CLI / Web UI
   ↓
Agent Orchestrator
   ├── Requirement Analyzer
   ├── Storyline Planner
   ├── Deck Spec Generator
   ├── HTML Renderer
   ├── Browser QA Runner
   ├── Repair Agent
   └── Exporter
   ↓
Artifacts
   ├── deck.html
   ├── deck.pdf
   ├── screenshots/
   ├── deck.spec.json
   └── report.md
```

## Proposed Tech Stack

- **Language:** Python
- **CLI:** Typer + Rich
- **API:** FastAPI
- **Schema:** Pydantic
- **Template rendering:** Jinja2
- **Browser automation:** Playwright
- **Export:** Playwright PDF export
- **LLM:** OpenAI-compatible API
- **Slide runtime:** HTML/CSS, Reveal.js or lightweight custom renderer

## Repository Structure

```text
SlidePilot/
├── README.md
├── LICENSE
├── pyproject.toml
├── docs/
│   └── PRD.md
├── examples/
│   └── input.md
├── src/
│   └── slidepilot/
│       └── __init__.py
└── tests/
    └── .gitkeep
```

## Example Input

```markdown
# Build a presentation

Topic: SlidePilot, an AI Presentation Agent
Audience: recruiters and open-source contributors
Goal: explain why this project is useful and technically interesting
Tone: clean, practical, modern
Length: 8 slides
```

Expected output:

- `deck.html`
- `deck.pdf`
- `deck.spec.json`
- `report.md`
- `screenshots/*.png`

## Development Status

This repository is currently in the **project initialization / PRD stage**.

See [`docs/PRD.md`](docs/PRD.md) for the full product requirements document.

## Roadmap

- [ ] Initialize CLI skeleton
- [ ] Define `DeckSpec` Pydantic schema
- [ ] Build Markdown-to-requirement parser
- [ ] Implement HTML slide renderer
- [ ] Add Playwright preview and screenshot capture
- [ ] Add visual QA checks
- [ ] Add repair loop
- [ ] Add PDF export
- [ ] Add examples and demo assets
- [ ] Publish first demo release

## License

MIT License.
