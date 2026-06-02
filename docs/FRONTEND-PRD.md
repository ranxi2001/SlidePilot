# SlidePilot 前端 PRD

## 1. 背景

SlidePilot 已经具备 Agent 生成、实时事件流、QA、修订、PDF/PPTX 下载和图片工具能力，但当前前端仍偏工程验证界面。主要问题是：

- 输入区、Agent 过程、结果预览和质量面板的层级不够清晰。
- 生成完成后用户要滚动很久才能看见预览、截图和 QA。
- Agent trace 信息量足够，但缺少“当前进度”和“重要事件优先级”。
- QA、截图、修订历史是工程数据，尚未转化成面向非技术用户的决策界面。
- 视觉风格有基础，但仍缺少产品级细节，如密度控制、状态反馈、空状态和错误状态。

本 PRD 定义下一轮前端美化和交互优化范围。

## 2. 目标

### 2.1 用户目标

- 用户打开页面后能立即理解：输入需求、观察 Agent、预览结果、下载/修订。
- 生成过程中能看到 Agent 正在做什么、用了哪些工具、是否遇到 QA 问题。
- 生成完成后第一眼看到 deck 预览和下载入口，而不是被日志列表淹没。
- QA 问题、截图、修订历史能辅助用户判断结果是否可用。
- 单页修订入口简单明确，用户能快速选择页面并输入修改指令。

### 2.2 产品目标

- 让 SlidePilot 看起来像一个可交付的 Agent 产品，而不是 demo 控制台。
- 保持零构建前端，不引入复杂框架。
- 在桌面端优先做好 1440px、1600px、1920px 宽度体验，移动端保证不崩。
- 降低黑盒感：Agent 过程可观察，但不展示私有思维链。

## 3. 非目标

- 不做营销落地页。
- 不引入 React/Vue/Svelte。
- 不做多人协作、账号系统、云端历史。
- 不展示模型私有 chain-of-thought，只展示安全可见的阶段、工具、输入输出摘要和 QA 反馈。
- 不在前端编辑 PPTX 对象。

## 4. 目标用户

| 用户 | 需求 | 前端重点 |
|------|------|----------|
| 非技术用户 | 输入想法，拿到可下载演示文稿 | 简单输入、预览、下载、修订 |
| 开发者 | 验证 Agent 管线与工具调用 | trace、事件过滤、产物路径 |
| 产品/运营 | 快速制作讲解材料 | 示例 prompt、主题选择、质量判断 |
| 研究/工程团队 | 复盘生成失败原因 | QA、截图、修订历史、报告 |

## 5. 信息架构

推荐桌面布局：

```text
┌──────────────────────────────────────────────────────────────┐
│ Header: SlidePilot / provider status / quick actions          │
├───────────────┬──────────────────────────────────────────────┤
│ Input Panel   │ Main Output                                  │
│ - prompt      │ ┌──────────────────────────────────────────┐ │
│ - style/pages │ │ Result Preview + Download + Revision     │ │
│ - generate    │ └──────────────────────────────────────────┘ │
│ - examples    │ ┌──────────────────────────────────────────┐ │
│               │ │ Agent Timeline / Stage Grid              │ │
│               │ └──────────────────────────────────────────┘ │
│               │ ┌──────────────────────────────────────────┐ │
│               │ │ QA / Screenshots / Assets / Revisions    │ │
│               │ └──────────────────────────────────────────┘ │
└───────────────┴──────────────────────────────────────────────┘
```

关键调整：

- 生成完成后，结果预览应位于右侧顶部，Agent trace 下移或折叠为“过程详情”。
- 生成中时，Agent trace 可以在右侧顶部，结果区显示 skeleton/等待态。
- 输入面板保持左侧，但不需要 sticky，避免结果面板被挤压。
- QA、截图、资产、修订历史放在标签页或分组面板中，不一次性全部展开。

## 6. 核心流程

### 6.1 初始状态

页面需要展示：

