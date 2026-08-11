# MVP 生图提示词（详细版）

所有画面统一 **16:9** 桌面产品 UI 高保真 mockup。  
语言：提示词用 **英文**（模型对 UI 英文更稳）；界面内可中英混排短标签。

---

## 全局 Style Bible（每条提示词开头请粘贴）

```
Ultra-high-fidelity desktop product UI mockup of "oh-ai-email", an AI email client inspired by Spark Mail and Apple Liquid Glass (WWDC 2025 material language). 16:9 widescreen macOS-style app window with subtle rounded corners and soft window shadow on a calm desk-like backdrop.

DESIGN SYSTEM (strict):
- Functional chrome ONLY uses Liquid Glass: translucent frosted panels, backdrop blur, soft specular rim light on top edges, thin white glass stroke, gentle refraction of colors underneath. Navigation sidebar, top toolbar, floating AI capsule, modals, and popovers are glass.
- Content layer is MATTE "paper", NEVER frosted glass: email list rows and reading pane use solid soft surfaces (#F4F6FA light / #141A22 dark) so body text stays crisp and readable.
- App canvas behind chrome: Mist Canvas soft blue-gray gradient #E4E9F2 (light) or Night Pool #0B0F14 (dark), with very subtle ambient radial glows (faint blue and warm ember, low saturation).
- Accent Lumen Blue #2F6BFF for unread dots, primary buttons, selected nav, AI accents. Secondary alert Reply Ember #E85D4C used sparingly.
- Typography feels like SF Pro: clean geometric sans, medium weights, excellent hierarchy; short realistic UI labels, not lorem walls.
- Signature component: "Lumen Capsule" — a liquid-glass pill for AI (sparkle/dot + label) that can expand into a glass panel; specular highlight band on the glass.
- Hierarchy: glass floats ABOVE paper content; no full-screen blur over the message body; no neon cyberpunk; no cream-serif-terracotta template; no acid-green-on-black template; no newspaper dense grid.
- Photoreal UI render, crisp 4K presentation, shallow depth only on window chrome, professional SaaS quality like Apple marketing screenshots mixed with refined productivity app (Spark/Superhuman calm).
```

---

## 01 · 主收件箱三栏（浅色）

**文件**：`mvp/01-inbox-main.png`  
**用途**：默认首页、分箱「重要」、同步后的列表

**Prompt**

```
[PASTE STYLE BIBLE]

Screen: main three-column inbox, light mode.
Left: tall Liquid Glass sidebar with sections "Splits" (Important selected with Lumen Blue soft fill and badge 12; Other 48; Snoozed 3) and "Mailbox" (Inbox, Sent, Drafts), bottom glass button "Add account".
Center: matte paper list pane titled "Important" with 5–6 email rows — sender name bold, subject, one-line preview muted, mono timestamp; blue unread dots on first two rows; one row selected with soft blue paper tint (not glass).
Right: matte reading pane showing the selected email subject "Q3 launch window & AI summary needs", from line, short professional body paragraphs in Chinese/English mix about desktop MVP and Liquid Glass UI.
Top: thin Liquid Glass toolbar with app mark, wordmark "oh-ai-email", glass buttons Search / theme, solid Lumen Blue primary button "Compose".
Bottom-right of reading pane: small idle Lumen Capsule glass pill "Ask AI" with blue lumen dot.
Camera: straight-on product shot, full window visible, generous margins, no hands, no phone.
```

---

## 02 · 读信 + Lumen 胶囊静止

**文件**：`mvp/02-read-lumen-idle.png`  
**用途**：读信焦点、AI 入口可见

**Prompt**

```
[PASTE STYLE BIBLE]

Screen: same three-column oh-ai-email light UI, but reading pane is the hero — slightly larger right column.
Selected thread from "Alex Chen", subject about Q3 release; body clearly readable on matte paper.
Top of reading pane: glass-ish tool cluster only for actions Archive / Reply / Forward as small glass buttons (still functional layer), not blurring the text.
Hero detail: Lumen Capsule at lower-right of reading area, compact pill state, liquid glass material with bright specular streak, blue lumen dot, label "Ask AI", tiny mono chip "Cloud". Capsule casts soft glass elevation shadow; idle, not expanded.
Sidebar and list remain visible but secondary; ambient tint: very subtle cool blue fringe on glass sidebar matching selected avatar hue.
Straight-on desktop mockup, 16:9, marketing-screenshot quality.
```

