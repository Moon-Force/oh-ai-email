# AI 路线图与 TODO（冻结）

> **状态**：2026-03 产品讨论 + grill-me 冻结  
> **分支**：`feat/ai`  
> **定位**：副驾（建议 + 可编辑草稿），不是代发秘书  
> **相关**：[`PRODUCT.md`](./PRODUCT.md) · [`IMPLEMENTATION.md`](./IMPLEMENTATION.md) 阶段 5 · [`ARCHITECTURE.md`](./ARCHITECTURE.md) · [`AGENT_WORKFLOW.md`](./AGENT_WORKFLOW.md) · [`AGENTS.md`](../AGENTS.md)

代理与贡献者：**改 AI 前先读本文件**。变更冻结决策需显式改本文档，不可 silent 漂移。

---

## 1. 产品红线（永久）

1. **禁止 AI 自动发送邮件**（任何 Agent / 批量动作都必须用户确认）。
2. **禁止静默 mock 成功**（无 Key / 无 Ollama 时阻断并引导设置）。
3. **禁止请求失败时静默跨模式**（云端失败不得偷偷打本机，反之亦然——以免隐私预期被破坏）。
4. 日志 **不落盘** 邮件正文、prompt 全文、API Key。
5. 附件默认 **不送** 模型；若未来支持，须单独开关 + 文案。

---

## 2. Wave-1 冻结决策（已实现骨架 / 须验收）

| # | 决策点 | 锁定 |
|---|--------|------|
| 1 | 云端密钥 | 用户自备 OpenAI 兼容 Key |
| 2 | Provider | 单一通道：baseURL + apiKey + model |
| 3 | Ollama | 与云端同批：探测 + 调用 + 未安装提示 |
| 4 | 读信 Capsule | 摘要 + 写回复 + 改语气（正式/更短/扩写） |
| 5 | 写信 Composer | AI 帮写（提示生成）+ 润色选中/全文 |
| 6 | 结果落地 | 插入 Composer 可编辑；不自动发送 |
| 7 | 回复头 | To=发件人，Subject=`Re:`，正文=AI 草稿 |
| 8 | 上下文 | 主题 + 纯文本，约 4k–8k 字 |
| 9 | 流式 | 否；thinking → 整段 expanded |
| 10 | 语言 | 跟随来信；UI 中文 |
| 11 | 运行层 | 主进程 `electron/ai/*` + IPC |
| 12 | AI 分箱 | Wave-1 **不做** |
| 13 | 未就绪 | 阻断 + 引导设置 |
| 14 | 隐私 | 设置常驻说明 + 首次云端确认（`cloudPrivacyAck`） |
| 15 | 超时 | 60s，用户手动重试 |

### Wave-1 代码锚点

| 区域 | 路径 |
|------|------|
| 主进程路由 | `apps/desktop/electron/ai/` |
| IPC | `apps/desktop/electron/ipc.ts`（`ai:*`） |
| Preload / 前端 IPC | `preload.ts` · `src/lib/ipc.ts` |
| 设置 | `src/features/settings/Settings.tsx` · `src/features/ai/settingsStore.ts` |
| Capsule | `src/features/ai/LumenCapsule.tsx` · `router.ts` |
| Composer AI | `src/features/composer/Composer.tsx` |

### Wave-1 验收清单

- [x] 配置 Key 后读信 **总结** 成功（云端）
- [x] **写回复** → 插入草稿 → To/Re:/正文正确 → 人点发送
- [x] 改语气（更短/正式/扩写）可用
- [x] 写信 **AI 帮写** + **润色** 可用
- [x] Ollama 在线时可切本机完成同一操作
- [x] 无 Key / Ollama 挂：明确错误 + 引导，无假摘要
- [x] 设置页数据去向文案正确；首次云端有确认
- [x] 单测：`src/features/ai/*` · Settings AI 相关通过

### Wave-1 工程 TODO（收尾）

| ID | 任务 | 状态 |
|----|------|------|
| W1-01 | 主进程 OpenAI 兼容 + Ollama 调用 | [x] 代码已落地，待真机验收 |
| W1-02 | 设置持久化 + safeStorage Key | [x] |
| W1-03 | Capsule 接真 IPC + 插入草稿 | [x] |
| W1-04 | Composer 帮写 / 润色 | [x] |
| W1-05 | 隐私文案 + 首次确认 | [x] |
| W1-06 | 错误码与引导设置 | [x] |
| W1-07 | 真机：云端 Key 端到端 | [x] |
| W1-08 | 真机：Ollama 端到端 | [x] |
| W1-09 | 取消进行中的请求（Abort） | [x] |
| W1-10 | 提交/推送 `feat/ai` + 更新 IMPLEMENTATION 阶段 5 勾选 | [x] |

