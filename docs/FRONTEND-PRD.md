# SlidePilot 前端设计 PRD

版本：2026-06-03  
适用范围：`public/index.html`、`public/css/app.css`、`public/js/app.js`  
设计参考：`frontend-design`、`ui-ux-pro-max`、`figma-generate-design / figma-implement-design / figma-use`

## 1. 产品定位

SlidePilot 不是营销页，也不是单纯的表单 Demo。它应该呈现为一个“实时 Agent 演示文稿工作台”：用户在左侧下达任务，右侧实时看到 Agent 的阶段、工具调用、QA 结果、预览、下载和人工修订入口。

核心体验目标：

- 让非技术用户相信结果可交付：完成后第一眼看到预览、下载和质量结论。
- 让开发者相信 Agent 真在工作：生成中能看到阶段、工具、产物和 QA 事件。
- 让修订闭环足够短：发现问题后能直接选页、输入修改指令、重新生成产物。
- 不展示模型私有 chain-of-thought，只展示安全可见的阶段、工具、输入输出摘要、QA 和产物。

## 2. 设计方向

### 2.1 美学方向

采用“高密度实时运营工作台”风格：深色 OLED 底、精确数据排版、清晰状态色、少装饰、强层级。视觉应该像 Linear / Vercel / 数据监控台与 Agent 控制台的结合，而不是普通紫色渐变 AI 产品。

必须避免：

- 大面积紫蓝渐变、漂浮光球、装饰性 blob。
- 大圆角营销卡片堆叠。
- 只靠颜色表达状态。
- 日志区域无限增长把结果预览挤到首屏外。
- 显示“思维链”“CoT”“内部推理”等敏感概念。

### 2.2 设计原则

- 结果优先：生成完成后，预览区必须成为右侧主视觉。
- 过程可见：生成中展示当前阶段、工具调用和关键事件，不让用户面对黑盒。
- 信息分层：重要状态在顶部，详细日志可过滤、可折叠、可滚动。
- 决策友好：QA 不是工程列表，而是“可交付 / 需修订 / 失败”的判断面板。
- 密度克制：桌面端信息密度高，但每个区域必须有明确边界、标题和状态。
- 无框架约束：继续使用原生 HTML/CSS/JS，不引入 React/Vue/Svelte。

## 3. 目标用户

| 用户 | 主要任务 | 前端重点 |
| --- | --- | --- |
| 非技术用户 | 输入想法，拿到可下载 PPT/PDF/HTML | 简单输入、清晰预览、一键下载、低门槛修订 |
| 开发者 | 验证 Agent 管线和工具调用 | 实时事件、阶段状态、产物链接、错误详情 |
| 产品/运营 | 快速制作讲解材料 | 示例需求、主题选择、质量判断、二次修订 |
| 研究/工程团队 | 复盘失败原因 | QA、截图、修订历史、报告、事件过滤 |

## 4. 页面信息架构

桌面端推荐结构：

```text
┌──────────────────────────────────────────────────────────────────────────┐
│ Header: Brand / model status / run status / quick actions                 │
├──────────────────────┬───────────────────────────────────────────────────┤
│ Command Panel         │ Main Workbench                                    │
│ - prompt              │ ┌───────────────────────────────────────────────┐ │
│ - style/pages         │ │ Result Preview or Live Run Summary            │ │
│ - output options      │ │ downloads / QA badge / revision entry         │ │
│ - examples            │ └───────────────────────────────────────────────┘ │
│ - primary CTA         │ ┌───────────────────────────────────────────────┐ │
│                       │ │ Agent Process: stage grid + key timeline      │ │
│                       │ └───────────────────────────────────────────────┘ │
│                       │ ┌───────────────────────────────────────────────┐ │
│                       │ │ QA / screenshots / assets / revision history  │ │
│                       │ └───────────────────────────────────────────────┘ │
└──────────────────────┴───────────────────────────────────────────────────┘
```

布局规则：

