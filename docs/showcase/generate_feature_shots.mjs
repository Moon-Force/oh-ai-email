import { createRequire } from "node:module";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(__dirname, "../../apps/desktop/package.json"));

const assetsDir = path.resolve(__dirname, "../../apps/web/public/assets");
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', -apple-system, sans-serif; }
    body { background: transparent; padding: 30px; }
    
    .mock-popup {
      width: 480px;
      background: #141822;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 18px;
      box-shadow: 0 30px 60px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.05);
      color: #F3F4F6;
      overflow: hidden;
    }

    .mock-header {
      padding: 16px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      font-size: 15px;
      font-weight: 600;
    }
    .mock-close { color: #9CA3AF; font-size: 16px; cursor: pointer; }

    .mock-body { padding: 20px; }

    .field-group { margin-bottom: 16px; }
    .field-label { font-size: 13px; color: #9CA3AF; margin-bottom: 6px; font-weight: 500; }
    .field-input {
      width: 100%;
      background: #0B0E14;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      padding: 10px 14px;
      color: #FFF;
      font-size: 13px;
    }

    .option-list { display: flex; flex-direction: column; gap: 8px; }
    .option-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 10px;
    }
    .option-item.active {
      background: rgba(37, 99, 235, 0.18);
      border-color: #3B82F6;
    }
    .option-title { font-size: 14px; font-weight: 500; display: flex; align-items: center; gap: 10px; }
    .option-time { font-size: 13px; color: #9CA3AF; font-family: 'JetBrains Mono', monospace; }

    .chip-row { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 14px; }
    .chip {
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.08);
      color: #E5E7EB;
    }
    .chip.active {
      background: #2563EB;
      color: #FFF;
      border-color: #2563EB;
    }

    .result-box {
      background: #0B0E14;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 10px;
      padding: 14px;
      font-size: 13px;
      line-height: 1.65;
      color: #E5E7EB;
    }
    .think-tag {
      font-size: 11px;
      color: #A78BFA;
      font-family: 'JetBrains Mono', monospace;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .warning-box {
      background: rgba(245, 158, 11, 0.12);
      border: 1px solid rgba(245, 158, 11, 0.28);
      border-radius: 10px;
      padding: 14px;
      display: flex;
      gap: 12px;
      align-items: flex-start;
      margin-bottom: 16px;
    }
    .warning-icon { font-size: 20px; }
    .warning-title { font-size: 14px; font-weight: 600; color: #FBBF24; margin-bottom: 4px; }
    .warning-desc { font-size: 12px; color: #D1D5DB; line-height: 1.5; }

    .btn-row { display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px; }
    .btn-sm {
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      border: none;
    }
    .btn-cancel { background: rgba(255, 255, 255, 0.08); color: #FFF; }
    .btn-confirm { background: #2563EB; color: #FFF; }
  </style>
</head>
<body>

  <!-- 1. Snooze Popup -->
  <div id="shot-snooze" class="mock-popup">
    <div class="mock-header">
      <span>⏰ 稍后提醒我 (Snooze)</span>
      <span class="mock-close">✕</span>
    </div>
    <div class="mock-body">
      <div style="font-size: 13px; color: #9CA3AF; margin-bottom: 14px;">到点自动将邮件唤醒并推至收件箱顶部：</div>
      <div class="option-list">
        <div class="option-item active">
          <div class="option-title"><span>🌆</span> 今晚稍后</div>
          <div class="option-time">18:00</div>
        </div>
        <div class="option-item">
          <div class="option-title"><span>🌅</span> 明天上午</div>
          <div class="option-time">09:00</div>
        </div>
        <div class="option-item">
          <div class="option-title"><span>🌴</span> 本周末</div>
          <div class="option-time">周六 10:00</div>
        </div>
        <div class="option-item">
          <div class="option-title"><span>📅</span> 自定义指定日期与时间...</div>
          <div class="option-time">选择</div>
        </div>
      </div>
      <div class="btn-row">
        <button class="btn-sm btn-cancel">取消</button>
        <button class="btn-sm btn-confirm">设为稍后提醒</button>
      </div>
    </div>
  </div>

  <!-- 2. AI Capsule -->
  <div id="shot-ai" class="mock-popup" style="margin-top: 40px;">
    <div class="mock-header">
      <span style="display: flex; align-items: center; gap: 8px;">
        <span style="color: #60A5FA;">✨</span> AI 智能办公读写助手
      </span>
      <span style="font-size: 12px; color: #34D399; font-weight: 500;">● 本地加密已保护</span>
    </div>
    <div class="mock-body">
      <div class="chip-row">
        <div class="chip active">✨ 提炼核心要点</div>
        <div class="chip">✍️ 一键起草回复</div>
        <div class="chip">📋 提取待办清单</div>
        <div class="chip">🌐 译为英文</div>
      </div>
      <div class="result-box">
        <div class="think-tag">🧠 正在分析来信关键信息与时间节点 (0.4s)</div>
        <div style="font-weight: 600; margin-bottom: 4px; color: #60A5FA;">📌 【核心要点】</div>
        <div>1. 新版本发布时间定于下周二 15:00；</div>
        <div>2. 市场组需在周五前提交宣发物料，客服组周一更新答疑；</div>
        <div>3. 建议直接一键回复确认参会排期。</div>
      </div>
      <div class="btn-row">
        <button class="btn-sm btn-cancel">复制结果</button>
        <button class="btn-sm btn-confirm">插入到邮件草稿</button>
      </div>
    </div>
  </div>

  <!-- 3. Pre-send Check -->
  <div id="shot-presend" class="mock-popup" style="margin-top: 40px;">
    <div class="mock-header">
      <span>🛡️ 发信前智能安全把关</span>
      <span class="mock-close">✕</span>
    </div>
    <div class="mock-body">
      <div class="warning-box">
        <div class="warning-icon">⚠️</div>
        <div>
          <div class="warning-title">检测到可能遗漏了附件</div>
          <div class="warning-desc">邮件正文中提及了“如附件清单所示”，但目前您尚未添加任何附件文件。</div>
        </div>
      </div>
      <div class="field-group">
        <div class="field-label">收件人安全确认</div>
        <div class="field-input" style="font-size: 13px; color: #9CA3AF;">外部联系人：emma@designlab.co (已校验安全)</div>
      </div>
      <div class="btn-row">
        <button class="btn-sm btn-confirm" style="background: #3B82F6;">添加附件</button>
        <button class="btn-sm btn-cancel">仍然直接发送</button>
      </div>
    </div>
  </div>

  <!-- 4. Security -->
  <div id="shot-security" class="mock-popup" style="margin-top: 40px;">
    <div class="mock-header">
      <span>🔒 账户直连与本地加密存储</span>
      <span style="font-size: 12px; color: #34D399;">● safeStorage Active</span>
    </div>
    <div class="mock-body">
      <div class="option-list" style="margin-bottom: 16px;">
        <div class="option-item">
          <div class="option-title"><span>📮</span> QQ 邮箱 / 腾讯企业邮</div>
          <div style="font-size: 12px; color: #34D399;">● 实时秒推直连</div>
        </div>
        <div class="option-item">
          <div class="option-title"><span>📧</span> 网易 163 / 126 邮箱</div>
          <div style="font-size: 12px; color: #34D399;">● 实时秒推直连</div>
        </div>
      </div>
      <div class="result-box" style="background: rgba(16, 185, 129, 0.08); border-color: rgba(16, 185, 129, 0.2);">
        <div style="color: #34D399; font-weight: 600; margin-bottom: 4px;">🛡️ 100% 纯客户端直连保护</div>
        <div style="font-size: 12px; color: #D1D5DB;">
          所有邮箱密码由 Windows DPAPI / macOS Keychain 芯片级加密保管，绝不经过任何第三方服务器中转。
        </div>
      </div>
    </div>
  </div>

</body>
</html>
`;

async function renderMockShots() {
  const { chromium } = require("playwright");
  const browser = await chromium.launch({ headless: true, channel: "chrome" });
  const page = await browser.newPage({
    viewport: { width: 800, height: 1600 },
    deviceScaleFactor: 2,
  });

  await page.setContent(htmlContent);
  await page.waitForTimeout(500);

  const targets = [
    { id: "#shot-snooze", file: "feature_snooze.png" },
    { id: "#shot-ai", file: "feature_ai.png" },
    { id: "#shot-presend", file: "feature_presend.png" },
    { id: "#shot-security", file: "feature_security.png" },
  ];

  for (const t of targets) {
    const el = await page.$(t.id);
    if (el) {
      const outPath = path.join(assetsDir, t.file);
      await el.screenshot({ path: outPath, omitBackground: true });
      console.log(`Saved screenshot: ${outPath}`);
    }
  }

  await browser.close();
  console.log("All UI feature popup screenshots generated!");
}

renderMockShots().catch((e) => {
  console.error(e);
  process.exit(1);
});