---

## 3. Wave-2 TODO（高价值 · 接在 Wave-1 后）

> 原则：仍显式触发；仍人确认发送/改箱。

| ID | 任务 | 说明 | 状态 |
|----|------|------|------|
| W2-01 | 快速回复 chips | 谢谢 / 有兴趣 / 婉拒 等 → 草稿 | [x] |
| W2-02 | 行动项 / 意图标签 | 要回复？FYI？有截止日期？读信卡片 | [x] |
| W2-03 | 发前检查 | 疑似忘附件、过冲语气、敏感汇款话术提示 | [x] |
| W2-04 | 线程摘要 | 同主题/引用链多封 → 时间线摘要 | [x] |
| W2-05 | AI **建议**分箱 | 建议重要/其他，**用户确认**才 `setMessageSplit` | [x] |
| W2-06 | 自然语言本地搜 | FTS + 可选轻量 rerank（先本地库） | [x] |
| W2-07 | 中英翻译 | 读信/草稿至少中英 | [x] |
| W2-08 | 敏感度路由（轻量） | 设置：云端前遮罩邮箱/手机号（redaction） | [x] |
| W2-09 | 调用审计条 | 最近 N 次：模式/用途/时间/字符数，**无正文** | [x] |

---

## 4. Wave-3 TODO（更重 · 差异化）

> **详细架构与流程规范**：参见 [`docs/AGENT_WORKFLOW.md`](./AGENT_WORKFLOW.md)（定义了 HITL 安全门、工具沙箱注册表、两层流式协议与四大基准工作流）。

| ID | 任务 | 说明 | 状态 |
|----|------|------|------|
| W3-01 | 学用户语气 | 从已发送采样（优先本机）；可选、可关 | [ ] |
| W3-02 | 承诺追踪 | 「周五给你」→ 本地提醒，不自动发跟进 | [x] |
| W3-03 | 附件理解 | PDF/图 OCR 摘要；默认关，显式选附件 | [ ] |
| W3-04 | 会议 → 日历草稿 | 抽时间地点 → ICS，冲突排查，人确认（执行步骤详见下文） | [x] |
| W3-05 | 每日简报 | 今早必处理 vs 可忽略 | [x] |
| W3-06 | 可确认 Agent | 批量分箱/归档：**清单预览 → 逐项/全选确认执行**（执行步骤详见下文） | [x] |
| W3-07 | 跟进草稿序列 | N 天未回 → 生成 follow-up 草稿，不自动发 | [x] |
| W3-08 | 联系人卡片 | 最近话题 / 未结事项（本地索引） | [ ] |
| W3-09 | 流式输出 | Capsule/Composer token 流（可选） | [ ] |
| W3-10 | 官方 ai-proxy | 仅当产品要「开箱 Key」时再做 | [ ] |
| W3-11 | DeepSeek 预设与 R1 思考流 | `https://api.deepseek.com` · `deepseek-chat` / `deepseek-reasoner` · `reasoning_content` 提取 | [x] |
| W3-12 | 小米 MiMo 预设与多模态 | `https://api.xiaomimimo.com/v1` · `mimo-v2.5` / `mimo-v2.5-pro` / `mimo-v2.5-tts` | [x] |
| W3-13 | 动态模型拉取 | 远程 `GET /models` & 本地 Ollama `GET /api/tags` 一键同步下拉 | [x] |
| W3-14 | 账户余额/额度查询 | DeepSeek `GET /user/balance` 实时查询余额与可用性 | [x] |
| W3-15 | 语音听写与朗读能力 | Composer 语音输入 (STT) + Capsule 邮件/摘要朗读 (Web Speech / MiMo TTS) | [x] |

### Wave-3 重点任务执行步骤细化

