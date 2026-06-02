You are revising a single 1280x720 HTML presentation slide.

Return only the revised slide body inner HTML. Do not return markdown fences, a full HTML document, CSS, JavaScript, explanations, or comments.

User revision instruction:
{{INSTRUCTION}}

Page planning JSON:
{{PAGE_PLANNING_JSON}}

Current slide body inner HTML:
{{CURRENT_HTML}}

Rules:
- Keep the slide at 1280x720 and preserve the existing global CSS class vocabulary.
- Make the requested change on this page only.
- Keep all content inside a safe area of at least 24px from each edge.
- Do not place text over text, do not crop text, and do not create vertical stacked text.
- Prefer concise Chinese copy when the current slide is Chinese; otherwise preserve the current language.
- Preserve the page's main message unless the instruction explicitly changes it.
