# SlidePilot PRD

> 面向非技术用户的结果导向 HTML Presentation Agent  
> Version: v0.1  
> Status: Draft  
> Target: 开源求职项目 / AI Agent 产品展示项目

---

## 1. 项目概述

### 1.1 项目名称

**SlidePilot**

备选名称：

- DeckPilot
- StoryDeck
- PitchPilot
- DeckFlow
- SlideShip

当前推荐使用：**SlidePilot**

---

### 1.2 一句话介绍

**SlidePilot 是一个面向非技术用户的开源 AI Presentation Agent，可以把主题、文档、笔记或研究材料自动转化为结构清晰、视觉统一、可预览、可导出 PDF 的 HTML 演示文稿。**

英文版：

> SlidePilot is an open-source AI presentation agent that turns ideas, documents, and research notes into polished, browser-previewable, exportable HTML slide decks.

---

### 1.3 核心定位

SlidePilot 不是传统“PPT 生成器”，也不是面向程序员的 Coding Agent。

它的定位是：

> **Result-Oriented Presentation Agent for Non-Technical Users**

即：

- 用户不用理解代码。
- 用户不用调 HTML/CSS。
- 用户不用安装 PowerPoint 插件。
- 用户只需要描述想要的展示结果。
- Agent 负责完成大纲、叙事、页面、视觉、预览、验收和导出。

---

### 1.4 为什么选择 HTML PPT 方向

当前 Coding Agent 市场中，Claude Code、Codex、OpenCode、Cline 等已经很好地覆盖了“程序员写代码”的场景。继续做一个面向开发者的 Coding Agent，很难体现差异化。

但对于非技术用户，仍然存在一个明显痛点：

> 他们不关心代码，只关心最终可用结果。

在众多“结果导向”场景里，PPT / Presentation 是最适合第一版切入的方向：

- 用户范围广：学生、老师、产品、运营、销售、创业者、研究员都需要。
- 交付结果直观：预览链接、PDF、截图都容易展示。
- 技术复杂度适中：不需要复杂数据库和权限系统。
- 开源展示效果强：GitHub README 可以直接放生成样例。
- 容易形成 Agent 工作流：理解需求 → 规划大纲 → 生成页面 → 浏览器验收 → 导出。

---

## 2. 背景与参考项目

### 2.1 参考项目调研

以下项目是 SlidePilot 的主要参考对象。

---

### 2.1.1 PPTAgent

- GitHub: https://github.com/icip-cas/PPTAgent
- Full name: `icip-cas/PPTAgent`
- Description: An Agentic Framework for Reflective PowerPoint Generation
- Stars: 约 4.5k
- Forks: 约 546
- Language: Python
- License: MIT
- 特点：
  - Agentic PowerPoint 生成框架。
  - 强调反射式生成。
  - 模仿人类编辑 PPT 流程。
  - 支持从大纲、模板、内容到最终 PPT 的流程。
  - 偏研究型和完整 PPTX 生成。

#### 可借鉴点

- Agentic workflow。
- 大纲优先的生成方式。
- 反射式检查和迭代。
- 专业 PPT 生成流程抽象。

#### 不直接照搬点

- SlidePilot 第一版不追求完整原生 PPTX。
- 不做复杂 PowerPoint 内部对象编辑。
- 不做重型 Agent Sandbox。
- 优先做 HTML slides 的结果交付体验。

---

### 2.1.2 ppt-master

- GitHub: https://github.com/hugohe3/ppt-master
- Full name: `hugohe3/ppt-master`
- Description: AI generates a real, editable PowerPoint from any document — native shapes & animations, speaker notes voiced as audio narration, and the option to follow your own .pptx template, not slide images
- Stars: 约 23.5k
- Forks: 约 2.1k
- Language: Python
- License: MIT
- 特点：
  - 高热度 PPTX 生成项目。
  - 支持从任意文档生成可编辑 PowerPoint。
  - 支持原生形状、动画、过渡、演讲者备注、音频旁白。
  - 可套用用户自己的 `.pptx` 模板。
  - 更偏 PowerPoint Harness / Workflow Engine，而不是完整交互式 Agent 产品。

#### 可借鉴点

- 文档到幻灯片的转换流程。
- 可编辑结果的重要性。
- 模板复用能力。
- 演讲者备注和旁白能力。
- 对真实 PowerPoint 文件的重视。

#### 不直接照搬点

- SlidePilot 第一阶段不以 `.pptx` 为主交付格式。
- 不优先做复杂动画和 PowerPoint 原生对象。
- 先用 HTML/PDF 形成更可控的开源 demo。

---

### 2.1.3 Azure Multi-Agent Presentation Builder

- GitHub: https://github.com/Azure-Samples/ai-multi-agent-presentation-builder
- Full name: `Azure-Samples/ai-multi-agent-presentation-builder`
- Stars: 约 49
- Forks: 约 39
- Language: Python
- License: MIT
- 特点：
  - 微软 Azure 示例项目。
  - 使用 Semantic Kernel + Azure OpenAI。
  - 多 Agent 协作生成 PPTX。
  - 带 Streamlit 界面。
  - 更适合学习 Azure 生态和多 Agent orchestration。

