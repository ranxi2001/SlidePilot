/**
 * Assembler — combines per-page HTML files into a single preview.html deck.
 * This is for browser preview with keyboard navigation.
 */

import { readFileSync } from "node:fs";

export function assemblePreview(pageHtmlPaths: string[], title: string): string {
  const pages: string[] = [];

  for (const path of pageHtmlPaths) {
    const raw = readFileSync(path, "utf-8");
    // Extract body content only
    const bodyMatch = raw.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const bodyContent = bodyMatch ? bodyMatch[1] : raw;
    // Remove page-number spans (we'll add unified ones)
    const cleaned = bodyContent.replace(/<span class="page-number">[\s\S]*?<\/span>/g, "");
    pages.push(cleaned);
  }

  // Extract global CSS from first page
  const firstPage = readFileSync(pageHtmlPaths[0], "utf-8");
  const styleMatch = firstPage.match(/<style>([\s\S]*?)<\/style>/);
  const globalCSS = styleMatch ? styleMatch[1] : "";

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${title}</title>
<style>
${globalCSS}
body { width: 100vw; height: 100vh; overflow: hidden; }
.slide { width: 1280px; height: 720px; position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%) scale(var(--scale,1)); display: none; overflow: hidden; }
.slide.active { display: block; }
.slide-number { position: absolute; bottom: 20px; right: 28px; font-size: 12px; opacity: 0.35; }
@media (max-width: 1280px) { :root { --scale: calc(100vw / 1280); } }
</style>
</head>
<body>
${pages.map((content, i) => `<div class="slide" data-index="${i + 1}">\n${content}\n<span class="slide-number">${i + 1} / ${pages.length}</span>\n</div>`).join("\n")}
<script>
(function(){
  const slides = document.querySelectorAll('.slide');
  let cur = 0;
  function show(i){ slides.forEach((s,idx)=>s.classList.toggle('active',idx===i)); }
  show(0);
  document.addEventListener('keydown', e=>{
    if(['ArrowRight',' ','ArrowDown','PageDown'].includes(e.key)){cur=Math.min(cur+1,slides.length-1);show(cur);e.preventDefault();}
    else if(['ArrowLeft','ArrowUp','PageUp'].includes(e.key)){cur=Math.max(cur-1,0);show(cur);e.preventDefault();}
    else if(e.key==='Home'){cur=0;show(cur);}
    else if(e.key==='End'){cur=slides.length-1;show(cur);}
  });
})();
</script>
</body>
</html>`;
}
