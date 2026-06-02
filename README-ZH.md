<div align="center">
  <h1>SlidePilot</h1>
  <p><strong>AI 演示文稿智能体 — 描述想法，获得专业 Deck</strong></p>
  <p>
    <a href="#快速开始"><img src="https://img.shields.io/badge/快速开始-blue?style=for-the-badge" alt="Quick Start" /></a>
    <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="License" /></a>
    <a href="README.md"><img src="https://img.shields.io/badge/English-black?style=for-the-badge" alt="English" /></a>
  </p>
  <p>
    <img src="https://img.shields.io/badge/流水线-7_阶段-6366f1?style=flat-square" />
    <img src="https://img.shields.io/badge/主题-3_内置-818cf8?style=flat-square" />
    <img src="https://img.shields.io/badge/页面类型-11_种-34d399?style=flat-square" />
    <img src="https://img.shields.io/badge/QA_检查-5_项自动化-f59e0b?style=flat-square" />
    <img src="https://img.shields.io/badge/LLM-任意_OpenAI_兼容-09090b?style=flat-square" />
  </p>
</div>

---

**SlidePilot** 是一个开源 AI 演示文稿智能体，能将主题、大纲或文档自动转化为专业 HTML 演示文稿——包含浏览器自动验收、视觉修复和 PDF 导出。无需 PowerPoint，无需写代码，无需设计能力。

与传统 PPT 生成工具只做"文本填充"不同，SlidePilot 将演示文稿创建视为**完整的 Agent 工作流**：理解需求 → 规划叙事 → 锁定风格 → 渲染页面 → 自动验收 → 修复缺陷 → 导出交付。

## 为什么选择 SlidePilot

| 痛点 | SlidePilot 的解法 |
|------|------------------|
| 生成的页面千篇一律 | **规划先行**：每页有结构化内容预算和布局合同，再生成 HTML |
| 生成后没有视觉检查 | **Playwright QA**：自动检测溢出、空白、尺寸异常 |
| 各页风格不统一 | **全局样式锁**：一份 `style.json` → `global.css`，全 deck 统一 |
| 不会写代码就无法迭代 | **浏览器 UI**：输入需求、预览结果、下载 PDF，零门槛 |
| 绑定单一 LLM 服务商 | **任意 OpenAI 兼容 API**：OpenAI、DeepSeek、Ollama、vLLM 等 |
| Prompt 写死在代码里 | **Prompt Harness**：所有提示词为可编辑的 `.md` 模板文件 |

## 效果演示

```bash
# 打开 http://127.0.0.1:4321，输入：
"帮我做一个 10 页 PPT，主题是 AI Agent 的发展趋势，面向本科生，科技暗色风格"
```

```
✓ 需求解析完成
✓ 叙事大纲生成（10 页）
✓ 风格锁定（tech-dark）
✓ 页面渲染完成（10/10）
✓ 浏览器 QA 通过（score: 1.0）
✓ PDF 导出成功

预览: http://127.0.0.1:4321/runs/{id}/preview.html
```

<!-- TODO: 添加截图 -->
<!-- <img src="docs/assets/demo-grid.png" width="100%" /> -->

## 快速开始

```bash
git clone https://github.com/ranxi2001/SlidePilot
cd SlidePilot
npm install
npx playwright install chromium

# 启动服务（不配置 LLM 也能跑，使用 mock 数据）
npm run dev
# → http://127.0.0.1:4321
```

### 接入大模型

```bash
cp .env.example .env
# 编辑 .env 填入你的 API 信息：
#   LLM_BASE_URL=https://api.openai.com/v1
#   LLM_API_KEY=sk-...
#   LLM_MODEL=gpt-4o
```

支持**任意 OpenAI 兼容 API** — OpenAI、DeepSeek、Ollama、vLLM、Azure OpenAI 等均可直接使用。

## 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│  浏览器 (Web UI)                                             │
│  输入需求 → 实时进度 → 预览 (iframe) → 下载 PDF               │
└──────────────────────────────┬──────────────────────────────┘
                               │ POST /api/create