#### 可借鉴点

- 多 Agent 分工：researcher / writer / designer / reviewer。
- Streamlit / Web UI 快速展示。
- 企业云生态集成思路。

#### 不直接照搬点

- SlidePilot 不绑定 Azure。
- MVP 不做强多 Agent 架构。
- 优先 OpenAI-compatible API，保持开源易用。

---

### 2.1.4 zengwenliang416/ppt-agent

- GitHub: https://github.com/zengwenliang416/ppt-agent
- Stars: 约 804
- Forks: 约 101
- Language: HTML
- 特点：
  - 中文 PPT Agent 项目。
  - 偏多 Agent / 工作流。
  - 输出更偏 HTML/SVG/Bento Grid 风格幻灯片。
  - 视觉样式更现代。

#### 可借鉴点

- 中文用户场景。
- HTML/SVG 风格表达。
- Bento Grid 视觉布局。
- 更适合非传统 PPT 的展示方式。

#### 不直接照搬点

- SlidePilot 要强调产品级流程，不只是生成视觉稿。
- 需要加入可复盘 trace、浏览器 QA、导出和修改流程。

---

### 2.1.5 ppt-agent-skills

- GitHub: https://github.com/sunbigfly/ppt-agent-skills
- Full name: `sunbigfly/ppt-agent-skills`
- Description: A code-driven presentation generation framework. 像构建软件工程一样生成演示文稿。
- Stars: 约 766
- Forks: 约 86
- Language: Python
- 特点：
  - 强调用软件工程方法生成演示文稿。
  - 状态机驱动。
  - 关注布局稳定、幻觉少。
  - 有比较强的工程化思想。

#### 可借鉴点

- 状态机式生成流程。
- 把 PPT 生成看成软件工程。
- 结构化中间表示。
- 强调布局稳定性。

#### 不直接照搬点

- SlidePilot 的用户体验要更偏非技术用户。
- 不把“代码驱动”作为对外主要卖点，而作为内部实现方式。

---

### 2.1.6 Talk-to-Your-Slides

- GitHub: https://github.com/KyuDan1/Talk-to-Your-Slides
- Full name: `KyuDan1/Talk-to-Your-Slides`
- Description: PowerPoint Slide Editing Agent, accepted at ACL 2026 Findings
- Stars: 约 31
- Forks: 约 3
- Language: Jupyter Notebook
- 特点：
  - 研究型项目。
  - 重点是“对已有 PPT 进行对话式编辑”。
  - 关注 slide editing，而不是从零生成。
  - 有论文背景。

#### 可借鉴点

- 对话式修改体验。
- 用户用自然语言表达修改目标。
- 已有 deck 的结构化理解和编辑。

#### 不直接照搬点

- SlidePilot MVP 先做从零生成。
- 后续再支持 existing deck editing。

---

### 2.2 竞品/参考项目总结

当前已有项目主要分三类：

#### A. 原生 PPTX 生成型

代表：

- PPTAgent
- ppt-master
- Azure presentation builder

优势：

- 可在 PowerPoint 中继续编辑。
- 更符合传统办公流。
- 适合正式汇报。

劣势：

- 实现复杂。
- PowerPoint 对象模型繁琐。
- 样式稳定性难控制。
- 浏览器预览和自动验收不如 HTML 方便。

---

#### B. HTML / SVG 展示型

代表：

- zengwenliang416/ppt-agent
- 部分 Slidev / Marp / Reveal.js 工具链

优势：

- 视觉能力强。
- 适合 Web 分享。
- 容易截图和自动验收。
- 易部署。
- 易与前端生态结合。

劣势：

- 不是传统 `.pptx`。
- 有些用户仍然需要 PowerPoint 编辑。
- 打印和导出需要额外处理。

---

#### C. 对话式编辑型

代表：

- Talk-to-Your-Slides

优势：

- 更符合用户修改习惯。
- 适合已有 PPT 优化。
- 可以作为长期演化方向。

劣势：

- 对 PPT 解析和编辑要求高。
- MVP 实现成本较大。

---

### 2.3 SlidePilot 的差异化定位

SlidePilot 不直接与 PPTAgent / ppt-master 在“原生 PPTX 能力”上硬碰。

SlidePilot 的核心差异化是：

> **HTML-native + Result-oriented + Browser QA + Non-technical UX**

即：

- 不把代码或 PowerPoint 对象作为用户中心。
- 把“可预览、可验收、可导出、可迭代修改”的结果作为中心。
- 用 HTML 作为第一交付格式，降低工程复杂度，提高展示质量。
- 用 Playwright 做自动浏览器验收，形成开源项目亮点。
- 后续再扩展 PPTX 导出或 PPTX 编辑。

---

## 3. 用户与场景

### 3.1 目标用户

#### 核心用户

1. 学生
   - 课程汇报
   - 组会汇报
   - 论文阅读分享
   - 答辩预演

2. 老师
   - 课程课件
   - 讲义
   - 公开课展示

3. 产品经理
   - 需求评审
   - 产品路线图
   - 竞品分析
   - 项目复盘

