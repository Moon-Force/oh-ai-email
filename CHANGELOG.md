# Changelog

所有对 **oh-ai-email** 的重要变更都记录在本文档中。

---

## [0.3.0] - 2026-08-20

> 本地日历、通讯录与邮件跨功能联动。全量本地优先、零云依赖；`feat/calendar` 于 2026-08-18 合入 `main`（merge commit `e130a6a`，约 60 文件 · 8k+ 行新增）。

### 日历套件 (Calendar)

- **四视图日历**：`MonthView` / `WeekView` / `DayView` / `AgendaView` + 统一工具栏（`CalendarView`）支持 `month|week|day|agenda` 切换与周期导航（`next/prev/goToday`）。
- **标准 ICS 互通**：`electron/calendar/service.ts` 实现 `exportEventsToIcs` / `parseIcsContent` / `importIcsEvents`（RFC 5545，`VCALENDAR/VEVENT`，支持折叠行与缺 `DTEND` 默认 +1h）。
- **日程编辑**：`EventDialog` 三态（新建/编辑/查看）支持标题/时间/分类/颜色/地点/状态/参与人/重复/提醒。
- **提醒调度器**：`electron/calendar/scheduler.ts` 在 `main.ts` 启动，30s 轮询 `getUpcomingReminders(now, 60s)`，到期触发 `Notification`，点击通过 `calendar:open-event` 深链到日程。
- **IPC**：`calendar:list/get/create/update/delete/importIcs/exportIcs/exportIcsDialog` + 事件 `calendar:open-event`；`src/lib/ipc.ts` 与 `preload.ts` 完整透出。

### 通讯录套件 (Contacts)

- **三栏通讯录**：`ContactsView` 左分类/标签侧栏 + 中搜索列表（星标优先） + 右详情；`ContactDetail` / `ContactDialog` / `VcfImportDialog` / `ContactHarvesterDialog` 四组件。
- **标准 VCF 互通**：`electron/contacts/service.ts` 实现 `exportContactsToVcf` / `parseVcfContent` / `importVcfContacts`（vCard 3.0，`FN/N/EMAIL/TEL/ORG/TITLE/NOTE/CATEGORIES`，按邮箱去重合并标签）。
- **智能收割**：`harvestContactsFromMessages(limit)` 聚合 `messages.from_addr` 去重、排除已入库邮箱，按 `lastDateMs` 排序返回候选，一键入库。
- **IPC**：`contacts:list/get/create/update/delete/toggleStar/harvest/importVcf/exportVcf/*Dialog` 全链路贯通。

### 跨功能联动 (Mail ↔ Calendar/Contacts)

- **读信 → 日历**：`Reader` 顶部「转为日程」按钮 + `.ics` 附件检测横幅（`Paper` + `一键写入日历`）→ `useCalendarStore.openCreateDialog({ sourceMessageId })`。
- **读信 → 通讯录**：发件人行「+ 加为联系人」芯片（发件人不在库时展示）→ `useContactsStore.openCreateDialog({ name/email })`。
- **写信 → 自动补全**：`Composer` 收件人/抄送 `Autocomplete freeSolo` 以 `contacts` 为 `options`，支持手输未入库邮箱。
- **壳层联动**：`Sidebar` 新增日历/通讯录三视图导航（`todayEvents()` 今日计数 `Badge` / `contacts.length`），`App.tsx` `folderTitle` 三态与 `onCalendarOpenEvent` 提醒回链；`electron/main.ts` 启停 `CalendarScheduler`。

### AI / 语音 / 存储

- **语音本地链路**：`voiceService.ts` 新增云端优先逻辑——`sttService === "custom"` 且有麦克风权限时走 `MediaRecorder` / MiMo WAV 直采 → `ai:transcribeAudio`，兜底 `Web Speech API`；`speakText` 云端优先走 `ai:synthesizeSpeech` → `Audio` 播放。
- **存储**：`db.ts` 新增 `calendar_events` / `contacts` 两表及 `agent_*`/`drafts`/`custom_skills`/`attachments` 的索引与迁移；`ipc.ts` 新增日历/通讯录/AI 语音全量 `handle`。

---

## [0.2.0] - 2026-08-17

### 🚀 智能体架构升级与生态赋能：Pi Agent · MCP 协议 · 黑曜石碳暗色系统

#### 智能体核心引擎升级 (Pi Agent Architecture)

- **智能循环与流式思考 (Thinking Stream)**：全面引入 Pi Agent 架构，深度思考模型的 reasoning tokens 实时直显并与正文平滑分离渲染，支持浮动助手卡片与全屏推演弹窗。
- **上下文自动压缩与持久化**：超长对话上下文智能 Compaction 摘要，基于 SQLite 的 Agent 会话与状态持久化还原。
- **统一副驾调度**：收件箱读信胶囊、写信润色、会议抽历、批量智能分箱全面统一收敛至 Agent 核心调度流。

