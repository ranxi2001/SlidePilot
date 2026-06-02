/**
 * Style Generator — produces global.css from a StyleSpec.
 * This CSS is shared across all pages for visual consistency.
 */

import type { StyleSpec } from "../schemas.js";

export function generateGlobalCSS(style: StyleSpec): string {
  const accentSecondary = style.accentSecondary || style.accentColor;

  return `/* SlidePilot Global Style — auto-generated */
:root {
  --bg: ${style.bgColor};
  --text: ${style.textColor};
  --accent: ${style.accentColor};
  --accent-secondary: ${accentSecondary};
  --card-bg: ${style.cardBg || "rgba(128,128,128,0.05)"};
  --card-border: ${style.cardBorder || "rgba(128,128,128,0.1)"};
  --font-family: ${style.fontFamily};
  --title-weight: ${style.titleFontWeight};
  --base-font: ${style.baseFontSize}px;
}

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  width: 1280px;
  height: 720px;
  overflow: hidden;
  font-family: var(--font-family);
  font-size: var(--base-font);
  background: var(--bg);
  color: var(--text);
  line-height: 1.5;
}

h1, h2, h3 { font-weight: var(--title-weight); line-height: 1.2; }
h1 { font-size: 2.8em; letter-spacing: -0.02em; }
h2 { font-size: 1.8em; }
h3 { font-size: 1.2em; opacity: 0.7; }

p { font-size: 1em; line-height: 1.7; }

ul, ol { list-style: none; padding: 0; }
li {
  padding: 0.35em 0;
  padding-left: 1.4em;
  position: relative;
  font-size: 1em;
  line-height: 1.5;
}
li::before {
  content: "";
  position: absolute;
  left: 0;
  top: 0.65em;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--accent);
}

.card {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 12px;
  padding: 1.2em 1.4em;
}

.metric-value {
  font-size: 2.8em;
  font-weight: 800;
  color: var(--accent);
  line-height: 1.1;
}

.metric-label {
  font-size: 0.85em;
  opacity: 0.6;
  margin-top: 0.3em;
}

.accent-line {
  width: 60px;
  height: 4px;
  border-radius: 2px;
  background: var(--accent);
}

.page-number {
  position: absolute;
  bottom: 20px;
  right: 28px;
  font-size: 12px;
  opacity: 0.35;
}

img {
  max-width: 100%;
  height: auto;
  object-fit: contain;
}
`;
}

export const PRESET_STYLES: Record<string, StyleSpec> = {
  "tech-dark": {
    fontFamily: '"SF Pro Display", -apple-system, "Noto Sans SC", sans-serif',
    titleFontWeight: 750,
    baseFontSize: 18,
    colorScheme: "dark",
    bgColor: "#09090b",
    textColor: "#f4f4f5",
    accentColor: "#818cf8",
    accentSecondary: "#34d399",
    cardBg: "rgba(255,255,255,0.03)",
    cardBorder: "rgba(255,255,255,0.07)",
  },
  "modern-light": {
    fontFamily: '"SF Pro Display", -apple-system, "Noto Sans SC", sans-serif',
    titleFontWeight: 700,
    baseFontSize: 18,
    colorScheme: "light",
    bgColor: "#ffffff",
    textColor: "#18181b",
    accentColor: "#6366f1",
    accentSecondary: "#06b6d4",
    cardBg: "#f9fafb",
    cardBorder: "#e5e7eb",
  },
  minimal: {
    fontFamily: '"Inter", -apple-system, "Noto Sans SC", sans-serif',
    titleFontWeight: 700,
    baseFontSize: 18,
    colorScheme: "light",
    bgColor: "#fafafa",
    textColor: "#09090b",
    accentColor: "#09090b",
    accentSecondary: "#71717a",
    cardBg: "#ffffff",
    cardBorder: "#e4e4e7",
  },
};