4. 运营 / 市场
   - 活动方案
   - 数据复盘
   - 品牌介绍
   - 小红书/抖音运营方案

5. 创业者
   - Pitch Deck
   - 商业计划书
   - Demo Day 展示

6. 研究人员
   - 论文分享
   - 研究进展汇报
   - 技术报告

7. 程序员
   - 技术分享
   - 开源项目介绍
   - 求职项目展示

---

### 3.2 用户痛点

#### 非技术用户痛点

- 不知道如何组织 PPT 结构。
- 做出来的 PPT 文字太多。
- 缺少视觉设计能力。
- 不会用高级 PPT 模板。
- 不知道如何把论文/文档转成展示。
- 改格式耗时。
- 想快速得到一个“能讲”的版本。
- 不关心代码，只关心展示效果。

#### 技术用户痛点

- Slidev / Marp / Reveal.js 对非程序员门槛高。
- 手写 Markdown slides 效率仍然低。
- 想快速从 README / 文档生成项目展示。
- 想要自动导出 PDF 和截图。
- 想要可复盘的生成过程。

---

## 4. 产品目标

### 4.1 短期目标：MVP

在 MVP 阶段，SlidePilot 要完成：

1. 用户输入主题或 Markdown 文本。
2. 系统生成结构化 presentation spec。
3. 系统生成 HTML slides。
4. 系统启动本地预览。
5. 系统使用浏览器自动验收。
6. 系统导出 PDF。
7. 系统生成结果报告。
8. 用户可以用自然语言进行一次迭代修改。

---

### 4.2 中期目标

1. 支持文档上传：Markdown、TXT、PDF、DOCX。
2. 支持模板系统：academic、startup pitch、tech talk、minimal、dark futuristic、apple keynote-like。
3. 支持单页编辑：例如“第 3 页太复杂，改简单”。
4. 支持 ZIP 打包导出。
5. 支持部署到 GitHub Pages / Vercel。

---

### 4.3 长期目标

1. 支持 PPTX 导出。
2. 支持已有 PPT 编辑。
3. 支持多模态输入：图片、表格、图表、网页链接。
4. 支持自动生成图表和 Mermaid。
5. 支持演讲稿生成和旁白。
6. 支持多人协作。
7. 支持模板市场或社区模板。

---

## 5. 产品原则

### 5.1 Result First

用户最终看到的是：

- 预览链接
- 演示文稿
- PDF
- 截图
- 验收报告

而不是代码 diff。

---

### 5.2 Story First

先生成叙事结构，再生成页面。

错误方式：

```text
直接生成 10 页零散幻灯片
```

正确方式：

```text
听众 → 目标 → 故事线 → 章节 → 单页内容 → 视觉表达
```

---

### 5.3 Spec First

所有生成都先经过结构化 spec：

```text
User Prompt → Requirement Spec → Deck Spec → Slide Spec → HTML
```

这样便于：

- 质量检查
- 后续修改
- 模板切换
- 导出不同格式
- Agent 反思

---

### 5.4 Browser Verified

生成后必须用浏览器检查：

- 页面是否加载成功
- 页数是否正确
- 是否有空页
- 是否有文字溢出
- 是否有图片加载失败
- 是否有 JS console error
- 是否可导出 PDF

---

### 5.5 Non-technical UX

用户不需要看到：

- JSX
- CSS
- npm install
- stack trace
- git diff

除非点击高级模式。

---

## 6. 核心用户流程

### 6.1 从主题生成 PPT

#### 输入

```text
帮我做一个 10 页 PPT，主题是“AI Agent 的发展趋势”，面向本科生，风格科技感，内容要通俗。
```

#### 流程

1. Requirement Parser 解析需求。
2. Planner 生成叙事结构。
3. Slide Generator 生成每页 spec。
4. Renderer 渲染 HTML。
5. QA Agent 打开浏览器检查。
6. Exporter 导出 PDF。
7. Report Generator 生成报告。

#### 输出

```text
Preview: http://localhost:4321/runs/ai-agent-trends
PDF: runs/ai-agent-trends/deck.pdf
Report: runs/ai-agent-trends/report.md
```

---

### 6.2 从 Markdown 生成 PPT

#### 输入

在 Web UI 中粘贴 Markdown 内容，或上传文件（P1）：

```text
将以下研究笔记做成 8 页学术风格 PPT，面向导师和组会同学：

[粘贴 Markdown 内容]
```

#### 输出

- 8 页 HTML slides
- 摘要页
- 方法页
- 实验页
- 结论页
- Q&A 页
- PDF

---

### 6.3 继续修改

#### 输入

```text
第 3 页太复杂，减少文字，多用图示。
```

#### 流程

1. 定位第 3 页。
2. 修改 slide spec。
3. 重新渲染。
4. 重新 QA。
5. 返回更新后的预览和截图。

---

### 6.4 风格切换

#### 输入

```text
整体改成更像苹果发布会，少文字，大标题。
```

#### 输出

- 重新应用模板。
- 调整字号、布局、留白和配色。
- QA 检查溢出。
- 导出新 PDF。

---

## 7. 功能需求

