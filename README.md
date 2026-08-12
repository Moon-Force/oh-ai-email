# oh-ai-email

<p align="center">
  <img src="design/app-icon.jpg" alt="oh-ai-email icon" width="128" height="128" />
</p>

开源 **AI 邮箱客户端**——连上你现有的邮箱，用更聪明的方式整理收件箱、读信、回信。

对标 [Spark](https://sparkmailapp.com/) 一类现代邮箱：好上手、重整理与 AI 写作，而不是极客式全快捷键流。

> 只做**客户端**，不托管邮箱、不自建邮件服务器。Gmail / Outlook / 163 / QQ 等支持 IMAP 的邮箱均可接入（具体能力随版本推进）。

---

## 能做什么

### 收件与阅读

- 连接邮箱账号，同步收件箱
- 清晰的列表 + 读信视图，本地缓存，离线也能看已同步的邮件
- 多账号结构预留（持续完善中）

### 智能整理（Spark 向）

- **分箱**：把「重要」和「其他」分开，少被订阅和通知淹没
- 归档、删除等基础整理
- 稍后处理、固定、静音等能力按版本逐步加入
- 本地搜索：按发件人、主题、正文快速找到邮件

### AI 助手

- **一键摘要**：长邮件 / 整段对话快速看懂要点
- **草稿回复**：根据来信生成回复，你改完再发（不会擅自发送）
- **改语气 / 扩写 / 缩写**（及翻译等，按版本开放）
- **混合模式**
  - **云端**：默认，效果更好
  - **本机**：可选接入本地模型（如 Ollama），邮件内容尽量不离开你的电脑

### 写信与发送

- 新邮件、回复、全部回复
- 草稿保存，避免写到一半丢失

### 体验

- 桌面优先：Windows / macOS / Linux
- 界面采用 **[MUI Material UI](https://mui.com/)**：标准 Material 组件与明暗主题
- 基础快捷键（增强效率，不绑架鼠标操作）

---

## 不做什么

| 不做                | 说明                      |
| ------------------- | ------------------------- |
| 邮件托管 / 域名邮箱 | 你的信仍在原邮箱服务商    |
| 自动乱发邮件        | AI 只给建议，发送由你确认 |
| 一期强推手机 / 鸿蒙 | 移动端与鸿蒙在路线图二期  |

---

## 界面预览

- UI 规范：[`docs/DESIGN.md`](docs/DESIGN.md)（**MUI**）
- 主题实现：[`apps/desktop/src/theme/createAppTheme.ts`](apps/desktop/src/theme/createAppTheme.ts)
- 本地运行：`pnpm -C apps/desktop dev`

（`design/mvp/` 为历史示意稿，**不作为实现准绳**。安装包随版本在 Releases 发布。）

---

## 当前状态

项目处于 **早期建设中**。功能以 [`docs/IMPLEMENTATION.md`](docs/IMPLEMENTATION.md) 实施名单为准，按阶段交付。

**一期目标（桌面 MVP）**：能稳定收信、读信、回信，并具备摘要 / 草稿类 AI 与基础分箱。

**二期方向**：iOS / Android / 鸿蒙，以及更强的整理与账号体验。

---

## 简单技术说明

想贡献代码或本地跑起来时，可以先知道这些：

- 桌面应用壳 + 界面 + 本地邮件同步与 AI 调度
- 邮件协议：IMAP / SMTP（后续可增强 OAuth 等）
- 更细的架构与任务列表见 [`docs/`](docs/)

完整约定见 [`AGENTS.md`](AGENTS.md)。

## 开发 (Development)

```bash
pnpm install
pnpm -C apps/desktop dev        # 启动 Electron + Vite
pnpm -C apps/desktop build      # 构建
pnpm -C apps/desktop test       # Vitest
pnpm lint && pnpm format:check
cargo test --workspace
```

---

## 文档

| 文档                                             | 内容                   |
| ------------------------------------------------ | ---------------------- |
| [docs/PRODUCT.md](docs/PRODUCT.md)               | 产品定位与范围         |
| [docs/IMPLEMENTATION.md](docs/IMPLEMENTATION.md) | 实施名单与验收         |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)     | 架构（偏开发）         |
| [docs/DESIGN.md](docs/DESIGN.md)                 | UI / MUI 规范          |
| [design/](design/)                               | 历史示意稿（非实现准绳） |

---

## 隐私

- 邮件账号密码 / 令牌保存在本机安全存储中，不会提交到本开源仓库
- 使用**云端 AI** 时，相关正文会按你的设置发往所选模型服务；可在设置中改为**本机模型**
- 我们不运营你的邮箱服务器，信的权威数据仍在你的邮箱服务商

---

## 参与与反馈

- Issue / Discussion：欢迎提需求、缺陷与设计意见
- PR：请先阅读 [`docs/IMPLEMENTATION.md`](docs/IMPLEMENTATION.md) 与 [`AGENTS.md`](AGENTS.md)，小步提交

---

## 许可

许可证将在首个可运行版本前确定（倾向 MIT 或 Apache-2.0）。确定后会在本文件与 `LICENSE` 中写明。

---

**oh-ai-email** —— 让收件箱更安静，让回复更轻松。
