# 架构说明

## 1. 技术栈总览

| 层 | 选型 | 职责 |
|----|------|------|
| 桌面壳 | **Electron** | 窗口、系统集成、打包 Win/macOS/Linux |
| UI | **React + TypeScript + Tailwind** | 列表、读信、写信、设置、AI 面板；视觉见 [DESIGN.md](./DESIGN.md)（Liquid Glass） |
| 原生核心 | **Rust** | IMAP/SMTP、同步、加密存储、AI 路由命令 |
| 本地库 | **SQLite**（敏感字段加密 / SQLCipher 方向） | 邮件元数据、正文缓存、账号配置 |
| 云端 AI | 轻量代理 API（二选一：Rust 或 TS 服务） | 转发大模型、保护密钥、限流 |
| 本地 AI | **Ollama** HTTP API | 用户可选，邮件内容不经云 |

> UI 默认 React；若团队更熟 Vue，可替换前端，不改变 Rust 命令边界。

## 2. 逻辑分层

```
┌──────────────────────────────────────────────────────┐
│  Presentation（React）                                 │
│  收件箱 / 读信 / 写信 / 分箱 / 设置 / AI 面板           │
├──────────────────────────────────────────────────────┤
│  Electron IPC（invoke/handle + events）                │
├──────────────────────────────────────────────────────┤
│  Application（Rust）                                   │
│  同步编排 · 发送流水线 · AI 用例 · 账号生命周期         │
├──────────────────────────────────────────────────────┤
│  Domain                                                │
│  Account · Message · Thread · Label/Split · Draft      │
├──────────────────────────────────────────────────────┤
│  Infrastructure                                        │
│  IMAP/SMTP · SQLite · Crypto · CloudAI · Ollama · FS   │
└──────────────────────────────────────────────────────┘
```

## 3. 建议仓库结构（monorepo）

```
oh-ai-email/
├── apps/
│   └── desktop/                 # Electron 应用（前端 + electron 主进程）
│       ├── src/                 # React
│       └── electron/            # Electron 主进程与 IPC
├── crates/
│   ├── mail-core/               # 协议、解析、同步、域模型
│   ├── mail-store/              # SQLite 仓储
│   └── ai-router/               # 云端/本地 AI 路由
├── services/
│   └── ai-proxy/                # 可选：云端 AI 代理（可后置）
├── docs/                        # 本目录
├── package.json / pnpm-workspace
└── README.md
```

一期允许先把 `mail-core` 放在 `electron/` 内，稳定后再拆 crate。

## 4. 邮件数据流

### 同步（收）

```
用户账号配置
    → IMAP CONNECT + AUTH
    → 选文件夹（INBOX…）
    → 增量 UID / MODSEQ（能则 CONDSTORE）
    → 拉 HEADER + 需要时 BODY
    → 解析 MIME
    → 写入 SQLite
    → 推送 UI 事件（folder_updated / message_upserted）
```

### 发送（发）

```
UI 草稿
    → 校验收件人/主题/正文
    → SMTP 发送
    → 可选 APPEND 到 Sent
    → 更新本地状态
```

### 读信

```
UI 点开 message_id
    → 本地有 BODY 则直接展示
    → 否则 IMAP FETCH → 缓存 → 展示
```

## 5. AI 数据流

```
UI 请求（摘要 / 草稿 / 改语气）
    → Rust ai-router
        → 组装上下文（去引用噪音、截断、脱敏策略）
        → mode == cloud ? CloudAI : Ollama
        → 返回结构化结果（markdown/text + 元数据）
    → UI 渲染，用户确认后再写入草稿/发送
```

原则：

- **默认不自动发送**，AI 只生成建议
- 云端模式：可走代理，API Key 不硬编码进客户端公开仓库
- 本地模式：仅请求 `localhost` Ollama
- 记录最小遥测（开源默认关闭）

## 6. 安全与隐私

| 项 | 要求 |
|----|------|
| 密码 / Refresh Token | 系统钥匙串或加密库，不明文进 git |
| 本地库 | 敏感列加密；数据库文件权限收敛 |
| TLS | IMAP/SMTP 强制 STARTTLS 或 Implicit TLS |
| AI | 设置页明确「当前模式会把正文发往何处」 |
| 日志 | 禁止打印邮件正文与密钥 |

## 7. 协议策略

| 协议 | 一期 | 说明 |
|------|------|------|
| IMAP | 必须 | 最大兼容 |
| SMTP | 必须 | 发送 |
| OAuth（Gmail/MS） | 一期可后置 | 手动应用密码/专用密码先跑通 |
| JMAP | 二期+ | 现代同步，可作为增强路径 |

## 8. 二期多端预留

- 业务能力尽量沉在 `mail-core` / `mail-store` / 同步协议语义
- UI 可换 Flutter / RN / uni-app，不直接依赖 React 组件
- 云端仅做：AI 代理、可选设置同步、推送（若需要），**邮件正文权威源仍是用户邮服 + 本地缓存**

## 9. 非功能指标（一期目标）

| 项 | 目标 |
|----|------|
| 安装包 | 显著小于典型 Electron 邮箱客户端 |
| 空闲内存 | 尽量低于同功能 Electron 方案 |
| 首次同步 | 可后台进行，UI 先展示已有/增量结果 |
| 崩溃面 | 同步错误不拖垮 UI 进程 |
