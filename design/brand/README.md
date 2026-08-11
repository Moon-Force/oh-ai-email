# Brand · Icons

## 主图标（推荐）

**玻璃信封 + Lumen 光珠**

| 文件 | 用途 |
|------|------|
| [`icon-primary.jpg`](./icon-primary.jpg) | **正式主图标**（应用商店 / README / 桌面） |
| [`icon.svg`](./icon.svg) | 矢量稿，托盘、favicon、可缩放 UI |
| [`../app-icon.jpg`](../app-icon.jpg) | 快捷入口副本 |

**概念**

- 圆角方底板：雾蓝哑光（Mist），安静高级  
- 信封：Liquid Glass 晶体，高光与折射，不做廉价 3D 卡通  
- 中央 **Lumen 蓝珠** `#2F6BFF`：唯一强调色 = AI / 焦点（对应产品 Lumen Capsule）  
- 无文字、无角标、无神经网络杂讯 —— **简约但不空**

小尺寸仍可读：外形是「信」，记忆点是「蓝光封印」。

---

## 备选：O + 胶囊（字母感 monogram）

更抽象，贴「oh」与 Lumen 控件；邮箱语义弱于主图标。

| 文件 | 用途 |
|------|------|
| [`icon-mark-alt.jpg`](./icon-mark-alt.jpg) | 精修 monogram 渲染 |
| [`icon-mark.svg`](./icon-mark.svg) | 矢量 monogram（16px favicon 可试） |

---

## 探索稿（未采用）

| 文件 | 说明 |
|------|------|
| `icon-explore-tray.jpg` | 收件托盘 + 水滴，优雅但邮件识别偏弱 |
| `icon-primary-draft.jpg` / `icon-mark-draft.jpg` | 生成初稿，已被 primary / mark-alt 取代 |

---

## 使用规范

1. **默认只用主图标** `icon-primary` + `icon.svg`。  
2. 背景干净时可用完整圆角方；深色 UI 内可只用矢量线条 + 蓝珠。  
3. 不要给图标加未读红点进 master 文件（红点由系统/应用运行时叠加）。  
4. 导出商店资源时从 `icon-primary.jpg` 裁切/缩放；需要透明底时以 `icon.svg` 重导出 PNG。  
5. 主色：**Lumen Blue `#2F6BFF`**；玻璃保持冷灰蓝，避免霓虹。

## 接入应用（脚手架后）

- Electron：`apps/desktop/build/icons/`（`electron-builder` 从 1024 源图生成）  
- 源图建议：将 primary 做成 1024×1024 PNG 再跑图标流水线  