#### W3-04：会议提取 → 日历草稿 ICS（Meeting-to-Calendar）
- **步骤 1（上下文抓取）**：调用只读工具 [`get_thread_context`](./AGENT_WORKFLOW.md#31-只读工具定义-read-only-tools)，清洗邮件会话文本与发件人元数据。
- **步骤 2（要素提取与 ICS 生成）**：LLM 提取会议主题、标准 ISO 8601 起止时间（含本地时区换算）、地点/在线会议链接（腾讯会议/Zoom/Teams 等），并构造符合 RFC 5545 规范的 `.ics` 字符串。
- **步骤 3（冲突检测）**：调用 [`check_calendar_conflicts`](./AGENT_WORKFLOW.md#31-只读工具定义-read-only-tools) 对比已有日程，如冲突则输出备选建议时段。
- **步骤 4（提案封装与 HITL 审查）**：生成 [`CalendarEventProposal`](./AGENT_WORKFLOW.md#32-变更提议工具定义-mutation-proposals)，在前端呈现可编辑卡片（时间微调、地点修改）。
- **步骤 5（受控落地）**：用户显式点击「导入系统日历」或「保存 ICS 文件」，主进程通过受控 API 写入文件并调用系统日历打开。

#### W3-06：可确认智能分拣 Agent（Confirmable Agent Triage）
- **步骤 1（范围检索）**：调用 [`search_messages`](./AGENT_WORKFLOW.md#31-只读工具定义-read-only-tools) 抓取目标文件夹（如收件箱）指定时间段内的邮件。
- **步骤 2（意图分析与分类评分）**：批量调用分类与 [`extract_action_items`](./AGENT_WORKFLOW.md#31-只读工具定义-read-only-tools)，计算风险等级（高风险：含未决待办；低风险：通知/广告/CI 告警）。
- **步骤 3（生成变更提案清单）**：输出 [`BatchArchiveProposal`](./AGENT_WORKFLOW.md#32-变更提议工具定义-mutation-proposals) 及 [`SplitChangeProposal`](./AGENT_WORKFLOW.md#32-变更提议工具定义-mutation-proposals)。
- **步骤 4（UI 审查与逐项控制）**：在 [`AgentDrawer`](./AGENT_WORKFLOW.md#6-mui-前端呈现与交互设计) 呈现结构化清单，提供全选、反选、单项移除与理由 Hover 展示。
- **步骤 5（受控事务执行）**：用户点击「确认执行已选项」，主进程通过事务受控更新本地 SQLite 并增量触发 IMAP 同步，执行完毕返回审计报告。

#### W3-11：DeepSeek 通道预设与 R1 深度思考流 (DeepSeek & Reasoning Content)
- **预设配置**：内置 Endpoint `https://api.deepseek.com`，预设模型 `deepseek-chat`（通用读写）与 `deepseek-reasoner`（R1 复杂长推理）。
- **思考链解析 (Reasoning Extraction)**：
  - 调用 `deepseek-reasoner` 时，主进程解析响应流与完整 JSON 中的 `choices[0].delta.reasoning_content`（或 `choices[0].message.reasoning_content`）。
  - 在前端 `LumenCapsule` 与 `AgentDrawer` 中以可折叠的 **「深度思考中... / 思考过程 (Thought Chain)」** 独立卡片呈现，与正式输出文本分离。
- **验收标准**：
  - [ ] 切换至 DeepSeek 预设并填入 Key 后，连通性测试通过。
  - [ ] 选择 `deepseek-reasoner` 时，思考过程与最终回复分别渲染，思考流折叠不影响最终草稿一键插入。

#### W3-12：小米 MiMo 预设与通道 (Xiaomi MiMo Integration)
- **预设配置**：内置 Endpoint `https://api.xiaomimimo.com/v1`，模型支持 `mimo-v2.5`、`mimo-v2.5-pro` 及语音模型 `mimo-v2.5-tts`。
- **适配要求**：完全兼容 OpenAI 格式 Chat Completions 协议，支持高速摘要与高性价比草稿生成。
- **验收标准**：
  - [ ] 设置页一键选择「小米 MiMo」预设，自动填入 BaseURL。
  - [ ] 使用 MiMo Key 能稳定完成单邮件摘要与 Composer 润色。

#### W3-13：远程与本地模型列表动态拉取 (Dynamic Model Discovery)
- **功能描述**：在设置页提供「刷新模型列表」按钮，避免用户手动手输模型字符串。
- **通道协议**：
  - 云端通用通道（OpenAI / DeepSeek / MiMo / Custom）：主进程发起 `GET ${baseUrl}/models`（带 `Authorization: Bearer <Key>`），解析 `data[].id` 过滤可用模型。
  - 本地 Ollama 通道：主进程发起 `GET ${ollamaHost}/api/tags`，解析 `models[].name`。
- **验收标准**：
  - [ ] 填入有效 Key 后点击刷新，下拉框自动列出远端支持的模型列表。
  - [ ] Ollama 运行中点击刷新，自动列出本地已 pull 的模型列表。
  - [ ] 拉取失败时给出轻量 Toast 提示，不阻断手动输入。

#### W3-14：账户余额与额度实时查询 (Account Balance Query)
- **功能描述**：对支持余额查询的 Provider（如 DeepSeek），在设置面板常驻显示账户可用额度与货币类型。
- **协议实现**：主进程发起 `GET https://api.deepseek.com/user/balance`，解析 `is_available` 与 `balance_infos`（包含 `currency`、`total_balance`、`granted_balance`、`topped_up_balance`）。
- **验收标准**：
  - [ ] DeepSeek 模式下，设置页面显示「账户余额：¥XX.XX（赠送额度：¥XX.XX）」。
  - [ ] 余额欠费（`is_available: false`）时，设置页高亮红色告警，提示用户充值。

#### W3-15：语音口述听写 (STT) 与邮件朗读 (TTS)
- **语音输入 (STT - Speech-to-Text)**：
  - 在写信 `Composer` 工具栏与 Agent 输入框增加 🎙️ 语音口述按钮。
  - 基于 Web Speech API（`webkitSpeechRecognition`）实现本地无缝语音听写，支持实时流式上屏追加，并可配合 AI 润色一键转为规范书面邮件。
- **语音朗读 (TTS - Text-to-Speech)**：
  - 在读信 `LumenCapsule` 与邮件详情页增加 🔊「朗读摘要」/「朗读全文」功能。
  - 支持双引擎降级：优先调用已配置的 MiMo TTS（`mimo-v2.5-tts`），若未配置或离线则平滑切至浏览器原生 `window.speechSynthesis`。
  - 提供播放、暂停、进度条与语速（0.8x - 1.5x）调节组件。
- **验收标准**：
  - [ ] 麦克风权限正常时，点击麦克风可将口述语音实时输入至 Composer。
  - [ ] 读信时点击朗读，可平稳播报中文/英文摘要，并在切换邮件时自动停止上一条播报。

---

## 5. 灵感池（未排期 · 开放头脑风暴）

不作为承诺范围；需要时再升格进 Wave-2/3。

### 读

- 一句话「要我干嘛」+ 置信度  
- 情绪/关系软提示（非真理）  
- 术语 hover 解释  
- 长信滚动伴随要点  
- 钓鱼 / 异常汇款 / 仿冒域名  

### 写

- 多版本并排（正式/友好/极简）  
- 按收件人画像改长度  
- 编辑器 inline 补全  
- 谈判档位（硬/中/软）  
- 群发个性化变量（人审）  

### 管

- 分箱 2.0：待我回复 / 等对方 / 订阅 / 账单  
- Snooze 自然语言  
- VIP/静音从行为学习  
- 重复通知 digest  
- 交接文档打包  

### 找 / 行

- 「和王工谈折扣的那几封」  
- 邮件 ↔ 待办双向  
- MCP：搜邮/摘要/建草稿暴露给外部 Agent  
- 语音：「回他下周二可以」→ 草稿  

### 体验 / 信任

- 按文件夹强制本机（银行/医疗）  
- 云 vs 本机同 prompt 对比  
- 失败可执行下一步（装 Ollama / 换 Key）  

### 刻意不做（除非产品改红线）

- 自动发送  
- 静默全量上传学语气且不可关  
- 无确认的批量删信/归档  
- 一期 Superhuman 式打开即 Auto-Draft 狂烧额度  

---

## 6. 差异化叙事（对外/对内一致）

**一句话**：不是代你回邮件的秘书，而是 **敢把正文放进本机模型、云端可选、每一步你说了算** 的读写信副驾。

| 别人常做 | 我们坚持 |
|----------|----------|
| 闭源云、额度黑箱 | 开源 + 用户自备 Key + Ollama |
| 自动草稿/自动标签 | 显式触发 + 手动/确认分箱 |
| 键盘宗教 | Spark 向：鼠标友好，快捷键增强 |

---

## 7. 变更记录

| 日期 | 变更 |
|------|------|
| 2026-03 | 初版：grill-me 冻结 Wave-1；头脑风暴写入 Wave-2/3/灵感池；代码骨架落地于 `feat/ai` |
