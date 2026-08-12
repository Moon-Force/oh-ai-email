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
| [`docs/DESIGN.md`](docs/DESIGN.md) | MUI UI rules, layout, copy |
| [`apps/desktop/src/theme/createAppTheme.ts`](apps/desktop/src/theme/createAppTheme.ts) | Theme source of truth |

Implement against **docs + current code**. Historical mockups under `design/mvp/` are **not** the visual source of truth.

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