- 1440px 以上：`360px-400px` 左侧命令面板 + 右侧弹性工作区。
- 1024px 到 1439px：左侧收窄到 `320px-340px`，右侧保持预览优先。
- 900px 以下：单列布局，输入在上，结果在下，事件列表高度限制。
- 任何宽度下不能出现横向滚动。
- 生成完成后右侧排序为：结果预览、下载/修订、QA、过程详情。
- 生成中右侧排序为：当前运行摘要、阶段网格、关键事件、预览占位。

## 5. 核心状态

### 5.1 初始状态

首屏必须同时包含：

- 左侧输入面板。
- 右侧空状态，不允许大面积空白。
- 示例需求 chips，例如“4 页产品介绍”“8 页技术方案”“6 页路演稿”。
- 工作流预告：需求解析、页面生成、浏览器 QA、导出、修订。
- Mock 模式或模型连接状态。

验收：

- 用户 5 秒内知道如何开始。
- 右侧没有纯空白区域。
- CTA 只有一个主按钮：`生成演示文稿`。

### 5.2 生成中

右侧顶部展示 `LiveRunSummary`：

- 当前阶段标题，例如“正在生成第 3 / 8 页”。
- 阶段进度条：需求、规划、风格、页面、QA、修复、导出、报告。
- 当前工具/模型调用摘要，例如“正在运行 Browser QA”。
- 运行时长和事件数量。

事件列表默认只展示关键事件：

- LLM start / done / error。
- Tool start / done / error。
- Artifact saved。
- QA fail / warn。
- Repair round start / done。

详细事件放在“展开全部事件”里，且事件列表必须有固定最大高度。

验收：

- 用户不滚动也能看到当前阶段。
- 事件列表不会把页面撑到很长。
- 错误、警告、产物保存的视觉优先级高于普通日志。

### 5.3 生成完成

完成后主工作区切换为结果优先：

- 顶部是 16:9 预览 iframe。
- 预览工具栏包含：打开新窗口、下载 HTML、下载 PDF、下载 PPTX。
- QA badge 显示 `可交付`、`需修订` 或 `失败`。
- 修订入口紧贴预览下方或右侧工具栏，不沉到底部。
- Agent 过程折叠为“过程详情”，默认保留最近 10 条关键事件。

验收：

- 1440x900 首屏能看到预览和下载按钮。
- PPTX/PDF 不存在时按钮置灰或隐藏，并给出原因。
- iframe 加载失败时显示可操作兜底，不展示空白大块。

### 5.4 单页修订

修订区包含：

- 页码输入。
- 页面缩略图选择，P1 可先用截图画廊实现。
- 修改指令 textarea。
- 快捷指令 chips，例如“减少文字”“强化视觉层级”“修复重叠”“改成三栏”。
- `修订此页` 按钮。
- 修订历史。

交互规则：

- 修订中按钮进入 loading 并禁用。
- 修订失败保留用户输入。
- 修订成功后刷新预览、QA、下载链接和修订历史。
- 点击 QA 问题或截图可自动选中对应页。

## 6. 组件规格

### 6.1 AppHeader

内容：

- 品牌：`SlidePilot`。
- 副标题：`把想法变成可预览、可导出的演示文稿`。
- Provider 状态：已连接 / Mock 模式 / 连接失败。
- 当前 run 状态：空闲 / 生成中 / 已完成 / 失败。

视觉：

- 高度约 `64px`。
- 状态 pill 使用边框和文字，不使用大面积填充。
- 连接成功使用青绿色，失败使用红色，Mock 使用琥珀色。

### 6.2 CommandPanel

字段：

- prompt textarea。
- style select。
- pages number input。
- 可选开关：生成图片、导出 PPTX、严格 QA。
- 示例 prompt chips。
- 主按钮。

状态：

- idle。
- invalid prompt。
- generating。
- provider not configured。
- mock mode。

规则：

- textarea 最小高度 `160px`，最大高度不超过首屏一半。
- 主按钮最小高度 `44px`。
- 输入和按钮必须有 visible focus。
- 长中文 prompt 不得撑破容器。

### 6.3 LiveRunSummary

展示：

- 当前阶段。
- 进度百分比或阶段完成数。
- 当前工具/模型摘要。
- 用时、事件数、QA 分数。