## 7.1 Requirement Parser

### 功能说明

将用户自然语言转换为结构化需求。

### 输入

```json
{
  "prompt": "帮我做一个 10 页 PPT，主题是 AI Agent 的发展趋势，面向本科生，科技感"
}
```

### 输出

```json
{
  "topic": "AI Agent 的发展趋势",
  "audience": "本科生",
  "page_count": 10,
  "language": "zh-CN",
  "tone": "通俗",
  "style": "科技感",
  "goal": "让本科生理解 AI Agent 是什么、为什么重要、未来机会在哪",
  "source_material": null,
  "output_formats": ["html", "pdf"]
}
```

### 验收标准

- 能识别主题。
- 能识别页数。
- 能识别听众。
- 能识别语言。
- 能识别风格。
- 缺失信息时使用合理默认值。

---

## 7.2 Presentation Planner

### 功能说明

根据需求生成完整叙事结构。

### 输出示例

```json
{
  "title": "AI Agent 的发展趋势",
  "subtitle": "从聊天机器人到自主任务执行系统",
  "storyline": "软件交互正在从工具使用走向目标委托",
  "sections": [
    {"name": "背景", "purpose": "解释为什么 Agent 成为热点", "slide_count": 2},
    {"name": "概念", "purpose": "区分 Chatbot 和 Agent", "slide_count": 2},
    {"name": "架构", "purpose": "解释 Agent 的核心组件", "slide_count": 2},
    {"name": "应用", "purpose": "展示典型落地场景", "slide_count": 2},
    {"name": "总结", "purpose": "总结趋势和启发", "slide_count": 2}
  ]
}
```

### 验收标准

- 章节总页数等于用户要求页数。
- 结构符合演讲逻辑。
- 每个 section 有明确 purpose。
- 不直接堆砌概念。

---

## 7.3 Slide Spec Generator

### 功能说明

将 deck plan 转换为结构化 slide spec。

### SlideSpec 示例

```json
{
  "id": "slide-03",
  "index": 3,
  "type": "concept",
  "title": "什么是 AI Agent？",
  "subtitle": "不只是聊天，而是能完成任务的系统",
  "layout": "title-left-diagram-right",
  "content": {
    "bullets": ["理解目标", "制定计划", "调用工具", "观察结果", "多轮修正"]
  },
  "visual": {
    "type": "flow_diagram",
    "description": "用户目标 → 计划 → 工具调用 → 结果反馈"
  },
  "speaker_notes": "这一页重点区分 Chatbot 和 Agent。"
}
```

### 支持的 slide type

P0:

- title
- agenda
- section
- concept
- comparison
- process
- summary
- quote
- qa

P1:

- chart
- timeline
- case-study
- architecture
- image-focus
- metrics
- table

---

## 7.4 HTML Renderer

### 功能说明

将 DeckSpec 渲染为 HTML slide deck。

### 输出文件

```text
runs/{run_id}/
  deck.json
  outline.md
  index.html
  style.css
  speaker-notes.md
  screenshots/
  report.md
  deck.pdf
```

### 技术要求

- 支持 16:9 比例。
- 支持键盘翻页。
- 支持打印样式。
- 支持响应式预览。
- 支持主题 CSS。
- 每页是独立 section。
- 每页有稳定 `data-slide-id`。

### 验收标准

- `index.html` 可直接在浏览器打开。
- 不依赖复杂后端。
- 页面样式统一。
- 支持导出 PDF。

---

## 7.5 Browser QA Agent

### 功能说明

用 Playwright 自动验收生成结果。

### P0 检查项

1. HTML 页面可打开。
2. Slide 数量正确。
3. 每页有标题。
4. 无空白页。
5. 无严重 console error。
6. 无明显文字溢出。
7. 页面截图成功。
8. PDF 导出成功。

### QA 输出

```json
{
  "passed": true,
  "score": 0.92,
  "checks": [
    {"name": "页面可打开", "status": "passed", "evidence": "HTTP 200"},
    {"name": "页数正确", "status": "passed", "evidence": "10 slides found"},
    {
      "name": "文字无溢出",
      "status": "failed",
      "slide_id": "slide-04",
      "evidence": "bullet container height exceeds slide viewport"
    }
  ],
  "screenshots": ["screenshots/slide-01.png", "screenshots/slide-02.png"]
}
```

---

## 7.6 Repair Loop

### 功能说明

当 QA 失败时自动修复。

### 支持修复类型

P0:

- 文字溢出
- 空页
- 标题缺失
- 页面渲染错误
- CSS 破坏布局
- PDF 导出失败

### 修复策略

```text
QA error → locate slide → modify SlideSpec / CSS → rerender → rerun QA
```

### 迭代限制

默认最多 3 轮。

---

## 7.7 Exporter

### P0 输出格式

- HTML
- PDF
- PNG screenshots
- ZIP package

### P1 输出格式

- PPTX
- Markdown
- Reveal.js
- Slidev
- Marp

---

## 7.8 Web UI

### MVP 页面结构

```text
左侧：需求输入 / 修改指令
中间：生成进度 / QA 结果
右侧：Slide iframe 预览
底部：导出按钮
```

