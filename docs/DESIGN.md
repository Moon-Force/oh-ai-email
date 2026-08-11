# UI 设计规范 · Liquid Glass

> 产品：**oh-ai-email**（Spark 向 AI 桌面邮箱）  
> 视觉主轴：**苹果流动玻璃（Liquid Glass）** — 功能层玻璃浮于内容层之上  
> 实现：Tauri 2 + React；样式以 CSS 变量落地（见 [design-tokens.css](./design-tokens.css)）  
> 预览：[design-preview.html](./design-preview.html)

---

## 0. 设计命题

| 项 | 定义 |
|----|------|
| **对象** | 桌面 AI 邮箱客户端主界面（三栏：导航 / 列表 / 读信） |
| **受众** | 每天清收件箱的个人用户；要安静、清楚、可依赖 |
| **单页任务** | 在不抢走正文注意力的前提下，用玻璃层完成导航、工具与 AI |
| **签名记忆点** | **Lumen Capsule（流光胶囊）**：读信区右上角的液态玻璃 AI 控件——静止是胶囊，调用时 morph 成面板；镜面高光随悬停漂移 |

**刻意不做的通用 AI 模板**

- 不做暖奶油底 + 衬线大标题 + 赤陶强调  
- 不做纯黑底 + 荧光绿/朱红单点缀  
- 不做报纸网格 + 零圆角  

**美学风险（可辩护）**  
玻璃会「接住房间光」：内容层保持哑光可读；**仅功能层**带微折射与环境色渗入。选中某封信时，侧栏玻璃边缘渗入极淡的发件人色相（≤8% 饱和），像真实玻璃映出桌面色——增强层次，不染色正文。

---

## 1. Liquid Glass 原则（对齐苹果 HIG 精神）

依据 Apple 对 Liquid Glass 的定位：材料用于**控件与导航的功能层**，浮在内容之上；内容层滚动时可从下方透出；材料随环境明暗与运动产生镜面高光。

### 必须

1. **双层分离**  
   - **功能层（Glass）**：侧栏、顶栏工具条、分段控件、浮动 AI 胶囊、弹出菜单、Toast  
   - **内容层（Matte）**：邮件列表行、正文阅读区、设置表单主体、空状态插画底  

2. **玻璃不进正文**  
   邮件 HTML、列表行背景**禁止**整块 Liquid Glass，避免层次糊成一团、可读性崩溃。

3. **透而可读**  
   玻璃后内容可隐约透过，但标签/图标对比度满足 WCAG AA（正文对比另算内容层）。

4. **少即是多的颜色**  
   导航与控件颜色克制，让邮件内容「透上来」；强调色只用于未读点、主按钮、AI 状态。

5. **运动即材料**  
   高光、模糊半径、morph 形状随交互变化；`prefers-reduced-motion` 时降为淡入淡出。

### 禁止

| 禁止 | 原因 |
|------|------|
| 全屏毛玻璃罩住正文 | 对比度与疲劳；违背「玻璃=功能层」 |
| 多层玻璃叠玻璃无层级 | 脏、抖、性能差 |
| 高饱和渐变当玻璃填充 | 廉价「霓虹玻璃」感 |
| 每行邮件都用 glass card | 内容层误用 |

---

## 2. 设计 Token

### 2.1 色彩（具名）

| 名称 | 角色 | Light | Dark |
|------|------|-------|------|
| **Mist Canvas** | 内容层应用底 | `#E4E9F2` | — |
| **Night Pool** | 内容层应用底（暗） | — | `#0B0F14` |
| **Paper** | 列表/读信内容表面 | `#F4F6FA` | `#141A22` |
| **Ink** | 主文字 | `#1A1D24` | `#F2F4F8` |
| **Ink Mute** | 次级文字 | `#5C6578` | `#9AA3B5` |
| **Lumen Blue** | 主强调 / 未读 / AI | `#2F6BFF` | `#5B8CFF` |
| **Reply Ember** | 需回复 / 警告性强调 | `#E85D4C` | `#FF7A6A` |
| **Glass Stroke** | 玻璃描边 | `rgba(255,255,255,0.55)` | `rgba(255,255,255,0.12)` |
| **Specular** | 镜面高光带 | `rgba(255,255,255,0.72)` | `rgba(255,255,255,0.18)` |