---

## 03 · AI 摘要展开

**文件**：`mvp/03-ai-summary.png`  
**用途**：阶段 5 摘要能力

**Prompt**

```
[PASTE STYLE BIBLE]

Screen: light mode three-column email app; reading pane open.
Focus on expanded Lumen Capsule morph: a larger rounded Liquid Glass panel (not a solid card) floating over the lower-right of the matte reading content, with frosted transparency so a hint of email text peeks behind the glass edges only.
Inside the glass panel: header "Summary" in Lumen Blue, mono chip "Cloud", 3-line concise Chinese summary of the email (desktop MVP, AI summary/drafts, Liquid Glass, preview by Friday), chip row "Reply" / "Shorter" / "More formal", primary solid button "Insert draft" and glass "Close".
Capsule shows subtle thinking-to-ready calm state, soft blue outer glow, specular rim.
Email body still fully legible on matte paper behind/ beside the panel — content layer not frosted.
Product UI screenshot style, 16:9.
```

---

## 04 · AI 草稿回复

**文件**：`mvp/04-ai-draft.png`  
**用途**：AI 写回复 + 插入编辑器

**Prompt**

```
[PASTE STYLE BIBLE]

Screen: light mode oh-ai-email with reply composer open in the reading column.
Upper half: original message quoted lightly on matte paper.
Lower half: compose area on matte paper with To/Subject fields and a multi-line AI-generated polite Chinese reply draft about agreeing to Friday preview.
Floating Liquid Glass Lumen panel docked above the composer with chips "Shorter", "Warmer tone", "Translate EN", and buttons "Insert draft" (primary blue solid) and "Regenerate" (glass).
Glass top toolbar visible; sidebar shows Important selected.
Clear hierarchy: draft text is sharp matte, AI controls are glass. 16:9 desktop mockup.
```

---

## 05 · 写新邮件

**文件**：`mvp/05-compose.png`  
**用途**：新信、发送

**Prompt**

```
[PASTE STYLE BIBLE]

Screen: compose new message, light mode. Centered or right-dominant matte paper compose surface inside the app shell.
Fields: To, Cc (collapsed), Subject with realistic placeholders; large clean body area empty or with one sentence started.
Top of compose: Liquid Glass action bar with solid Lumen Blue "Send", glass "Save draft", glass "Discard".
Left glass sidebar still visible dimmed; no modal blackout — optional soft dim of list only.
Minimal, calm Spark-like friendliness, not dense enterprise Outlook. 16:9 product UI.
```

---

## 06 · 添加邮箱账号

**文件**：`mvp/06-add-account.png`  
**用途**：阶段 1 加账号

**Prompt**

```
[PASTE STYLE BIBLE]

Screen: "Add email account" flow as a floating Liquid Glass modal dialog centered over a softly visible blurred-only-behind-modal app chrome (the modal itself is glass; the page behind is slightly dimmed canvas, not double-glass mess).
Modal content on glass: title "Add account", fields Email, Password/App password, IMAP host, IMAP port, SMTP host, SMTP port, security toggles (SSL) as clean controls; primary solid button "Test connection", secondary glass "Save", text button "Cancel".
Helper caption in muted ink: "Works with Gmail app passwords, Outlook, 163, and most IMAP providers."
Icons minimal line style. Light mode Mist Canvas background glow. 16:9.
```

---

## 07 · 设置 · 混合 AI

**文件**：`mvp/07-settings-ai.png`  
**用途**：云端 / Ollama 切换

**Prompt**

```
[PASTE STYLE BIBLE]

Screen: Settings, light mode. Left thin Liquid Glass settings nav: General, Accounts, AI (selected), Shortcuts.
Right matte paper settings content (NOT glass): section "AI mode" with segmented control Cloud / On-device; Cloud selected with Lumen Blue; fields Model provider, API base URL (masked), model name; toggle "Prefer on-device when available"; privacy callout box explaining "Cloud sends email text to your chosen provider; On-device uses local Ollama on this computer."
Primary solid "Save changes". Calm, trustworthy privacy-first layout. App top glass bar with "Settings" title. 16:9.
```

---

## 08 · 空收件箱

**文件**：`mvp/08-empty-inbox.png`  
**用途**：空状态

**Prompt**