### 页面能力

P0:

- 输入 prompt。
- 点击生成。
- 查看进度。
- 查看预览。
- 下载 PDF。
- 下载 ZIP。
- 输入修改指令。

P1:

- 查看每页截图。
- 查看 deck spec。
- 查看 speaker notes。
- 单页重新生成。
- 模板切换。

---

## 8. 非功能需求

### 8.1 性能

MVP 目标：

- 生成 8-10 页 deck：2-5 分钟内完成。
- QA 检查：30 秒内完成。
- PDF 导出：30 秒内完成。

---

### 8.2 可复现性

每次运行必须保存：

```text
runs/{run_id}/
  input.json
  requirement.json
  deck_plan.json
  deck.json
  qa.json
  report.md
  index.html
  deck.pdf
  trace.jsonl
```

---

### 8.3 可解释性

系统需要保留：

- 用户原始需求。
- 解析后的需求。
- 生成的大纲。
- 每页 slide spec。
- QA 检查结果。
- 修复记录。
- 最终导出结果。

---

### 8.4 安全性

- 默认只在本地生成文件。
- 不执行任意用户 shell。
- 不读取 `.env`、密钥文件。
- 不自动上传生成结果。
- 不自动发布到公网，除非用户明确要求。

---

### 8.5 易安装性

目标安装方式：

```bash
pip install slidepilot
playwright install chromium
slidepilot
# → 打开 http://127.0.0.1:4321
```

或开发模式：

```bash
git clone https://github.com/ranxi2001/SlidePilot
cd SlidePilot
pip install -e .
playwright install chromium
slidepilot
```

---

## 9. 技术方案

### 9.1 推荐技术栈

#### Agent / Backend

- Python 3.11+
- FastAPI (主入口)
- Pydantic
- Jinja2
- SSE-Starlette (实时进度推送)
- OpenAI-compatible API

#### Browser QA

- Playwright

#### Rendering

- HTML
- CSS
- Vanilla JS
- Optional: Tailwind build-free CDN in MVP

#### Export

- Playwright PDF
- ZIP file

#### Storage

- Local filesystem
- SQLite optional in P1

---

### 9.2 为什么不用原生 PPTX 作为 MVP

原生 PPTX 的优势是可编辑，但 MVP 直接做 PPTX 会带来：

- 对象模型复杂。
- 布局调试困难。
- 自动视觉验收困难。
- 不利于 Web preview。
- 导出和样式一致性难控制。

因此 SlidePilot 采用路线：

```text
P0: HTML + PDF
P1: Markdown / ZIP / templates
P2: PPTX export
P3: PPTX editing
```

---

### 9.3 为什么不用 Slidev / Marp 作为核心

Slidev / Marp 很成熟，但它们偏开发者工作流。

SlidePilot 需要：

- 结构化 DeckSpec。
- 可控 HTML DOM。
- 自定义 QA。
- 非技术用户 Web UI。
- 结果导向报告。

所以 MVP 推荐自研轻量 HTML renderer。后续可以支持导出 Slidev/Marp 格式。

---

## 10. 数据模型

### 10.1 RequirementSpec

```python
class RequirementSpec(BaseModel):
    topic: str
    audience: str
    page_count: int
    language: str = "zh-CN"
    tone: str = "clear"
    style: str = "modern"
    goal: str
    source_material: str | None = None
    output_formats: list[str] = ["html", "pdf"]
```

---

### 10.2 DeckPlan

```python
class DeckPlan(BaseModel):
    title: str
    subtitle: str | None
    goal: str
    storyline: str
    sections: list[DeckSection]
```

---

### 10.3 DeckSection

```python
class DeckSection(BaseModel):
    name: str
    purpose: str
    slide_count: int
```

---

### 10.4 SlideSpec

```python
class SlideSpec(BaseModel):
    id: str
    index: int
    type: Literal[
        "title",
        "agenda",
        "section",
        "concept",
        "comparison",
        "process",
        "summary",
        "quote",
        "qa"
    ]
    title: str
    subtitle: str | None = None
    layout: str
    content: dict
    visual: dict | None = None
    speaker_notes: str | None = None
```

---

### 10.5 DeckSpec

```python
class DeckSpec(BaseModel):
    id: str
    title: str
    language: str
    theme: str
    slides: list[SlideSpec]
```

---

### 10.6 QACheck

```python
class QACheck(BaseModel):
    name: str
    status: Literal["passed", "failed", "warning", "skipped"]
    slide_id: str | None = None
    evidence: str | None = None
```

---

### 10.7 QAResult

```python
class QAResult(BaseModel):
    passed: bool
    score: float
    checks: list[QACheck]
    screenshots: list[str]
```

---

### 10.8 RunTrace

```python
class RunTrace(BaseModel):
    run_id: str
    timestamp: datetime
    event_type: str
    payload: dict
```

---

## 11. Web API 设计

SlidePilot 以 Web 为主要交互界面，所有功能通过 HTTP API 暴露。

### 11.1 POST /api/create

创建新的演示文稿。支持 SSE 实时推送生成进度。

Request:

```json
{
  "prompt": "帮我做一个 10 页 PPT，主题是 AI Agent 的发展趋势，面向本科生，科技感",
  "pages": 10,
  "style": "tech-dark",
  "language": "zh-CN"
}
```

Response (SSE events):

```text
event: progress
data: {"step": "requirement", "status": "done"}

event: progress
data: {"step": "planner", "status": "done"}

event: progress
data: {"step": "render", "status": "done"}

event: progress
data: {"step": "qa", "status": "done", "score": 0.92}

event: complete
data: {"run_id": "ai-agent-trends", "preview_url": "/runs/ai-agent-trends", "pdf_url": "/runs/ai-agent-trends/deck.pdf"}
```

---

### 11.2 POST /api/edit

修改已有的演示文稿。

Request:

```json
{
  "run_id": "ai-agent-trends",
  "instruction": "第 3 页减少文字，多用图示"
}
```

---

### 11.3 GET /runs/{run_id}

预览生成的 HTML slides。

---

### 11.4 GET /runs/{run_id}/deck.pdf

下载 PDF 文件。

---

### 11.5 GET /api/runs

列出历史生成记录。

---

### 11.6 启动方式

```bash
# 安装后直接启动 Web 服务
slidepilot
# → http://127.0.0.1:4321
```

---

## 12. Web UI 设计

SlidePilot 的主交互界面是浏览器页面。用户打开 `http://127.0.0.1:4321` 即可使用，无需任何终端操作。

### 12.1 首页（输入 + 生成）

单页应用，包含：

- Prompt 输入框（多行文本）
- 风格选择下拉框
- 页数输入
- 生成按钮
- 示例 prompt 提示

示例 prompt:

```text
帮我做一个 8 页 PPT，主题是”AI Agent 如何改变软件开发”，面向产品经理，风格商务科技。
```

---

### 12.2 生成进度

点击生成后，页面展示实时进度（通过 SSE 推送）：

```text
✓ 解析需求
✓ 规划叙事结构
⏳ 生成 slide spec...
```

---

### 12.3 结果预览

生成完成后展示：

```text
┌──────────────────────────────────────────────────────┐
│  Slide Preview (iframe)                              │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │                                                │  │
│  │         rendered HTML slides                   │  │
│  │                                                │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  [下载 PDF]  [下载 HTML]  [QA 报告]                  │
│                                                      │
│  修改指令：[___________________________________]     │
│                                                      │
└──────────────────────────────────────────────────────┘
```

功能：

- iframe 内嵌预览生成的 slides
- 下载 PDF / HTML
- 查看 QA score 和 screenshots
- 输入修改指令触发迭代编辑

---

## 13. 主题与模板

### 13.1 MVP 主题

P0:

1. `modern-light`
2. `tech-dark`
3. `academic`
4. `business`
5. `minimal`

---

### 13.2 模板能力

每个主题包括：

```text
themes/{theme_name}/
  theme.css
  layouts/
    title.html
    concept.html
    comparison.html
    process.html
    summary.html
```

---

### 13.3 设计约束

- 每页最多 5 个 bullet。
- 每个 bullet 不超过 28 个中文字符或 18 个英文单词。
- 标题不超过 2 行。
- 保持统一边距。
- 统一字体层级。
- 使用高对比度配色。
- 不允许满屏小字。

---

## 14. Browser QA 详细设计

### 14.1 页面加载检查

- 打开 `index.html`
- 等待 `networkidle`
- 检查 HTTP 状态
- 捕获 console error

---

### 14.2 页数检查

```js
document.querySelectorAll("[data-slide-id]").length
```

与 `DeckSpec.slides.length` 对比。

---

### 14.3 空页检查

每页检查：

- title 是否存在。
- text content 长度是否大于阈值。
- 是否有可见内容元素。

---

### 14.4 溢出检查

每页检查：

```js
element.scrollHeight > element.clientHeight
element.scrollWidth > element.clientWidth
```

重点检查：

- slide root
- title
- content block
- bullet list
- diagram container

---

### 14.5 截图检查

每页生成截图：

```text
screenshots/slide-01.png
screenshots/slide-02.png
...
```

---

### 14.6 PDF 检查

导出 PDF 后检查：

- 文件存在。
- 文件大小大于最小阈值。
- 页数可选检查。

---

## 15. Agent Workflow

### 15.1 Create Workflow

```text
1. Receive user input
2. Parse requirement
3. Generate deck plan
4. Generate slide specs
5. Render HTML
6. Run browser QA
7. If failed, repair up to 3 rounds
8. Export PDF
9. Generate report
10. Return preview and files
```

---

### 15.2 Edit Workflow

```text
1. Load existing deck.json
2. Parse edit instruction
3. Determine affected slides/theme
4. Modify deck spec
5. Rerender HTML
6. Run browser QA
7. Export new PDF
8. Update report
```

---

### 15.3 Repair Workflow

```text
1. Read QA failure
2. Locate slide/spec/theme issue
3. Generate minimal repair
4. Rerender
5. Recheck
```

---

## 16. 报告设计

### 16.1 report.md

