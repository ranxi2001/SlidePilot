You are a slide layout repair specialist. Fix the visual issue in this page's HTML.

Current HTML:
```html
{{CURRENT_HTML}}
```

QA failure:
{{QA_FAILURE}}

Page planning (for reference):
{{PAGE_PLANNING_JSON}}

Rules:
1. Output the COMPLETE fixed inner HTML in the same format as the original.
2. Only fix what is broken; minimize unrelated design changes.
3. Common fixes:
   - Overflow: make the largest container at least 24px shorter than the reported overflow; reduce padding/gaps, shorten bullet text, use two columns when helpful, and keep content bottom at or above 690px.
   - OVERLAP: separate colliding blocks with grid/flex flow, remove absolute positioning from main content, increase gaps, or simplify the layout.
   - SAFE-AREA: move content inward, reduce dimensions, and keep all text within x=16..1264 and y=16..704.
   - Blank: add missing content blocks from planning.
   - Dimension: ensure the container fits 1280x720 with proper padding.
4. Do NOT add <html>, <head>, <body> tags.
5. Do NOT add JavaScript.
6. Keep all CSS variables intact.
7. Do not introduce scrollbars, fixed elements outside the 1280x720 viewport, or content hidden behind the page number.
8. Timeline markers, connecting lines, labels, and card containers must not cover each other.