```
[PASTE STYLE BIBLE]

Screen: light mode three-column shell; center list and right reading areas empty matte paper.
Centered empty state: simple elegant line-art envelope with a tiny glass reflection accent (not cartoonish), Display title "Inbox Zero", body "You're all caught up. New mail will appear after sync.", glass button "Sync now" and solid "Compose".
Sidebar glass still shows splits with badges at 0. Peaceful, rewarding, Spark-like calm. 16:9.
```

---

## 09 · 深色三栏主界面

**文件**：`mvp/09-dark-inbox.png`  
**用途**：暗色主题

**Prompt**

```
[PASTE STYLE BIBLE]

Screen: SAME information architecture as the light main inbox, but dark theme Night Pool.
Canvas #0B0F14, paper surfaces #141A22, ink near-white, muted gray secondary text.
Liquid Glass chrome uses darker translucent charcoal-blue glass fills, subtle white 12% strokes, soft specular highlights still visible on top edges, blur and saturation per Apple dark Liquid Glass.
Lumen accent #5B8CFF for unread and primary buttons.
Three columns: glass sidebar, matte list, matte reading pane with readable email; idle Lumen Capsule bottom-right.
No pure black crushing; maintain depth and glass luminosity. 16:9 cinematic product shot.
```

---

## 10 · 智能整理（稍后 / 归档）

**文件**：`mvp/10-smart-organize.png`  
**用途**：阶段 4 整理

**Prompt**

```
[PASTE STYLE BIBLE]

Screen: light mode inbox focused on organization. List shows mix of Important and a "Snoozed" section header; one row has a small ember/snooze icon and label "Later today 18:00".
Top of list: Liquid Glass contextual toolbar floating over the list top edge (functional layer) with actions Archive, Snooze, Pin, Mute — glass icon buttons with tiny labels.
Selected multi or single message with clear matte selection.
Right pane short email; sidebar "Snoozed" item emphasized.
Friendly Spark-like clarity, not aggressive Gmail clutter. 16:9.
```

---

## 11 · IMAP 连接失败

**文件**：`mvp/11-connection-error.png`  
**用途**：错误态文案

**Prompt**

```
[PASTE STYLE BIBLE]

Screen: light mode; centered Liquid Glass alert/dialog over dimmed app.
Title "Can't connect to IMAP", body in clear Chinese/English: "Authentication failed for you@example.com. Check email, app password, and server host." 
Buttons: solid "Check account", glass "Retry", text "Dismiss".
Small Reply Ember accent on error icon (simple exclamation in circle), not scary red full-screen.
Professional, directive, no apology essay. 16:9 UI mockup.
```

---

## 12 · 本地搜索

**文件**：`mvp/12-search.png`  
**用途**：FTS 搜索

**Prompt**

```
[PASTE STYLE BIBLE]

Screen: light mode; top Liquid Glass search expanded — large frosted search field with query "发布窗口", cancel glass button, mono result count "8 results".
Center matte list filtered to matching emails with search terms subtly highlighted in Lumen Blue soft mark on subjects.
Right pane shows one matched message.
Sidebar still glass. Fast, calm search UX like native macOS mail meets Liquid Glass. 16:9.
```

---

## 可选加码（非 MVP 必出）

| ID | 画面 | 一句话 |
|----|------|--------|
| 13 | 首次启动欢迎 | 玻璃卡片「添加第一个邮箱」 |
| 14 | 同步中 | 列表顶细进度 + 「正在同步…」 |
| 15 | 本地 AI 模式 | Lumen 芯片显示「本机」+ Ollama 已连接 |
| 16 | Windows 窗体 | 同 01 但 Win 11 窗控件 |
| 17 | 多账号切换 | 侧栏账号菜单玻璃 popover |

提示词写法：复制 Style Bible + 对应场景差异句，保持材料分层不变。

---

## 一致性自检（出图后）

- [ ] 列表/正文是否仍是哑光、没有整页毛玻璃？  
- [ ] 侧栏/顶栏/AI 是否是玻璃？  
- [ ] 主按钮是否是实心蓝而非半透明？  
- [ ] 是否出现霓虹/赛博/奶油衬线模板？  
- [ ] 深色是否仍看得见玻璃高光？  

## 重新生成命令提示

对 Imagine / `image_gen`：`aspect_ratio = 16:9`，prompt = Style Bible + 单屏段落。  
系列统一时在段首加：`Match the exact visual design system of oh-ai-email Liquid Glass desktop app (mist canvas, lumen blue, glass chrome only).`