```markdown
# SlidePilot Report

## Status

SUCCESS

## Topic

AI Agent 的发展趋势

## Audience

本科生

## Output

- HTML: index.html
- PDF: deck.pdf
- Screenshots: screenshots/

## Deck Structure

1. 标题页
2. 为什么 Agent 变重要
3. 什么是 AI Agent
4. Agent 的核心架构
5. 典型应用
6. 发展趋势
7. 机会与挑战
8. 总结

## QA Result

Passed: 8/8

- 页面可打开: passed
- 页数正确: passed
- 无空白页: passed
- 无文字溢出: passed
- PDF 导出: passed

## Suggested Next Edits

- 加一页案例
- 改成更商务的风格
- 加演讲者备注
```

---

## 17. 开源项目展示策略

### 17.1 README 必须展示

1. 项目一句话。
2. Demo GIF。
3. 输入 prompt。
4. 生成结果截图。
5. PDF 下载示例。
6. QA report 示例。
7. 快速开始。
8. 和参考项目/竞品的差异。
9. Roadmap。

---

### 17.2 推荐 README 开头

```markdown
# SlidePilot

AI agent that turns ideas, docs, and research notes into polished HTML presentations.

Unlike traditional PPT generators, SlidePilot does not stop at slide text.
It plans the storyline, renders browser-native slides, runs Playwright-based visual QA,
repairs layout issues, and exports a presentation-ready PDF.
```

---

### 17.3 Demo 示例

在浏览器 `http://127.0.0.1:4321` 中输入：

```text
Create a 10-slide presentation about the future of AI agents for undergraduate students, in a futuristic dark style.
```

页面实时显示：

```text
✓ Parsed requirement
✓ Planned storyline
✓ Generated 10 slides
✓ Rendered HTML
✓ Browser QA passed
✓ Exported PDF

Preview: [iframe 内嵌预览]
[下载 PDF]  [下载 HTML]
```

---

## 18. MVP 范围

### 18.1 P0 必须完成

- Web UI (prompt input → preview → download)
- FastAPI server + SSE progress
- Prompt to RequirementSpec
- RequirementSpec to DeckPlan
- DeckPlan to DeckSpec
- DeckSpec to HTML
- 1 个默认主题 (modern-light)
- Browser QA
- QA repair loop
- PDF export
- report.md
- run trace
- README demo

---

### 18.2 P0 不做

- 原生 PPTX 导出
- PPTX 编辑
- 多人协作
- 模板市场
- 用户登录
- 云端部署
- 图片生成
- 复杂图表生成
- 复杂 PDF 解析

---

### 18.3 P1

- 多主题 (tech-dark, minimal, academic, business)
- Markdown file upload
- ZIP export
- speaker notes
- 单页 edit
- Mermaid diagram support
- chart slide
- GitHub Pages deploy
- CLI interface (optional developer entry point)

---

### 18.4 P2

- PDF/DOCX input
- PPTX export
- existing deck editing
- voice narration
- template import
- multi-agent mode

---

## 19. 成功指标

### 19.1 工程指标

- 8-10 页 deck 可稳定生成。
- Browser QA 通过率大于 80%。
- PDF 导出成功率大于 90%。
- 文字溢出问题能自动修复。
- 每次运行都有完整 trace。

---

### 19.2 产品指标

- 非技术用户能通过 prompt 得到可用 slides。
- 生成结果可以直接用于预览或分享。
- 用户能通过自然语言继续修改。
- README demo 能在 3 分钟内跑通。

---

### 19.3 求职展示指标

- GitHub README 足够直观。
- 有在线 demo 或录屏。
- 有清晰架构图。
- 有参考项目对比。
- 有技术亮点说明：
  - Spec-first
  - HTML-native
  - Browser QA
  - Repair loop
  - Result-oriented UX

---

## 20. 风险与应对

### 20.1 风险：和已有 PPT Agent 项目同质化

应对：

- 不主打原生 PPTX。
- 不主打研究型 Agentic Framework。
- 主打 HTML-native、浏览器验收和结果导向 UX。
- README 中明确对比 PPTAgent / ppt-master。

---

### 20.2 风险：HTML 不如 PPTX 普适

应对：

- MVP 用 HTML/PDF 快速形成高质量结果。
- P2 加 PPTX export。
- 对外强调：
  - HTML 适合预览、分享、自动验收。
  - PDF 适合正式交付。
  - PPTX 是后续扩展。

---

### 20.3 风险：生成效果不稳定

应对：

- 使用结构化 DeckSpec。
- 限制每页文字量。
- 固定 layout 类型。
- Browser QA 自动检测。
- Repair loop 自动修复。

---

### 20.4 风险：视觉效果普通

应对：

- 预置高质量 CSS 主题。
- 优先打磨 `tech-dark` 和 `minimal` 两个主题。
- README 只展示高质量 demo。
- 控制 slide 类型，不做复杂自由布局。

---

### 20.5 风险：安装复杂

应对：

- 使用 Python + Playwright。
- 提供 Docker。
- 提供 GitHub Codespaces 配置。
- 提供示例输出，不要求用户必须立刻跑。

---

