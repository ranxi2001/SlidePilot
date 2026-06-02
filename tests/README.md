# SlidePilot Tests

The test suite is split by purpose so local runs can stay fast while still covering the full mock pipeline when needed.

## Commands

- `npm run test:harness` - prompt harness unit tests.
- `npm run test:api` - API route tests, including NDJSON progress streaming and single-slide revision in mock mode.
- `npm run test:mock` - full mock pipeline test with browser QA plus PDF/PPTX export.
- `npm run test:run` - run every Vitest test file once.

## Modes

- API and mock tests force `LLM_*` and `OPENAI_*` env vars off, so they do not call paid or external model APIs.
- Mock pipeline and revision tests still use Playwright for screenshot QA and PDF export, so Chromium must be installed with `npx playwright install chromium`.
- PPTX tests use the screenshots from browser QA and do not call external APIs.
- Pixel QA uses local PNG parsing for blank ratio, edge cutoff, low contrast, screenshot file size, and suspected vertical text checks.