状态表达：

- running：蓝色边框 + 轻微脉冲点。
- warning：琥珀色 badge。
- error：红色边框 + 错误摘要。
- done：青绿色 badge。

### 6.4 StageGrid

阶段：

- 需求解析。
- 大纲规划。
- 风格锁定。
- 页面生成。
- 浏览器 QA。
- 修复回路。
- 预览组装。
- PDF 导出。
- PPTX 导出。
- 报告归档。

每个 stage 展示：

- 图标或状态点。
- 阶段名。
- 一行摘要。
- 状态：pending / running / done / warn / error。

布局：

- 桌面端 5 列或 4 列。
- 平板 2 列。
- 手机 1 列或横向滚动 chips，但不得造成页面横向滚动。

### 6.5 EventTimeline

字段：

- 时间。
- 类型：LLM / TOOL / ARTIFACT / QA / REPAIR / PHASE / ERROR。
- 页面编号。
- 标题。
- 摘要。
- 可选详情。

交互：

- 类型过滤。
- 只看失败/警告。
- 自动滚动到底部，但用户手动滚动后暂停自动滚动。
- 点击 stage 过滤对应事件，P1 可后置。

文案规则：

- 使用“模型调用”“工具执行”“产物保存”“QA 检查”等可理解中文。
- 不出现 CoT、思维链、内部推理。
- 错误要说明下一步，例如“请下载 HTML 检查”或“可尝试修订此页”。

### 6.6 ResultPreview

内容：

- iframe preview。
- 当前页指示。
- 下载按钮。
- QA badge。
- 打开新窗口。

约束：

- 固定 `aspect-ratio: 16 / 9`。
- 桌面端最小高度 `360px`，最大高度 `620px`。
- 背景必须显式为白色或棋盘格，不允许深色容器里出现不明空白。
- 加载中显示 skeleton。
- 加载失败显示 fallback actions。

### 6.7 QualityPanel

把 QA 转为用户决策：

- 总状态：可交付 / 需修订 / 失败。
- 分数：例如 `0.94`。
- fail / warn 数量。
- 问题列表按严重程度排序。
- 每条问题包含页码、类型、说明、建议动作。

推荐分组：

- `布局`：重叠、裁切、安全区。
- `像素`：空白比例、截图过小、低对比度。
- `内容`：竖排文字、标题缺失、文本溢出。
- `产物`：PDF/PPTX/HTML 导出状态。

### 6.8 ScreenshotGallery

内容：

- 每页缩略图。
- 页码。
- 文件大小。
- QA 状态标记。

交互：

- 点击打开原图。
- 点击选中修订页。
- 有 QA 问题的页面优先标记。

### 6.9 RevisionPanel

内容：

- 页码。
- 修改指令。
- 快捷指令 chips。
- 修订按钮。
- 历史记录。

状态：

- idle。
- revising。
- success。
- failed。

验收：

- 修订控件不会挤压预览。
- 修订历史不会无限撑高页面，超过高度后内部滚动。
- 修订完成无需刷新页面。

## 7. 视觉设计系统

### 7.1 色彩 Token

推荐暗色主题：

| Token | 值 | 用途 |
| --- | --- | --- |
| `--bg` | `#06080d` | 页面背景 |
| `--surface` | `#11151c` | 主面板 |
| `--surface-raised` | `#171d27` | 浮层、输入区 |
| `--surface-soft` | `#0d1118` | iframe 外壳、日志项 |
| `--line` | `#283241` | 边框 |
| `--line-strong` | `#3a4658` | 激活边框 |
| `--text` | `#f6f8fb` | 主文字 |
| `--muted` | `#9aa7b6` | 次文字 |
| `--subtle` | `#667386` | 辅助文字 |
| `--blue` | `#4f8cff` | 主操作、运行中 |
| `--cyan` | `#23d6c5` | 成功、已完成 |
| `--amber` | `#f0b84b` | 警告、Mock |
| `--red` | `#ff6b6b` | 错误 |

规则：

- 功能色必须配合文字或图标，不只靠颜色。
- 不使用大面积渐变。
- 发光效果只允许用于当前运行点、焦点或关键状态，且透明度低。