## 21. 里程碑

### Phase 1: Web Server + Core Pipeline

目标：从 prompt 到 HTML slides 的端到端流程，通过浏览器交互。

交付：

- FastAPI server + Web UI
- requirement parser
- deck planner
- slide generator
- HTML renderer
- 1 个默认主题 (modern-light)

---

### Phase 2: Browser QA + PDF + SSE

目标：让结果可自动验收、实时反馈进度、并导出。

交付：

- SSE 实时进度推送
- Playwright QA
- screenshot export
- PDF export
- report.md
- repair loop v1

---

### Phase 3: Iterative Editing + Themes

目标：支持自然语言修改和多主题切换。

交付：

- POST /api/edit
- 单页/全局修改
- 风格切换
- tech-dark / minimal 主题
- rerender + QA

---

### Phase 4: Open Source Polish

目标：让项目适合求职展示。

交付：

- README + demo GIF
- architecture diagram
- examples
- Dockerfile
- GitHub Actions
- roadmap

---

## 22. 项目目录

```text
SlidePilot/
  README.md
  LICENSE
  pyproject.toml
  .env.example
  Dockerfile

  docs/
    PRD.md

  slidepilot/              # Python package
    __init__.py
    server.py              # FastAPI app entry point
    routes.py              # API routes

    agent/
      orchestrator.py      # Pipeline coordinator
      requirement.py
      planner.py
      slide_generator.py
      repair.py

    models/
      deck.py              # Pydantic schemas
      qa.py

    renderer/
      html_renderer.py
      templates/

    themes/
      modern-light/
        theme.css
      tech-dark/
        theme.css
      minimal/
        theme.css

    qa/
      browser.py           # Playwright QA

    export/
      pdf.py

    storage/
      run_store.py

    report/
      generator.py

  web/                     # Static frontend (zero-build)
    templates/
      index.html
    static/
      css/app.css
      js/app.js

  examples/
  tests/
```

---

## 23. 初始 Prompt 模板

### 23.1 Requirement Parser Prompt

```text
You are a presentation product manager.
Convert the user's request into a structured presentation requirement.

Return strict JSON:
{
  "topic": "...",
  "audience": "...",
  "page_count": 8,
  "language": "zh-CN",
  "tone": "...",
  "style": "...",
  "goal": "...",
  "constraints": []
}
```

---

### 23.2 Deck Planner Prompt

```text
You are a presentation strategist.
Create a clear storyline and section plan for the deck.

Requirements:
- The total number of slides must equal page_count.
- The deck should have a coherent narrative.
- Avoid generic section names when possible.
- Make it suitable for the target audience.
```

---

### 23.3 Slide Generator Prompt

```text
You are a senior presentation designer.
Generate structured slide specs.

Rules:
- Each slide must have a clear purpose.
- Do not overload slides with text.
- Prefer visual explanation over long paragraphs.
- Use slide types from the allowed list.
- Return strict JSON.
```

---

### 23.4 Repair Prompt

```text
You are a slide layout repair agent.
Given a failed QA result and the current slide spec, modify only what is necessary.

Common fixes:
- reduce bullet count
- shorten text
- split content
- change layout
- adjust visual description

Return the repaired slide spec.
```

---

## 24. 开源差异化说明

README 中建议加入：

```markdown
## Why SlidePilot?

Most AI PPT tools focus on generating PowerPoint files.
Most developer slide tools focus on Markdown or code.

SlidePilot focuses on the missing middle:

- non-technical users
- result-first workflow
- browser-native slides
- automatic visual QA
- repair loop
- exportable HTML/PDF
```

---

## 25. 参考项目对比

| Project | Main Output | Target User | Agentic Workflow | Browser QA | HTML-native | PPTX-native |
|---|---|---|---|---|---|---|
| PPTAgent | PPTX | Researchers / developers | Yes | Limited | No | Yes |
| ppt-master | PPTX | PowerPoint users | Workflow-based | No | No | Yes |
| Azure presentation builder | PPTX | Azure developers | Yes | No | No | Yes |
| ppt-agent | HTML/SVG | Chinese AI users | Yes | Limited | Yes | No |
| ppt-agent-skills | PPT/code | Developers | Yes | Limited | Partial | Partial |
| Talk-to-Your-Slides | PPT editing | Researchers | Yes | No | No | Yes |
| SlidePilot | HTML/PDF | Non-technical users | Yes | Yes | Yes | P2 |

---

## 26. 最终推荐 MVP 定义

SlidePilot v0.1 只需要做到：

```text
Prompt / Markdown
    → Requirement Spec
    → Storyline Plan
    → Deck Spec
    → HTML Slides
    → Browser QA
    → Repair Loop
    → PDF Export
    → Report
```

这条链路跑通，就已经是一个非常适合开源求职展示的项目。

---

## 27. 项目愿景

SlidePilot 的长期愿景是：

> 成为一个开放、可本地运行、可扩展的 AI Presentation Agent，让任何人都能从想法、资料和研究笔记快速获得可展示的专业演示文稿。

它不是为了取代 PowerPoint，而是为了降低“从想法到可展示结果”的门槛。

---