┌──────────────────────────────▼──────────────────────────────┐
│  Agent 流水线                                                │
│                                                             │
│  ┌─────────┐  ┌─────────┐  ┌──────────┐  ┌─────────────┐  │
│  │ 需求解析 │→│ 大纲规划 │→│ 风格锁定 │→│ 逐页生成    │  │
│  └─────────┘  └─────────┘  └──────────┘  └──────┬──────┘  │
│                                                   │         │
│                              ┌─────────┐  ┌──────▼──────┐  │
│                              │  修复   │←─│ 浏览器 QA   │  │
│                              │  Agent  │  │(Playwright) │  │
│                              └────┬────┘  └─────────────┘  │
│                                   │                         │
│                    ┌──────────────▼──────────────┐          │
│                    │   组装预览 + PDF 导出        │          │
│                    └─────────────────────────────┘          │
└─────────────────────────────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│  产物（每次运行）                                             │
│  runs/{id}/                                                 │
│  ├── outline.json        — 叙事结构                          │
│  ├── style.json          — 锁定的视觉系统                     │
│  ├── global.css          — 由 style.json 生成                │
│  ├── planning/*.json     — 每页内容合同                       │
│  ├── slides/*.html       — 每页独立 HTML（1280×720）          │
│  ├── png/*.png           — 每页截图                          │
│  ├── preview.html        — 组装后的演示 deck                  │
│  ├── deck.pdf            — 可打印 PDF                        │
│  └── report.md           — QA 报告                           │
└─────────────────────────────────────────────────────────────┘
```

## 核心设计

### 每页独立 HTML（1280×720）

每张幻灯片是一个**独立的 HTML 文件**，固定 1280×720 视口——与 PPTAgent、ppt-agent-skills 一致。这使得：
- 每页独立 QA、独立修复
- 可并行生成
- 逐页截图
- PDF 分页干净

### 规划先行渲染

借鉴 ppt-agent-skills 的密度合同系统：

```
大纲 → PagePlanning (JSON) → HTML
```

LLM 先输出结构化的**内容规划**（布局、密度、内容预算、区块分配），然后再基于规划生成 HTML。避免"一步到位"导致的注意力塌陷。

### Prompt Harness（提示词引擎）

所有 LLM 提示词存放在 `src/prompts/templates/` 下的 **Markdown 模板**中：

```
requirement.md   — 需求解析
outline.md       — 叙事大纲
style.md         — 视觉系统
page-planning.md — 单页内容合同
page-html.md     — HTML 生成
repair.md        — QA 修复
```

通过 `{{VAR}}` 语法注入变量，缺失变量直接报错。应用代码中不含任何 prompt 逻辑。

### 像素级 QA

Playwright 自动检查每一页：

| 检查项 | 检测内容 |
|--------|---------|
| DIM | 视口是否超过 1280×720 |
| OVERFLOW | 内容元素是否超出幻灯片边界 |
| BLANK | 页面文字是否少于 5 个字符 |
| CONSOLE | 是否有 JavaScript 错误 |
| SCREENSHOT | 截图保存供人工复查 |

QA 失败的页面进入**修复循环**（最多 3 轮），LLM 根据 QA 反馈修复问题。

## 技术栈

| 层级 | 技术 |
|------|-----|
| 运行时 | Node.js 20+ |
| 语言 | TypeScript |
| Web 服务 | Hono |
| Schema 校验 | Zod |
| 浏览器自动化 | Playwright |
| LLM 接口 | OpenAI SDK（任意兼容 API） |
| PDF 导出 | Playwright Print |

## 项目结构

```
SlidePilot/
├── src/
│   ├── server.ts                 # Web 服务入口
│   ├── routes.ts                 # API 路由
│   ├── schemas.ts                # Zod 数据模型
│   ├── llm/
│   │   └── client.ts             # LLM 客户端（OpenAI 兼容）
│   ├── prompts/
│   │   ├── harness.ts            # 模板引擎
│   │   └── templates/*.md        # 可编辑 prompt 模板
│   ├── agent/
│   │   └── orchestrator.ts       # 流水线协调器
│   ├── renderer/
│   │   ├── style-generator.ts    # StyleSpec → global.css
│   │   ├── page-renderer.ts      # PagePlanning → HTML
│   │   └── assembler.ts          # 多页 → 预览 deck
│   ├── qa/
│   │   └── browser-qa.ts         # Playwright 视觉检查
│   ├── export/
│   │   └── pdf.ts                # 逐页 PDF 合并
│   ├── storage/
│   │   └── run-store.ts          # 产物持久化
│   └── report/
│       └── generator.ts          # Markdown 报告
├── public/                       # Web UI（零构建）
├── tests/
├── docs/PRD.md
├── .env.example                  # LLM 配置模板
├── package.json
└── tsconfig.json
```

## 对比

| 特性 | PPTAgent | ppt-master | ppt-agent-skills | **SlidePilot** |
|------|----------|------------|------------------|----------------|
| 输出格式 | PPTX | PPTX | HTML→PPTX | **HTML/PDF** |
| 目标用户 | 研究者 | 办公用户 | 开发者 | **非技术用户** |
| 浏览器 QA | Vision LLM | 无 | 像素分析 | **像素 + Playwright** |
| 每页独立 HTML | 是 | 否 | 是 | **是** |
| 规划先行 | 否 | 否 | 是（JSON 合同） | **是** |
| Prompt 模板化 | Jinja2 | 无 | Harness + Playbook | **Markdown Harness** |
| Web UI | Gradio | 无 | 无 | **内置** |
| LLM 服务商 | 任意 | OpenAI | 任意 | **任意** |
| 开发语言 | Python | Python | Python (Skill) | **TypeScript** |

## 路线图

- [x] 每页独立 HTML 渲染（1280×720）
- [x] 规划先行架构（Planning → HTML）
- [x] 全局样式系统（StyleSpec → CSS）
- [x] Playwright 浏览器 QA
- [x] 逐页 PDF 导出
- [x] Prompt Harness（模板化提示词）
- [x] Web UI 骨架
- [ ] 完整 LLM 接入（大纲 → 规划 → HTML）
- [ ] SSE 实时进度推送
- [ ] 自然语言迭代修改
- [ ] 图片搜索与嵌入
- [ ] PPTX 导出
- [ ] 更多主题与布局类型
- [ ] Docker 部署
- [ ] 演示视频与截图

## 目标用户

- **学生** — 课程汇报、答辩、组会分享
- **老师** — 课件、讲义、公开课
- **产品经理** — 需求评审、路线图、竞品分析
- **创业者** — Pitch Deck、商业计划书
- **研究人员** — 论文分享、技术报告
- **开发者** — 技术分享、项目介绍

## 贡献

欢迎贡献！完整产品需求文档见 [docs/PRD.md](docs/PRD.md)。

## 许可证

[MIT](LICENSE)
