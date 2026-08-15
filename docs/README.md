# oh-ai-email 文档

开源 AI 邮箱客户端（对标 **Spark** 风格）。

## 文档索引

| 文档                                         | 说明                                              |
| -------------------------------------------- | ------------------------------------------------- |
| [PRODUCT.md](./PRODUCT.md)                   | 产品定位、约束、对标与一期范围                    |
| [ARCHITECTURE.md](./ARCHITECTURE.md)         | 技术栈、分层架构、数据与 AI 流                    |
| [AI_TODO.md](./AI_TODO.md)                   | **AI 冻结决策 + Wave TODO**（`feat/ai` 权威清单） |
| [AGENT_WORKFLOW.md](./AGENT_WORKFLOW.md)     | **Agent 流与工作流规范**：HITL 安全门、沙箱工具、双层流式 |
| [IMPLEMENTATION.md](./IMPLEMENTATION.md)     | **实施名单**：分阶段任务、验收标准、顺序          |
| [DESIGN.md](./DESIGN.md)                     | **UI 规范**：MUI Material UI + 布局/文案/无障碍   |
| [../apps/desktop/src/theme/](../apps/desktop/src/theme/) | MUI 主题源码（`createAppTheme`）            |
| [../design/](../design/)                     | 历史示意稿 / 品牌图标（**非**当前 UI 准绳）       |
| [../design/brand/](../design/brand/)         | **应用图标**：主图标 / 矢量 / monogram 备选       |

> `design-tokens.css` / `design-preview.html` 已废弃（旧玻璃示意），仅保留占位说明。

## 快速结论

| 项     | 决策                                              |
| ------ | ------------------------------------------------- |
| 产品   | Spark 向：智能整理 + AI 写作/摘要，友好非极客优先 |
| 视觉   | **MUI Material UI**（`@mui/material`）            |
| 形态   | 仅客户端，接用户已有邮箱（IMAP/SMTP）             |
| 一期端 | 桌面 Win / macOS / Linux                          |
| 二期端 | iOS / Android / 鸿蒙                              |
| AI     | 混合：云端默认 + 本机 Ollama 可选                 |
| 栈     | Electron + React/TS + **MUI** + Rust 邮件核心 + SQLite |

从 [IMPLEMENTATION.md](./IMPLEMENTATION.md) 按阶段推进；UI 以 [DESIGN.md](./DESIGN.md) 与 MUI 主题代码为准。