**玻璃填充（功能层）**

```
Light:  background: linear-gradient(
          165deg,
          rgba(255,255,255,0.72) 0%,
          rgba(255,255,255,0.42) 100%
        );
        backdrop-filter: blur(28px) saturate(1.6);

Dark:   background: linear-gradient(
          165deg,
          rgba(40,48,62,0.72) 0%,
          rgba(18,24,34,0.55) 100%
        );
        backdrop-filter: blur(32px) saturate(1.4);
```

**环境渗色（签名风险，可选）**  
CSS 变量 `--ambient-tint`：默认 `transparent`；选中线程时设为 `color-mix(in oklab, <avatar-hue> 12%, transparent)`，仅作用于玻璃层 `box-shadow` / 外缘，不改 `Paper` 正文底。

### 2.2 字体

跨平台优先 **系统人像字体**（Mac 上即 SF，贴合 Liquid Glass 原生感）：

| 角色 | 栈 | 用法 |
|------|-----|------|
| **Display** | `"SF Pro Display", "Segoe UI Variable Display", system-ui, sans-serif` | 设置大标题、空状态标题；字重 600–700；**少用** |
| **Body** | `"SF Pro Text", "Segoe UI Variable", system-ui, sans-serif` | 列表主题、正文 UI、按钮 |
| **Utility** | `"SF Mono", "Cascadia Mono", ui-monospace, monospace` | 时间戳、未读数、快捷键提示 |

**字阶（桌面）**

| Token | Size / Line | 用途 |
|-------|-------------|------|
| `text-display` | 28 / 34 | 空状态、设置页 H1 |
| `text-title` | 17 / 22 | 读信主题 |
| `text-body` | 14 / 20 | 列表预览、UI |
| `text-caption` | 12 / 16 | 时间、账号、快捷键 |
| `text-micro` | 11 / 14 | Badge、分段标签 |

字距：标题略紧 `letter-spacing: -0.02em`；caption `0.01em`。

### 2.3 圆角 · 间距 · 阴影

| Token | 值 | 用途 |
|-------|-----|------|
| `radius-control` | 12px | 按钮、输入 |
| `radius-glass` | 20px | 侧栏、工具条块 |
| `radius-capsule` | 999px | Lumen Capsule、分段 |
| `radius-row` | 10px | 列表选中行（内容层） |
| `space-1`…`space-8` | 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 | 节奏 |
| `elev-glass` | `0 8px 32px rgba(15,23,42,0.12), inset 0 1px 0 var(--specular)` | 玻璃浮起 |
| `elev-float` | `0 16px 48px rgba(15,23,42,0.18)` | 弹出层 |

### 2.4 运动

| Token | 值 | 用途 |
|-------|-----|------|
| `ease-glass` | `cubic-bezier(0.22, 1, 0.36, 1)` | morph、面板展开 |
| `ease-soft` | `cubic-bezier(0.4, 0, 0.2, 1)` | 淡入、高光 |
| `dur-fast` | 120ms | 按下 |
| `dur-med` | 280ms | 胶囊展开 |
| `dur-slow` | 480ms | 侧栏环境色过渡 |

Reduced motion：关闭 specular 漂移与 morph，仅 opacity/transform 小步进。

---

## 3. 布局

### 3.1 主界面概念

**「哑光信纸 + 浮层玻璃器械」**  
内容像放在雾蓝桌面上的纸；导航与 AI 是浮在纸上的玻璃仪器。