#### 技能生态与 MCP 协议扩展 (Skills & Model Context Protocol)

- **可视化技能管理器 (Skills Tab)**：内置会议抽取、发票报销、分箱整理、每日简报等多项智能技能，支持图形化查看、自定义技能创建与动态热插拔。
- **内置 MCP Mail Server**：实现标准 Model Context Protocol (JSON-RPC 2.0)，支持工具注册、邮件全文检索与智能提案落地，向外部生态智能体开放邮件能力。

#### 深度推理与高级模型控制

- **推理强度调节 (Reasoning Effort)**：支持配置 DeepSeek / OpenAI 思维链模型推理强度（Low / Medium / High），精准平衡分析深度与响应速度。
- **长文本与超时可调**：新增 Max Tokens（最高支持 128K）与单次超时限制（最高支持 600s）细粒度调节。
- **自定义语音服务配置**：支持自定义 Whisper STT 听写端点与 TTS 朗读模型，集成连通性一键实时测试。

#### 视觉设计与暗黑模式重构 (Obsidian Carbon Dark Mode)

- **黑曜石碳暗色调**：重塑深色模式材质层级与文字对比度，适配富文本邮件模版色彩自适应反转，消除高亮 Chip 刺眼/低对比问题。
- **精致 UI 动效**：重塑 Lumen Blue 强调色体系、现代平滑滚动条样式与 Markdown 原生格式渲染器。

---

## [0.1.0] - 2026-08-16

### 🎉 首个公开版本：Desktop MVP (Spark-like AI Email Client)

#### 核心邮件收发与基础架构 (Phases 0 - 3)

- **多账号与本地安全存储**：支持 IMAP/SMTP 邮箱配置，密码与 API Key 通过 Electron `safeStorage` 操作系统级加密存储。
- **高性能本地缓存与推信**：基于 SQLite (`sql.js` wasm) 的本地邮件索引与 FTS 全文搜索；内置 **IMAP IDLE 实时推信** (RFC 2177) 与 90s 保活心跳机制。
- **现代化写信与阅读体验**：基于 Tiptap 的富文本邮件编辑器、邮件引用链自动组装、Nodemailer SMTP 安全发信与 Draft/Sent 文件夹同步。

#### 整理体验与收件箱降噪 (Phase 4)

- **智能分箱**：重要 / 其他 两档收件箱视图，支持本地分类规则与用户手动/AI 调整。
- **稍后处理 (Snooze)**：支持将邮件推迟至今天下午、明天上午、周末或自定义时间，到期自动弹回收件箱并触发提醒；提供专属稍后处理文件夹。
- **置顶 (Pin) 与静音 (Mute)**：支持将重要邮件固定在收件箱顶部；支持对特定邮件静音，阻止通知打扰。

#### 混合副驾 AI 体系 (Phase 5 - Wave 1/2/3)

- **混合 Provider 架构**：默认 OpenAI 兼容协议，支持自由配置 BaseURL、API Key 与 Model；支持本地 **Ollama** 离线探测与无缝切换。
- **读信副驾 Lumen Capsule**：一键生成邮件核心摘要、智能意图/行动项提取、快速回复 Chips、多语气（正式/更短/扩写）草拟与中英双向翻译。
- **写信副驾 Composer AI**：按提示扩写邮件、上下文润色与发前安全检查（敏感转账话术、疑似遗忘附件检测）。
- **智能体工作流 (Agent Drawer)**：
  - **会议抽日历**：自动识别邮件会议要素，生成 RFC 5545 `.ics` 日历文件并排查时间冲突；
  - **可确认批量分拣**：提供收件箱批量归档与重分类清单预览，用户确认后事务落地；
  - **语气画像学习**：从已发邮件采样学习专属写作口吻。
- **特色通道与语音集成**：
  - DeepSeek 通道深度集成：支持 `deepseek-reasoner` (R1) 思考流实时分离解析与账户余额动态查询；
  - 小米 MiMo 预设通道与动态远程/本地模型列表下拉刷新；
  - Web Speech 语音实时听写 (STT) 与双引擎语音朗读 (TTS)。

#### 桌面端系统集成 (Phase 6)

- **MUI Material UI 规范**：自适应三栏布局、浅色/深色明暗双套主题与跟随系统。
- **系统托盘与通知**：系统托盘后台挂机、右键快捷菜单与 Windows/macOS 原生 Toast 通知。
- **效率增强**：全局键盘快捷键（`j`/`k` 导航、`r` 回复、`c` 写信、`/` 搜索、`?` 快捷键指南）、开机自启动设置与 GitHub Releases 自动版本检查。

#### 质量与开源资产 (Phase 7)

- **全套自动化测试**：154+ 个单元测试，覆盖协议解析、安全存储、AI 清洗、Agent 引擎与前端组件。
- **分发构建配置**：提供 Windows (NSIS / Portable)、macOS (DMG / Zip)、Linux (AppImage / DEB) 自动化打包配置与代码签名指南。
