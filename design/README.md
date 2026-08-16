# design/ — 历史示意与品牌资产

> **注意**：产品 UI 已改为 **MUI Material UI**。  
> 工程实现以 [`docs/DESIGN.md`](../docs/DESIGN.md) 与  
> [`apps/desktop/src/theme/createAppTheme.ts`](../apps/desktop/src/theme/createAppTheme.ts) 为准。  
> 本目录中的 MVP 界面图与旧提示词 **仅作历史参考**，不要求实现与之像素一致。

## 目录

```
design/
├── README.md          # 本说明
├── PROMPTS.md         # 旧生图提示词（归档）
├── app-icon.jpg
├── brand/             # 应用图标 / 矢量（仍可使用）
└── mvp/               # 旧 12 张界面示意（Liquid Glass 时代）
```

## 仍有效

| 路径           | 用途                              |
| -------------- | --------------------------------- |
| `brand/`       | 应用图标、托盘/安装包资源可继续用 |
| `app-icon.jpg` | README 展示用图标                 |

## 已归档 / 不作为准绳

| 路径         | 说明                                 |
| ------------ | ------------------------------------ |
| `mvp/*.jpg`  | 旧玻璃风格示意                       |
| `PROMPTS.md` | 旧生图提示词（含 Liquid Glass 描述） |

若重新出产品图，请按 **MUI Material** 语言撰写提示词，并写清「Material Design 3 / MUI desktop email client」，**不要**再写 Liquid Glass。