```
┌─────────────────────────────────────────────────────────────┐
│ ░ Mist Canvas / Night Pool（应用底，可带极淡径向光）          │
│  ┌──────────┐  ┌────────────┐  ┌──────────────────────────┐ │
│  │ GLASS    │  │ PAPER      │  │ PAPER 读信                  │ │
│  │ Sidebar  │  │ 列表        │  │  主题 · 发件人 · 正文       │ │
│  │ 分箱     │  │ (matte)    │  │                          │ │
│  │ 账号     │  │            │  │     ┌─────────────────┐  │ │
│  │          │  │            │  │     │ Lumen Capsule   │  │ │
│  │          │  │            │  │     │ (GLASS · AI)    │  │ │
│  └──────────┘  └────────────┘  │     └─────────────────┘  │ │
│                                └──────────────────────────┘ │
│  ┌──────────────── GLASS 底栏 / 选中时工具条（可选）─────────┐ │
└─────────────────────────────────────────────────────────────┘
```

| 区域 | 材料 | 说明 |
|------|------|------|
| 应用底 | 柔和渐变实色 | 为玻璃提供「可折射」的背景，非纯白 |
| 侧栏 | **Liquid Glass** | 分箱、账号、设置入口 |
| 列表 | **Paper matte** | 行选中用浅填充，不用 blur |
| 读信 | **Paper matte** | HTML 沙箱正文 |
| 顶/浮工具 | **Liquid Glass** | 归档、回复、搜索 |
| AI | **Lumen Capsule** | 功能层；展开后仍为玻璃面板 |

### 3.2 密度

- 列表行高：约 64–72px（头像 36 + 两行字）  
- 侧栏宽：220–260px  
- 读信最大宽：720px 居中（长文可读）  
- 窗口最小：960×640  

### 3.3 响应

| 宽度 | 行为 |
|------|------|
| ≥1280 | 三栏全开 |
| 960–1279 | 侧栏可折叠为玻璃 icon rail |
| <960 | 二期移动；桌面可列表/读信栈式 |

---

## 4. 组件谱系

### 4.1 Glass Surface（基础）

- `backdrop-filter: blur(28–40px) saturate(1.4–1.8)`  
- 半透明渐变填充 + 1px 亮边（上沿 specular）  
- 内阴影极轻：`inset 0 1px 0 rgba(255,255,255,0.5)`  
- 禁止在动画中每帧改 blur 值（用 opacity/transform）

### 4.2 Glass Button

- 默认：透明玻璃底 + Ink 字  
- Primary：Lumen Blue 实心（**不要**毛玻璃主按钮，保证 CTA 清晰）  
- Destructive：Reply Ember 字色 + 淡红玻璃底  

### 4.3 Glass Segmented（分箱切换）

- 胶囊轨道玻璃；选中块为更不透明的「液滴」滑块（layout 动画）  

### 4.4 Message Row（内容层）

- 左：未读点（Lumen Blue）  
- 中：发件人 600 + 主题 400 + 预览 mute  
- 右：Utility 时间  
- Hover：Paper 上 4% 加深；**无** backdrop-filter  

### 4.5 Lumen Capsule（签名组件）

**静止**

- 高度 36px，padding 12–16，全圆角  
- 图标（sparkle/lumen）+「询问 AI」或「摘要」  
- 表面 Liquid Glass；高光条 `background-position` 随 pointer 微移  

**工作中**

- 宽度 morph 至 320–360px，高度至内容  
- 内嵌：摘要结果 / 草稿预览 / 改语气芯片  
- 底部主操作：「插入草稿」「复制」「关闭」— 动词明确  

**状态色**

| 状态 | 表现 |
|------|------|
| idle | 中性玻璃 |
| thinking | 边缘 Lumen 呼吸光 1.2s（reduced-motion 则静态） |
| ready | 稳定，内容淡入 |
| local mode | 小标签「本机」Utility 字 |
| error | Reply Ember 边，文案说明可重试 |

### 4.6 空状态

- Display 标题一句：如「收件箱已清空」  
- Body 一句下一步：「点左下角添加邮箱」  
- 不要装饰性插画堆料；可用单层线条信封 + 玻璃反光  

### 4.7 错误与连接