- 左侧输入卡片。
- 右侧空状态，不是空白：
  - “输入需求后，Agent 会规划、生成、QA、导出。”
  - 最近一次生成结果入口（如果本地有 runs，可 P1 实现）。
  - 示例 prompt chips。

验收：

- 页面首屏没有大片空白。
- 用户能在 5 秒内理解怎么开始。

### 6.2 生成中

右侧主区域展示：

- 当前阶段大标题：如“正在生成第 3 / 8 页”。
- 进度条或阶段进度：需求、规划、风格、页面、QA、修复、导出。
- Agent event list 默认只显示重要事件：
  - LLM call start/done
  - tool call start/done/error
  - QA error/warn
  - artifact saved
- 详细事件可展开。

验收：

- 用户不用滚动即可看到当前阶段。
- 事件列表不会把页面撑到很长。
- 失败事件视觉优先级高。

### 6.3 生成完成

右侧主区域切换为结果优先：

- 顶部：预览 iframe，16:9，稳定尺寸。
- 右上或预览下方：下载 HTML/PDF/PPTX。
- 预览下方：修订控件。
- 次级区域：Agent trace 折叠或保留最近 10 条关键事件。
- QA 面板显示总体状态：
  - `通过`
  - `有警告`
  - `失败，需要修订`

验收：

- 生成完成后第一屏能看到 deck 预览。
- 下载按钮与修订入口明显。
- QA 分数和失败页清楚。

### 6.4 单页修订

用户操作：

1. 选择页码。
2. 输入修改指令。
3. 点击“修订此页”。
4. 前端展示修订中状态。
5. 修订完成后刷新预览、QA、PPTX/PDF 下载链接和修订历史。

需要补强：

- 页码选择器应支持用截图缩略图点选。
- 修改指令 textarea 不应太窄。
- 修订按钮需要 loading 状态和禁用状态。
- 修订失败后保留用户输入。

验收：

- 用户能明确知道修订的是哪一页。
- 修订完成后不需要手动刷新页面。

## 7. 视觉规范

### 7.1 设计方向

SlidePilot 是工程型 Agent 工具，视觉应为：

- 深色工作台。
- 高信息密度但不拥挤。
- 状态清晰，少装饰。
- 重点用颜色表示状态，不用大量渐变和装饰图形。

### 7.2 色彩

| 用途 | 建议 |
|------|------|
| 背景 | `#0b0c10` |
| 面板 | `#17191f` |
| 面板内层 | `#11141a` |
| 边框 | `#30343d` |
| 主文字 | `#f4f6fb` |
| 次文字 | `#9aa3b2` |
| 主操作 | 蓝色 `#5b8cff` |
| 成功 | 绿色 `#20c997` |
| 警告 | 黄色 `#f4b740` |
| 错误 | 红色 `#ff6b6b` |

### 7.3 字体与尺寸

- 全局字体：系统 UI + `Noto Sans SC`。
- 页面标题：28px。
- 面板标题：16px。
- 正文：13-14px。
- 事件/辅助信息：12px。
- 按钮高度：34-42px。

### 7.4 组件半径

- 面板、按钮、输入框统一 `8px`。
- 不使用大圆角卡片。

## 8. 组件需求

### 8.1 InputPanel

字段：

- prompt textarea。
- style select。
- pages number input。
- language 可 P1 增加。
- 示例 prompt chips。
- 生成按钮。

状态：

- idle。
- generating。
- invalid prompt。
- provider not configured / mock mode。

### 8.2 StageGrid

展示阶段：

- 需求解析
- 大纲规划
- 风格锁定
- 页面生成
- 浏览器 QA
- 修复回路
- 预览组装
- PDF 导出
- PPTX 导出
- 报告归档

每个 stage：

- pending/running/done/error。
- 一行摘要。
- 可点击过滤事件（P1）。

### 8.3 EventTimeline

字段：

- 时间。
- 类型：LLM / TOOL / ARTIFACT / QA / REPAIR / PHASE。
- 页码。
- 标题。
- 摘要。

交互：

