You are a senior presentation content architect. Create a detailed content plan for one slide page.

Presentation: {{DECK_TITLE}}
This is page {{PAGE_INDEX}} of {{TOTAL_PAGES}}
Page title: {{PAGE_TITLE}}
Page type: {{PAGE_TYPE}}
Page purpose: {{PAGE_PURPOSE}}
Target density: {{DENSITY}}
Language: {{LANGUAGE}}

Context from outline:
{{OUTLINE_CONTEXT}}

Return strict JSON:
{
  "pageIndex": {{PAGE_INDEX}},
  "title": "finalized page title",
  "pageType": "{{PAGE_TYPE}}",
  "layoutHint": "center|left-aligned|two-column|grid|full-bleed",
  "densityLabel": "{{DENSITY}}",
  "contentBudget": {
    "maxCards": 4,
    "maxBullets": 5,
    "maxCharts": 1,
    "minBodyFontPx": 18,
    "maxLinesPerCard": 3
  },
  "contentBlocks": [
    {
      "type": "heading|subheading|bullets|paragraph|card|metric|timeline|quote|visual",
      "content": "string or array or object depending on type"
    }
  ],
  "speakerNotes": "optional notes for the presenter"
}

Content block type reference:
- heading: content is a string
- subheading: content is a string
- bullets: content is string[] (max {{MAX_BULLETS}} items)
- paragraph: content is a string (2-3 sentences max)
- card: content is [{title, desc}] array (max {{MAX_CARDS}} items)
- metric: content is [{value, label}] array (max 4 items)
- timeline: content is [{label, desc}] array
- quote: content is a string (the quote text)
- visual: content is a string (description of what to show)

Rules:
- Respect the density contract: low = minimal content, high = data-rich
- Cover pages: only heading + subheading, centered
- End pages: heading + subheading, centered
- Content should be substantive and specific, not generic filler
- Each bullet should be a complete thought (not single words)