- 「无法连接 IMAP」+ 原因一句 +「检查账号」按钮  
- 不道歉文学；不说「webhook / token refresh failed」给用户  

---

## 5. 文案语气（界面用语）

| 场景 | 用 | 不用 |
|------|----|------|
| 主按钮 | 发送、插入草稿、添加邮箱 | 提交、确认、OK |
| AI | 写回复、总结这封、更短一点 | 执行推理、生成 completion |
| 空列表 | 没有邮件 · 同步中… | 暂无数据 |
| 本地 AI | 使用本机模型 | Ollama endpoint 已连接（可放高级设置） |

Sentence case；中文无多余英文夹杂（专有名除外）。

---

## 6. 无障碍与性能

| 项 | 要求 |
|----|------|
| 对比度 | 内容层正文 ≥ 4.5:1；玻璃上的标签在典型背景抽样下 ≥ 4.5:1 |
| 焦点 | `:focus-visible` 2px Lumen 环，偏移 2px |
| 动效 | 尊重 `prefers-reduced-motion` |
| 模糊性能 | 玻璃面数量控制：侧栏 1 + 顶栏 1 + 浮层 ≤2 同时；列表虚拟滚动 |
| 强制色彩 | `forced-colors` 下退回系统边框，取消 blur |

---

## 7. 实现映射（工程）

| 设计 | 代码落点 |
|------|----------|
| Token | `docs/design-tokens.css` → 迁入 `apps/desktop/src/styles/tokens.css` |
| 主题 | `data-theme="light" \| "dark"` 在 `<html>`；跟随系统 |
| 玻璃类 | `.glass` / `.glass-subtle` / `.lumen-capsule` |
| 内容表面 | `.surface-paper` |
| 环境渗色 | 选中线程时 setProperty `--ambient-tint` |
| 预览 | 打开 `docs/design-preview.html` 验收观感 |

**Tauri 注意**

- Windows WebView2：确认 `backdrop-filter` 可用；降级为半透明实色 + 细边  
- macOS：效果最接近 SF + vibrancy；可调研与系统 vibrancy 混用，但 **逻辑上仍遵守功能层/内容层分离**  
- 透明窗口：可选 `transparent` 窗体让玻璃更真，需处理阴影与圆角窗 |

---

## 8. 实施名单增补（设计相关）

并入 [IMPLEMENTATION.md](./IMPLEMENTATION.md) 阶段 0/6 执行：

| ID | 任务 | 验收 |
|----|------|------|
| D.1 | 接入 `design-tokens.css` 与主题切换 | 明暗两套玻璃可读 |
| D.2 | 主壳三栏：侧栏 glass + 列表/读信 paper | 层次一眼可辨 |
| D.3 | 实现 Lumen Capsule 静/动两态 | morph + reduced-motion |
| D.4 | 列表/读信/按钮组件按本节 API | 无内容层滥用 blur |
| D.5 | 预览页与真机三端（Win/Mac/Linux）截图对照 | 降级策略写进 README |
| D.6 | 环境渗色 `--ambient-tint`（可后置） | 不影响对比度 |

---

## 9. 自检清单（发 PR 前）

- [ ] 玻璃是否只用在导航/控件/AI，而不是邮件正文？  
- [ ] 主按钮是否仍是实心 Lumen（不是半透明看不清）？  
- [ ] 签名是否只有 Lumen Capsule 一处「炫」，别处是否克制？  
- [ ] 暗色模式玻璃是否发灰脏污（检查 saturate 与 fill）？  
- [ ] 去掉一个装饰后是否更干净？（Chanel 规则）  

---

## 10. 参考

- Apple Newsroom：Liquid Glass 材料与跨平台一致性  
- Apple HIG · Materials：Liquid Glass 用于控件与导航功能层，内容层用标准材料  
- 产品对标气质：Spark（友好整理 + AI），非 Superhuman 极客密度  

**文档版本**：2026-08-11 · 与 PRODUCT / ARCHITECTURE 决策一致  
