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
| UI | **Apple Liquid Glass** — glass for chrome only; matte for content |

Remote: `https://github.com/Moon-Force/oh-ai-email` · default branch `main`.

## Read first

| Doc | Use for |
|-----|---------|
| [`docs/PRODUCT.md`](docs/PRODUCT.md) | Product constraints & MVP scope |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Layers, protocols, monorepo layout |
| [`docs/IMPLEMENTATION.md`](docs/IMPLEMENTATION.md) | Phased task list & acceptance |
| [`docs/DESIGN.md`](docs/DESIGN.md) | Liquid Glass rules, tokens, components |
| [`docs/design-tokens.css`](docs/design-tokens.css) | CSS variables / primitives |
| [`design/README.md`](design/README.md) | MVP mockups under `design/mvp/` |
| [`design/PROMPTS.md`](design/PROMPTS.md) | Image regen prompts (visual reference only) |

Implement against **docs + code**, not against OCR’d mockup text (mockups may garble labels).

## Stack (locked)

| Layer | Choice |
|-------|--------|
| Desktop shell | **Tauri 2** |
| UI | **React + TypeScript + Tailwind** |
| Mail / sync / crypto | **Rust** (prefer crates under `crates/` when split) |
| Local DB | **SQLite** (encrypt secrets / sensitive fields) |
| AI | Router: cloud (OpenAI-compatible) \| Ollama localhost |

Target layout (create when scaffolding):

```text
apps/desktop/          # Tauri + React
crates/mail-core/      # IMAP SMTP parse sync domain
crates/mail-store/     # SQLite
crates/ai-router/      # cloud + local
services/ai-proxy/     # optional key-holding proxy
docs/  design/
```

Phase 1 may keep Rust inside `src-tauri` until stable; still respect layer boundaries.

## Implementation order

Follow [`docs/IMPLEMENTATION.md`](docs/IMPLEMENTATION.md). Critical path:

`0 base → 1 accounts → 2 sync/read → 3 compose/send → 5 AI (summary/draft) → 7 ship`

Do not start mobile/HarmonyOS work until phase-1 desktop MVP is usable unless the user explicitly asks.

## UI / Liquid Glass (non-negotiable)

1. **Glass = functional layer only**: sidebar, top bar, menus, toasts, **Lumen Capsule** (AI).
2. **Matte paper = content**: message list rows, reading body, settings forms — **no** `backdrop-filter` on full list/body.
3. Primary CTA = solid **Lumen Blue** `#2F6BFF` (light) / `#5B8CFF` (dark) — not translucent glass.
4. Signature control: **Lumen Capsule** — idle pill → thinking → expanded glass panel; never auto-send mail.
5. Tokens live in `docs/design-tokens.css`; migrate to `apps/desktop/src/styles/tokens.css` when app exists.
6. Respect `prefers-reduced-motion`; provide blur fallback when `backdrop-filter` is weak (e.g. some Windows WebViews).
7. Copy: sentence case, user language (中文 OK), action verbs (“发送”, “插入草稿”) — not engineer jargon in UI.

Visual reference: `design/mvp/*.jpg` + `docs/design-preview.html`.

## Code conventions

- **TypeScript**: strict; prefer functional React components; shared types at clear module boundaries.
- **Rust**: small modules; fallible I/O returns `Result`; no `unwrap` in production paths without justification.
- **IPC**: typed Tauri commands; UI never talks IMAP/SMTP directly.
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
- UI material split still correct after visual changes.
- No new phase-2 surface area without an explicit request.
- Builds cleanly when the desktop app exists (`pnpm` / `cargo` as documented in root README once scaffolded).

## Out of scope (unless user asks)

- Self-hosted mail server / domain hosting
- Phase-2 mobile or HarmonyOS app shells
- Electron rewrite
- Replacing React with Vue without explicit decision change
