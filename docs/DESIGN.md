# UI 设计规范 · Material UI (MUI)

> 产品：**oh-ai-email**（Spark 向 AI 桌面邮箱）  
> 视觉主轴：**MUI Material Design** — 桌面三栏邮件客户端  
> 实现：**Electron + React + TypeScript + MUI (`@mui/material`)**  
> 主题代码：[`apps/desktop/src/theme/createAppTheme.ts`](../apps/desktop/src/theme/createAppTheme.ts)

---

## 0. 设计命题

| 项           | 定义                                                            |
| ------------ | --------------------------------------------------------------- |
| **对象**     | 桌面 AI 邮箱客户端主界面（导航 / 列表 / 读信）                  |
| **受众**     | 每天清收件箱的个人用户：清楚、可依赖、不过度炫技                |
| **单页任务** | 浏览、阅读、回复；AI 辅助摘要与草稿，**不自动发送**             |
| **签名能力** | **AI 助手面板**（读信区）：空闲 → 思考 → 展开结果；操作动词明确 |

**不再使用**

- 苹果 Liquid Glass / 流动玻璃 / 毛玻璃整栏特效
- 自定义 `.glass` / SVG 折射 / WebGL 透镜作为产品视觉规范
- 以 `design/mvp` 玻璃示意为工程实现准绳（历史参考稿，可忽略）

---

## 1. 技术栈与主题

| 项       | 约定                                                                                            |
| -------- | ----------------------------------------------------------------------------------------------- |
| 组件库   | [MUI Material UI](https://github.com/mui/material-ui) — `@mui/material` + `@mui/icons-material` |
| 样式引擎 | Emotion（MUI 默认 peer）                                                                        |
| 主题     | `createTheme` + `ThemeProvider` + `CssBaseline`                                                 |
| 明暗     | `palette.mode: "light" \| "dark"`，应用内可切换                                                 |
| 主色     | **Lumen Blue** `#2F6BFF`（light）/ `#5B8CFF`（dark）                                            |
| 次要强调 | **Reply Ember** `#E85D4C` / `#FF7A6A`（警告、需回复）                                           |
| 字体     | Roboto / system-ui / Segoe UI（见 theme `typography.fontFamily`）                               |

实现落点：

- `apps/desktop/src/theme/createAppTheme.ts` — 色板、圆角、组件默认样式
- `apps/desktop/src/theme/AppThemeProvider.tsx` — 包裹应用
- `apps/desktop/src/App.tsx` 等 — 使用 `Box` / `AppBar` / `List` / `Button` 等 MUI 组件

可选：仍可用 Tailwind 做局部布局工具类，**不以 Tailwind 设计系统为主**。

---

## 2. 布局

```
┌─────────────────────────────────────────────────────────┐
│ AppBar：文件夹标题 · 搜索 · 写新邮件 · 主题切换            │
├──────────┬──────────────────┬───────────────────────────┤
│ Drawer/  │ Message list     │ Reader                    │
│ 侧栏     │ （发件人/主题/   │ 主题 · 发件人 · 正文 iframe │
│ 分箱/    │  摘要/时间）     │ AI 助手面板               │
│ 邮箱/    │                  │                           │
│ 设置入口 │                  │                           │
└──────────┴──────────────────┴───────────────────────────┘
```

| 区域        | MUI 建议                                                | 说明                                        |
| ----------- | ------------------------------------------------------- | ------------------------------------------- |
| 侧栏        | `List` / `ListItemButton` / `ListSubheader`             | 分箱 + 文件夹；选中态用 theme `selected`    |
| 顶栏        | `AppBar` + `Toolbar`                                    | 搜索 `TextField`，主按钮 `Button contained` |
| 列表        | `List` + `ListItemButton`                               | 未读可用左边框 / 字重区分                   |
| 读信        | `Typography` + 沙箱 `iframe`                            | HTML 邮件隔离渲染                           |
| AI          | `Paper` / `Chip` / `Button` / `CircularProgress`        | 空闲 · 思考 · 展开                          |
| 设置 / 表单 | `TextField` / `Select` / `Switch` / `ToggleButtonGroup` | 标准 Material 表单                          |

窗口建议：最小约 960×640；列表宽约 320–380px。

---

## 3. 组件与交互约定

### 3.1 按钮

- 主操作：`variant="contained"`（写新邮件、发送、保存更改）
- 次操作：`outlined` / `text`
- 文案：sentence case；中文动作词（发送、插入草稿、添加邮箱）

### 3.2 AI 助手

| 状态     | 表现                                         |
| -------- | -------------------------------------------- |
| idle     | 入口 +「总结这封」「写回复」+ 云端/本机 Chip |
| thinking | `CircularProgress` +「思考中…」              |
| expanded | 摘要或草稿正文 + 复制/插入草稿/关闭          |

**禁止** AI 自动发送邮件。

### 3.3 空状态与错误

- 空列表：标题一句 + 说明一句 + 主按钮（写新邮件 / 同步）
- 连接失败：`Alert` severity error + 重试 / 检查账号

### 3.4 动效

- 优先 MUI / CSS 轻过渡；尊重 `prefers-reduced-motion`
- 不为特效牺牲可读性

---

## 4. 无障碍

| 项        | 要求                                                 |
| --------- | ---------------------------------------------------- |
| 对比度    | 正文与控件满足 WCAG AA 倾向                          |
| 焦点      | 可见 focus ring（MUI 默认）                          |
| 标签      | 图标按钮需 `aria-label`；表单与搜索可访问名称完整    |
| 邮件 HTML | `iframe` sandbox；默认拦截远程图片（策略见安全文档） |

---

## 5. 文案语气

| 场景    | 用                         | 不用                                   |
| ------- | -------------------------- | -------------------------------------- |
| 主按钮  | 发送、插入草稿、添加邮箱   | 提交、OK、Confirm                      |
| AI      | 写回复、总结这封、更短一点 | 执行推理、生成 completion              |
| 空列表  | 没有邮件 · 同步中…         | 暂无数据                               |
| 本地 AI | 使用本机模型               | Ollama endpoint 已连接（可放高级设置） |

---

## 6. 与历史资产的关系

| 路径                  | 状态                                             |
| --------------------- | ------------------------------------------------ |
| `design/mvp/*.jpg`    | **历史示意稿**（旧玻璃风格），**不作为实现规范** |
| `design/PROMPTS.md`   | 旧生图提示词，仅归档                             |
| 旧 CSS token / 预览页 | **已废弃**；以 MUI theme 与本 DESIGN 为准        |

---

## 7. 自检清单（PR 前）

- [ ] 新 UI 是否用 MUI 组件，而非自造玻璃层？
- [ ] 明暗主题是否可读？
- [ ] 主按钮是否 `contained` 且文案为动作词？
- [ ] AI 是否仍不会自动发送？
- [ ] `pnpm -C apps/desktop test` 是否通过？