### 7.2 字体

推荐：

- UI 字体：`Fira Sans`, `Noto Sans SC`, system sans-serif。
- 数据/时间/事件编号：`Fira Code`, `JetBrains Mono`, monospace。

不强制引入远程字体。若使用 Google Fonts，必须加 `display=swap`，并保留本地 fallback。

字号：

- 页面标题：`28px-32px`。
- 面板标题：`16px-18px`。
- 正文：`14px-15px`。
- 辅助信息：`12px-13px`。
- 按钮：`14px-15px`。

规则：

- 不使用负 letter spacing。
- 数据列使用等宽数字，避免计时器抖动。
- 中文长句允许换行，不使用强制单行导致溢出。

### 7.3 间距、圆角、边框

- 基础间距：`4px / 8px / 12px / 16px / 24px / 32px`。
- 面板圆角：`8px`。
- 按钮圆角：`8px`。
- 缩略图圆角：`6px`。
- 不使用 `16px+` 的大圆角卡片。
- 卡片只用于重复项，如 stage、event、screenshot、QA issue。
- 页面区域不做卡片套卡片，使用全宽面板和清晰分隔线。

### 7.4 动效

- 常规 hover / press：`150ms-220ms`。
- 面板展开：`180ms-260ms`。
- 进度变化：`200ms-300ms`。
- 禁止装饰性无意义动画。
- 支持 `prefers-reduced-motion: reduce`。

## 8. 可访问性与交互质量

必须满足：

- 正文对比度至少 WCAG AA。
- 所有按钮、输入、链接有键盘 focus。
- 交互目标最小 `44px` 高。
- iframe、按钮、缩略图、状态 badge 有可理解的 label 或文本。
- 事件更新区域使用适度的 `aria-live`，避免读屏刷屏。
- 错误信息显示在相关区域附近。
- 禁用状态必须有视觉差异和文本提示。

## 9. 响应式规则

### 1440px+

- 双列工作台。
- 右侧结果预览优先。
- StageGrid 4-5 列。
- QualityPanel 可 2 列。

### 1024px-1439px

- 双列但左侧收窄。
- EventTimeline 高度限制更严格。
- 下载按钮允许换行。

### 768px-1023px

- 单列。
- Header 状态换行。
- StageGrid 2 列。
- 预览保持 16:9，最小高度降低。

### 375px-767px

- 单列。
- 输入、按钮、下载操作全宽。
- EventTimeline 简化为时间 + 标题 + 摘要。
- QA 和截图改为纵向列表。
- 不追求完整桌面工作台体验，但不能横向溢出。

## 10. 错误、空状态和降级

### 10.1 `/api/status` 失败

- Header 显示“连接失败”。
- 主按钮仍可用时标注 Mock/降级状态。
- 不阻塞页面渲染。

### 10.2 `/api/create-stream` 失败

- LiveRunSummary 显示失败状态。
- EventTimeline 追加错误事件。
- 保留用户输入。
- 提供“重新生成”入口。

### 10.3 `/api/runs/:runId` 404

- 不展示大块错误面板。
- 使用生成结果内的 `qa` 和 `screenshots` 降级展示。
- 在 QA 面板底部显示小提示：“详情接口不可用，已使用本次结果降级展示”。

### 10.4 iframe 加载失败

- 预览区域显示：
  - “预览加载失败”。
  - “打开 HTML”。
  - “下载 HTML”。
  - “查看报告”。

### 10.5 PPTX/PDF 缺失

- 按钮隐藏或置灰。
- 若有错误原因，显示在下载区的次级提示中。

## 11. 数据接口

当前前端依赖：

- `GET /api/status`
- `POST /api/create-stream`
- `GET /api/runs/:runId`
- `POST /api/runs/:runId/slides/:pageIndex/revise`
- `POST /api/images/generate`
- `POST /api/images/edit`

结果结构：

```ts
type PipelineResult = {
  runId: string;
  previewUrl: string;
  pdfUrl?: string;
  pptxUrl?: string;
  totalPages: number;
  qa: {
    passed: boolean;
    score: number;
    checks: QACheck[];
    screenshots: string[];
  };
};
```