- 类型过滤。
- 只看失败/警告。
- 展开详细信息。
- 自动滚到底部，但用户手动滚动后暂停自动滚动。

### 8.4 ResultPreview

内容：

- iframe preview。
- 下载按钮。
- “打开新窗口预览”按钮。
- QA summary badge。
- 当前页指示（P1）。

约束：

- iframe 使用 16:9。
- 桌面端最小高度 320px，最大 560px。
- 不能因为内容加载失败出现大块不可解释空白。

### 8.5 QA Panel

内容：

- 总分。
- fail/warn 数量。
- 问题列表。
- 页码。
- 问题类型。
- 简短说明。

交互：

- 点击问题跳到对应截图。
- fail 优先展示。
- 无问题时显示通过态，不留空。

### 8.6 Screenshot Gallery

内容：

- 每页截图缩略图。
- 页码。
- 文件大小。

交互：

- 点击打开原图。
- 点击选择修订页（P1）。

### 8.7 RevisionPanel

内容：

- 页码输入。
- 修改指令 textarea。
- 修订按钮。
- 修订历史。

交互：

- 修订中 loading。
- 修订完成自动刷新结果。
- 失败保留输入。

## 9. 错误与空状态

### 9.1 API 404

如果 `/api/runs/:runId` 失败：

- 不显示大块错误面板。
- 使用生成结果中的 `qa` 和 `screenshots` 降级展示。
- 在 QA 面板底部显示小提示：详情接口不可用。

### 9.2 iframe 加载失败

展示：

- “预览加载失败”
- “打开 HTML”
- “查看报告”

### 9.3 PPTX/PDF 导出失败

按钮隐藏或置灰，并显示失败原因。

## 10. 响应式

### 桌面端

- 1200px 以上：左输入 + 右输出。
- 右侧输出列优先展示 ResultPreview。

### 平板/窄屏

- 单列布局。
- 输入在上，结果在下。
- StageGrid 两列。

### 手机

- 可用即可，不追求完整工作台体验。
- 所有按钮和输入不能横向溢出。

## 11. 数据接口

已存在：

- `GET /api/status`
- `POST /api/create-stream`
- `POST /api/runs/:runId/slides/:pageIndex/revise`
- `GET /api/runs/:runId`
- `POST /api/images/generate`
- `POST /api/images/edit`

前端需要依赖的结果字段：

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

## 12. 验收标准

### 功能验收

- 生成中能实时看到阶段变化。
- 生成完成后首屏能看到预览和下载按钮。
- QA 面板能展示 fail/warn/pass。
- 截图画廊能展示每页截图。
- 单页修订能刷新预览和 QA。
- `/api/runs/:runId` 失败时有降级展示。

### 视觉验收

- 1440×900 下无明显重叠。
- 1600×1200 下结果面板不跑到左侧。
- 预览 iframe 比例稳定。
- 修订控件不挤压成不可读。
- 文本不溢出按钮和卡片。

### 测试验收

- `npm run build` 通过。
- `npm run test:run` 通过。
- Playwright smoke 覆盖：
  - 正常生成完成状态。
  - run detail 404 降级状态。
  - 修订完成刷新状态。

## 13. 迭代计划

### Iteration 1：布局修复与结果优先

- 右侧 output column。
- 生成完成后 ResultPreview 优先。
- iframe 16:9。
- run detail 404 降级。

### Iteration 2：工作台美化

- 初始空状态。
- 示例 prompt chips。
- Agent trace 折叠/展开。
- QA 面板标签页。

### Iteration 3：修订体验

- 截图点选修订页。
- 修订历史可回看。
- 整套 deck 修订入口。

### Iteration 4：产物管理

- runs 列表。
- image-only run 预览。
- 产物清理和磁盘占用提示。

## 14. 风险

- 过度强调 trace 会让用户忽略结果，需要结果优先。
- QA 数据太工程化，需要转换为用户可理解的状态。
- iframe 内容来自本地 HTML，尺寸控制必须稳定。
- 不应展示私有思维链，只展示可公开的工具和阶段事件。
