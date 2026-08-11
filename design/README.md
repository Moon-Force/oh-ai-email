# oh-ai-email · MVP 视觉稿

产品：**Spark 向 AI 桌面邮箱**  
视觉：**Apple Liquid Glass（流动玻璃）** — 玻璃仅用于导航/控件/AI 功能层，列表与正文为哑光内容层  

规范原文：[`docs/DESIGN.md`](../docs/DESIGN.md)  
Token：[`docs/design-tokens.css`](../docs/design-tokens.css)  
生图提示词全集：[`PROMPTS.md`](./PROMPTS.md)

## 目录

```
design/
├── README.md
├── PROMPTS.md
├── app-icon.jpg          # 主图标快捷入口
├── brand/                # 图标正式稿 + SVG + 规范
│   ├── icon-primary.jpg  # 主图标（推荐）
│   ├── icon.svg
│   └── ...
└── mvp/                  # MVP 界面图
```

## MVP 画面清单

| # | 文件 | 画面 | 对应能力 |
|---|------|------|----------|
| 01 | `mvp/01-inbox-main.png` | 浅色三栏主界面 · 重要分箱 | 同步、列表、分箱 |
| 02 | `mvp/02-read-lumen-idle.png` | 读信 + Lumen 胶囊静止 | 读信、AI 入口 |
| 03 | `mvp/03-ai-summary.png` | AI 摘要面板展开 | 线程摘要 |
| 04 | `mvp/04-ai-draft.png` | AI 草稿回复 | 写回复、插入草稿 |
| 05 | `mvp/05-compose.png` | 写新邮件 | 发送通路 |
| 06 | `mvp/06-add-account.png` | 添加邮箱账号 | IMAP 配置 |
| 07 | `mvp/07-settings-ai.png` | 设置 · 混合 AI | 云端/本地切换 |
| 08 | `mvp/08-empty-inbox.png` | 空收件箱 | 空状态 |
| 09 | `mvp/09-dark-inbox.png` | 深色三栏主界面 | 暗色主题 |
| 10 | `mvp/10-smart-organize.png` | 稍后处理 / 归档工具条 | 整理体验 |
| 11 | `mvp/11-connection-error.png` | IMAP 连接失败 | 错误态 |
| 12 | `mvp/12-search.png` | 本地搜索结果 | 搜索 |

## 材料分层（所有图必须遵守）

| 区域 | 材料 |
|------|------|
| 应用底 Mist Canvas / Night Pool | 柔和渐变实色 |
| 顶栏、侧栏、AI 胶囊、浮层 | **Liquid Glass**（半透明 + 模糊 + 高光描边） |
| 邮件列表、读信正文、表单主体 | **Paper 哑光**（禁止整块毛玻璃） |
| 主按钮 | 实心 **Lumen Blue** `#2F6BFF`（非半透明） |

## 使用方式

1. 开发对照：实现 UI 时以 `mvp/*.png` + `docs/DESIGN.md` 为准。  
2. 重新出图：复制 `PROMPTS.md` 中对应章节全文作为 `image_gen` 提示词，`aspect_ratio: 16:9`。  
3. 系列一致性：先出 01 定风格，其余画面在提示词中写清「same design system as the oh-ai-email Liquid Glass desktop app」。  

## 状态

| 项 | 状态 |
|----|------|
| 提示词 PROMPTS.md | 已写 |
| MVP 12 张出图 | 已生成（见 `mvp/*.jpg`） |

## 文件对照（已落盘）

| 文件 | 画面 |
|------|------|
| `mvp/01-inbox-main.jpg` | 浅色三栏主收件箱 |
| `mvp/02-read-lumen-idle.jpg` | 读信 + Lumen 胶囊静止 |
| `mvp/03-ai-summary.jpg` | AI 摘要玻璃面板 |
| `mvp/04-ai-draft.jpg` | AI 草稿回复 |
| `mvp/05-compose.jpg` | 写新邮件 |
| `mvp/06-add-account.jpg` | 添加账号 |
| `mvp/07-settings-ai.jpg` | 设置 · 混合 AI |
| `mvp/08-empty-inbox.jpg` | 空收件箱 Inbox Zero |
| `mvp/09-dark-inbox.jpg` | 深色三栏主界面 |
| `mvp/10-smart-organize.jpg` | 稍后处理 / 归档工具条 |
| `mvp/11-connection-error.jpg` | IMAP 连接失败 |
| `mvp/12-search.jpg` | 本地搜索 |

> 说明：生成图中的文字偶有伪影（模型常见），**以 `docs/DESIGN.md` + `PROMPTS.md` 为工程实现准绳**；视觉气质与材料分层以本目录图片为准。
