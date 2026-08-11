# oh-ai-email 文档

开源 AI 邮箱客户端（对标 **Spark** 风格）。

## 文档索引

| 文档 | 说明 |
|------|------|
| [PRODUCT.md](./PRODUCT.md) | 产品定位、约束、对标与一期范围 |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | 技术栈、分层架构、数据与 AI 流 |
| [IMPLEMENTATION.md](./IMPLEMENTATION.md) | **实施名单**：分阶段任务、验收标准、顺序 |
| [DESIGN.md](./DESIGN.md) | **UI 规范**：苹果 Liquid Glass + 组件/文案/无障碍 |
| [design-tokens.css](./design-tokens.css) | 设计 Token 与 `.glass` / `.lumen-capsule` 原语 |
| [design-preview.html](./design-preview.html) | 可交互视觉预览（浏览器直接打开） |
| [../design/](../design/) | **MVP 视觉稿**：12 张界面图 + 详细生图提示词 |
| [../design/brand/](../design/brand/) | **应用图标**：主图标 / 矢量 / monogram 备选 |

## 快速结论

| 项 | 决策 |
|----|------|
| 产品 | Spark 向：智能整理 + AI 写作/摘要，友好非极客优先 |
| 视觉 | **Apple Liquid Glass**：玻璃仅功能层；内容层哑光 |
| 形态 | 仅客户端，接用户已有邮箱（IMAP/SMTP） |
| 一期端 | 桌面 Win / macOS / Linux |
| 二期端 | iOS / Android / 鸿蒙 |
| AI | 混合：云端默认 + 本机 Ollama 可选 |
| 栈 | Electron + React/TS + Rust 邮件核心 + SQLite |

从 [IMPLEMENTATION.md](./IMPLEMENTATION.md) 按阶段推进；UI 以 [DESIGN.md](./DESIGN.md) 为准。
