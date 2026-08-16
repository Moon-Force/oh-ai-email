# 跨平台打包、签名与分发指南 (Distribution & Code Signing)

本文档面向 oh-ai-email 桌面客户端（Windows / macOS / Linux）的构建、打包、代码签名与分发流程。

---

## 1. 构建环境与命令

### 依赖前提

- Node.js >= 20.x
- pnpm >= 9.x
- Windows: Visual Studio C++ Build Tools（或预编译的 sql.js wasm）
- macOS: Xcode Command Line Tools
- Linux: standard build essentials (`build-essential`, `libssl-dev`)

### 打包命令

```bash
# 1. 开发环境运行
pnpm dev

# 2. 编译打包测试（仅解包，快速验证 Electron 与 React 打包无误）
pnpm build:unpack

# 3. Windows 安装包构建（生成 NSIS .exe 安装包与 Portable 便携版）
pnpm build:win

# 4. 全平台构建（依据当前系统环境）
pnpm build
```

构建产物输出目录位于：`apps/desktop/release/`。

---

## 2. 跨平台产物类型

| 操作系统    | 产物格式                                    | 说明                                                  |
| :---------- | :------------------------------------------ | :---------------------------------------------------- |
| **Windows** | `.exe` (NSIS Installer) · `.exe` (Portable) | 支持自定义安装目录、桌面/开始菜单快捷方式、开机自启。 |
| **macOS**   | `.dmg` (Disk Image) · `.zip`                | 支持 Apple Silicon (arm64) 与 Intel (x64) 通用架构。  |
| **Linux**   | `.AppImage` · `.deb`                        | 适用于 Ubuntu/Debian 及主流通用 Linux 发行版。        |

---

## 3. 代码签名与公证流程 (Code Signing & Notarization)

### Windows (Authenticode)

1. **获取证书**：从受信任的 CA 机构（Sectigo, DigiCert 等）获取 EV 代码签名证书或标准代码签名证书（或使用 Azure Trusted Signing）。
2. **环境变量配置**（在 CI/CD 或本地环境）：
   - `CSC_LINK`: 证书 `.pfx` 文件路径或 base64 字符串；
   - `CSC_KEY_PASSWORD`: 证书密码。
3. **CI 流程**：`electron-builder` 将自动调用 `signtool.exe` 进行签名和 RFC 3161 时间戳盖章。

### macOS (Notarization & Gatekeeper)

1. **Apple Developer 账号**：加入 Apple Developer Program 获取 Developer ID Application 证书。
2. **环境变量配置**：
   - `CSC_LINK`: 包含 Developer ID 证书的 `.p12` 路径或 base64；
   - `CSC_KEY_PASSWORD`: `.p12` 证书密码；
   - `APPLE_ID`: 苹果开发者账号邮箱；
   - `APPLE_APP_SPECIFIC_PASSWORD`: 专用于公证的应用专用密码（在 appleid.apple.com 生成）；
   - `APPLE_TEAM_ID`: 10 位 Team ID。
3. **公证机制**：
   `electron-builder` 在构建 `.dmg` 后自动上传至 Apple Notary Service 完成 Notarization，并执行 `xcrun stapler staple` 钉入公证票据。

### Linux

- AppImage 与 deb 支持 GPG 签名：
  - `export GPG_KEY_ID="<Key ID>"`
  - `dpkg-sig -k <Key ID> --sign builder release/*.deb`

---

## 4. GitHub Actions 自动化打包与发布 (CI/CD)

项目已配置自动化打包发布工作流 [`.github/workflows/release.yml`](../.github/workflows/release.yml)。

### 自动触发打包流程：

只需在本地推送版本 Tag，GitHub Actions 会自动在 Windows、macOS、Linux 云端虚拟机上并发打包，并将所有平台的安装包自动发布至 GitHub Releases：

```bash
# 1. 提交代码并打标签
git tag v0.1.0

# 2. 推送 Tag 触发 GitHub 自动全平台打包
git push origin v0.1.0
```

### 手动触发打包流程：

1. 打开 GitHub 仓库页面；
2. 导航至 **Actions** -> **Release** 工作流；
3. 点击 **Run workflow** 按钮选择分支即可触发一键打包并下载产物。

客户端设置中心内的「检查更新」按钮将自动比对 GitHub Release 并引导用户下载最新版本。
