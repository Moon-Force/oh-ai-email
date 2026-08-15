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
| Mail / sync / crypto | **Rust** (prefer crates under `crates/` when split) |
| Local DB | **SQLite** (encrypt secrets / sensitive fields) |
| AI | Router: cloud (OpenAI-compatible) \| Ollama localhost |

Target layout:

```text
apps/desktop/          # Electron + React + MUI
crates/mail-core/      # IMAP SMTP parse sync domain
crates/mail-store/     # SQLite
crates/ai-router/      # cloud + local
services/ai-proxy/     # optional key-holding proxy
docs/
```

Phase 1 may keep Rust inside the desktop bridge until stable; still respect layer boundaries.

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
- **Rust**: small modules; fallible I/O returns `Result`; no `unwrap` in production paths without justification.
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
- Builds cleanly when the desktop app exists (`pnpm` / `cargo` as in root README).

## Out of scope (unless user asks)

- Self-hosted mail server / domain hosting
- Phase-2 mobile or HarmonyOS app shells
- Electron rewrite
- Replacing MUI without an explicit decision change
- Re-adopting Liquid Glass as the product design system
- 未成熟的后台联系人动态画像 / 记忆层（严格保持在灵感池备忘，不进主版本）