运行详情：

```ts
type RunDetail = {
  runId: string;
  topic: string;
  totalPages: number;
  artifacts: {
    previewUrl?: string;
    pdfUrl?: string;
    pptxUrl?: string;
    reportUrl?: string;
  };
  qa: QAResult;
  screenshots: AssetFile[];
  assets: AssetFile[];
  revisions: Revision[];
};
```

事件建议结构：

```ts
type AgentEvent = {
  type: "progress" | "result" | "error";
  kind: "phase" | "llm" | "tool" | "artifact" | "qa" | "repair" | "error";
  status: "start" | "running" | "done" | "warn" | "error";
  step: string;
  pageIndex?: number;
  message?: string;
  detail?: string;
  elapsedMs?: number;
  stepElapsedMs?: number;
};
```

## 12. Figma / 设计交付

当需要转 Figma 时：

- 使用 `figma-use` 作为所有 Figma 操作前置技能。
- 从代码或本 PRD 生成完整页面时使用 `figma-generate-design`。
- 从 Figma 还原代码时使用 `figma-implement-design`。

建议 Figma frame：

- `SlidePilot / Desktop / Idle`
- `SlidePilot / Desktop / Generating`
- `SlidePilot / Desktop / Complete`
- `SlidePilot / Desktop / Revision`
- `SlidePilot / Mobile / Complete`

每个 frame 必须包含状态标注和组件命名，方便后续实现比对。

## 13. 实施计划

### Iteration 1：结果优先布局

- 调整主布局为稳定双列工作台。
- 生成完成后 ResultPreview 置顶。
- iframe 16:9 固定比例和失败兜底。
- 下载按钮状态清晰。
- 修复首屏结果区域被日志挤压的问题。

### Iteration 2：实时过程体验

- 新增 LiveRunSummary。
- StageGrid 状态细化。
- EventTimeline 增加关键事件模式和过滤。
- 自动滚动在用户手动滚动后暂停。

### Iteration 3：QA 决策面板

- QA 总状态转成可交付/需修订/失败。
- 按页码和问题类型分组。
- 截图缩略图关联 QA 问题。
- 详情接口 404 降级展示。

### Iteration 4：修订闭环

- 缩略图选页。
- 快捷修订 chips。
- 修订历史内部滚动。
- 修订完成后自动刷新预览、QA 和下载链接。

### Iteration 5：视觉抛光与验证

- 应用设计 token。
- 增加空状态、加载 skeleton、错误 fallback。
- Playwright 截图检查桌面和移动端。
- 检查文本溢出、重叠、低对比度、横向滚动。

## 14. 验收标准

功能验收：

- 生成中实时显示当前阶段、工具调用和关键事件。
- 生成完成后首屏显示预览、下载和 QA 状态。
- QA 面板能显示 fail/warn/pass，并给出用户可理解说明。
- 截图画廊能展示每页缩略图。
- 单页修订完成后刷新预览和产物链接。
- `/api/runs/:runId` 失败时有降级展示。

视觉验收：

- 1440x900 下无明显重叠和首屏空白。
- 1600x1200 下左侧命令区不漂移，右侧工作区不跑偏。
- 375px 移动端无横向滚动。
- 按钮文字不溢出。
- iframe 比例稳定。
- 事件列表、修订历史、QA 列表不会无限撑高页面。

测试验收：

- `npm run build` 通过。
- `npm run test:run` 通过。
- Playwright smoke 覆盖：
  - 初始空状态。
  - 正常生成完成状态。
  - run detail 404 降级状态。
  - 修订完成刷新状态。
  - 375px / 1440px / 1600px 布局截图。

## 15. 风险

- 过度强调 trace 会让用户忽略结果，需要完成态结果优先。
- QA 数据太工程化，需要转成用户可理解的质量结论。
- 深色高密度界面容易低对比，必须做对比度检查。
- iframe 内容来自生成 HTML，外壳尺寸和兜底必须稳定。
- 不应展示私有推理链，只展示可公开的 Agent 阶段与工具事件。
