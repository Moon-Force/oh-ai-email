# AGENTS.md — oh-ai-email

Grok / coding agents: follow these rules for every session in this repo.

## What this is

**oh-ai-email** — open-source **AI email client** (Spark-like), not a mail server.

| Decision | Value |
|----------|--------|
| Product | Spark-style: smart splits, AI summary/draft/tone — friendly, not Superhuman keyboard-only |
| Scope | **Client only** — IMAP/SMTP (OAuth later). Do **not** build a mail host |
| Phase 1 | Desktop **Win / macOS / Linux** only |
| Phase 2 | iOS / Android / HarmonyOS |
| AI | **Hybrid**: cloud default + optional local **Ollama** |
| UI | **MUI Material UI** (`@mui/material`) — light/dark theme |

Remote: `https://github.com/Moon-Force/oh-ai-email` · default branch `main`.

## Read first

| Doc | Use for |
|-----|---------|
| [`docs/PRODUCT.md`](docs/PRODUCT.md) | Product constraints & MVP scope |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Layers, protocols, monorepo layout |
| [`docs/IMPLEMENTATION.md`](docs/IMPLEMENTATION.md) | Phased task list & acceptance |
| [`docs/AI_TODO.md`](docs/AI_TODO.md) | **AI 冻结决策 + 分波 TODO**（`feat/ai` 权威清单） |
| [`docs/AGENT_WORKFLOW.md`](docs/AGENT_WORKFLOW.md) | **Agent 流与工作流规范**（HITL 门、工具沙箱、双层流） |
| [`docs/DESIGN.md`](docs/DESIGN.md) | MUI UI rules, layout, copy |
| [`apps/desktop/src/theme/createAppTheme.ts`](apps/desktop/src/theme/createAppTheme.ts) | Theme source of truth |

Implement against **docs + current code**. Historical mockups under `design/mvp/` are **not** the visual source of truth.

## AI（已冻结 — 必读）

权威细节见 [`docs/AI_TODO.md`](docs/AI_TODO.md)。代理改 AI 时**不得**擅自推翻下列决策：

| 决策 | 锁定值 |
|------|--------|
| 密钥 | **用户自备** OpenAI 兼容 Key；一期不做官方 ai-proxy 持 Key |
| Provider | **单一** OpenAI 兼容：`baseURL` + `apiKey` + `model` |
| 本机 | **Ollama** 与云端同批可用；探测失败友好提示 |
| 运行层 | **Electron 主进程** AI 路由 + IPC；Key → `safeStorage` |
| 交互 | **显式点击**触发；**禁止自动发送**；结果 → 可编辑草稿 |
| 读信 | Lumen Capsule：摘要 / 写回复 / 改语气 |
| 写信 | 工具栏：根据提示生成 + 润色（更短/正式/扩写） |
| 上下文 | 主题 + 纯文本正文，截断约 4k–8k；**附件默认不送模型** |
| 流式 | 一期 **不做**；整段返回 + thinking 态 |
| 语言 | 跟随来信语言；UI 中文 |
| 失败 | 阻断并引导设置；**禁止** mock 装成功、禁止静默跨模式回退 |
| 隐私 | 设置页常驻数据去向 + 首次云端轻确认 |
| 超时 | 60s，不自动重试 |
| 分箱 | AI 建议分箱 **非** wave-1；继续规则 + 手动 |
| **实验性** | **禁止未成熟想法进主版本**（如联系人动态记忆层/自动画像扫描等仅留存灵感池；若开发原型必须默认全局禁用或在 `exp/*` 分支隔离） |

**当前分支习惯**：AI 功能在 `feat/ai` 开发；合入 `main` 前对照 `docs/AI_TODO.md` 验收。
**实验性想法准则**：未经验证、高幻觉风险或涉重度后台分析的探索性功能（如联系人记忆/画像）严禁直接并入主发布版本。

## Stack (locked)

| Layer | Choice |
|-------|--------|
| Desktop shell | **Electron** |
| UI | **React + TypeScript + MUI** (`@mui/material`, `@mui/icons-material`, Emotion) |
| Mail / sync / crypto | **TypeScript / Node.js (Electron 主进程)** |
| Local DB | **SQLite** (encrypt secrets / sensitive fields) |
| AI | Router: cloud (OpenAI-compatible) \| Ollama localhost |

Target layout:

```text
oh-ai-email/
├── apps/
│   └── desktop/               # Electron + React + TypeScript + MUI 桌面端主应用
│       ├── electron/          # 主进程代码 (IPC 通信、安全存储 safeStorage、AI 服务、邮件同步与解析)
│       │   └── ai/            # AI 核心 (Providers 适配器、Prompt 工程、Agent 引擎与工具沙箱)
│       │       └── agent/     # 智能体引擎 (engine, tools, types, 调度器)
│       └── src/               # 渲染进程前端 UI
│           ├── features/      # 按业务域自包含模块 (UI 组件 + Store + 单测)
│           │   ├── accounts/  # 账户管理与认证
│           │   ├── ai/        # AI 胶囊 (LumenCapsule)、Agent 抽屉 (AgentDrawer)、路由与审计
│           │   ├── composer/  # 写信编辑器、附件、语音听写
│           │   ├── mail/      # 邮件列表、邮件详情、搜索
│           │   ├── settings/  # 设置中心 (AI Provider 预设、拉取模型、余额查询)
│           │   ├── voice/     # Web Speech STT 语音识别与 TTS 朗读
│           │   └── shell/     # 主界面框架与侧边栏
│           ├── theme/         # MUI 主题源 (createAppTheme.ts, AppThemeProvider.tsx)
│           └── lib/           # IPC 客户端安全封装 (ipc.ts) 与公用工具
├── docs/                      # 权威设计、架构与 TODO 规范文档
└── design/                    # 历史设计原型与静态资源 (非视觉标准)
```

### 目录与文件收敛铁律（禁止散乱文件）

1. **模块自包含**：新增功能必须收敛至对应 `src/features/<domain>/` 目录内，配套的单元测试（`*.test.ts(x)`）就近放置在该目录下，禁止在根目录或非相关目录堆砌零散文件。
2. **严禁散乱文件**：严禁在根目录、`apps/desktop/` 等层级丢弃临时的 `.js/.ts/.md` 脚本、中间结果或未命名文件。
3. **临时调试隔离**：调试或一次性测试脚本一律放在临时沙箱中运行，测试完成**必须立即清理**，禁止提交进 git 仓库。
4. **文档集中收敛**：全局架构、任务清单与规范必须存放在 `docs/` 目录下，禁止随手在代码根目录建立散乱的 markdown 文档。

## Implementation order

Follow [`docs/IMPLEMENTATION.md`](docs/IMPLEMENTATION.md). Critical path:

`0 base → 1 accounts → 2 sync/read → 3 compose/send → 5 AI (summary/draft) → 7 ship`

Do not start mobile/HarmonyOS work until phase-1 desktop MVP is usable unless the user explicitly asks.

## UI / MUI (non-negotiable)

1. Build chrome and forms with **MUI components** (`AppBar`, `List`, `Button`, `TextField`, `Paper`, etc.).
2. Theme via `createAppTheme` + `AppThemeProvider`; support light/dark.
3. Primary CTA = MUI `contained` primary (Lumen Blue in theme) — clear action verbs.
4. AI helper: idle → thinking → expanded; **never auto-send mail**.
5. Do **not** reintroduce Liquid Glass / full-pane glassmorphism / WebGL refraction as product defaults.
6. Respect `prefers-reduced-motion`.
7. Copy: sentence case, user language (中文 OK), action verbs (“发送”, “插入草稿”).

## Code conventions

- **TypeScript**: strict; prefer functional React components; shared types at clear module boundaries.
- **IPC**: typed Electron IPC (invoke/handle); UI never talks IMAP/SMTP directly.
- **Naming**: domain words — Account, Folder, Message, Thread, Draft, Split — not internal schema nicknames in UI.
- **Commits**: complete sentences; say why. No secrets in git.
- **Comments**: only non-obvious intent; no narration of obvious code.
- **Scope**: change only what the task needs; no drive-by refactors or unsolicited markdown.

## Security & privacy

- Never commit API keys, mail passwords, or tokens.
- Store credentials in OS keychain / encrypted store — not plain SQLite text.
- TLS for IMAP/SMTP; log **no** message bodies or secrets.
- AI settings must state where content goes (cloud vs local).
- HTML mail: sandboxed render; block remote images by default (configurable).

## Shell environment

- Host is **Windows 11**; use **PowerShell (pwsh)** syntax in agent commands.
- Do not assume bash/`head`/`grep`/`cat` exist; use PowerShell or project tools.

## Done means

- Matches the relevant acceptance row in `IMPLEMENTATION.md`.
- UI follows MUI theme and `docs/DESIGN.md`.
- No new phase-2 surface area without an explicit request.
- Builds cleanly when the desktop app exists (`pnpm build` / `pnpm test` as in root README).

## Out of scope (unless user asks)

- Self-hosted mail server / domain hosting
- Phase-2 mobile or HarmonyOS app shells
- Electron rewrite
- Replacing MUI without an explicit decision change
- Re-adopting Liquid Glass as the product design system
- 未成熟的后台联系人动态画像 / 记忆层（严格保持在灵感池备忘，不进主版本）
