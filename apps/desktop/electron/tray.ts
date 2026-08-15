import { app, BrowserWindow, Menu, nativeImage, type NativeImage, Tray } from "electron";
import path from "node:path";
import fs from "node:fs";

let tray: Tray | null = null;

/** Create a simple 16x16 PNG 1-bit icon buffer fallback */
function createFallbackTrayIcon(): NativeImage {
  // A minimal 16x16 RGBA buffer (blue mail square with envelope flap)
  const width = 16;
  const height = 16;
  const buffer = Buffer.alloc(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      // Draw a rounded rectangle with envelope shape
      const isBorder = x === 1 || x === 14 || y === 3 || y === 13;
      const isFlap = (y >= 4 && y <= 8 && (x === y || x === 15 - y));
      const isInside = x > 1 && x < 14 && y > 3 && y < 13;

      if (isBorder || isFlap) {
        buffer[idx] = 25;     // R (Lumen Blue #1976D2)
        buffer[idx + 1] = 118; // G
        buffer[idx + 2] = 210; // B
        buffer[idx + 3] = 255; // A
      } else if (isInside) {
        buffer[idx] = 100;
        buffer[idx + 1] = 149;
        buffer[idx + 2] = 237;
        buffer[idx + 3] = 180;
      } else {
        buffer[idx + 3] = 0;   // Transparent
      }
    }
  }

  return nativeImage.createFromBuffer(buffer, { width, height });
}

export function initTray(
  win: BrowserWindow,
  callbacks?: {
    onSyncNow?: () => void;
    onOpenCompose?: () => void;
  },
): Tray {
  if (tray) return tray;

  let iconImage: NativeImage;
  const iconPath = path.join(app.getAppPath(), "design/app-icon.jpg");
  if (fs.existsSync(iconPath)) {
    iconImage = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  } else {
    iconImage = createFallbackTrayIcon();
  }

  tray = new Tray(iconImage);
  tray.setToolTip("oh-ai-email — AI 智能邮件客户端");

  const buildContextMenu = () =>
    Menu.buildFromTemplate([
      {
        label: "打开主窗口",
        click: () => {
          if (!win.isDestroyed()) {
            win.show();
            win.focus();
          }
        },
      },
      {
        label: "立即同步邮件",
        click: () => {
          callbacks?.onSyncNow?.();
        },
      },
      {
        label: "撰写新邮件",
        click: () => {
          if (!win.isDestroyed()) {
            win.show();
            win.focus();
            callbacks?.onOpenCompose?.();
          }
        },
      },
      { type: "separator" },
      {
        label: "退出 oh-ai-email",
        click: () => {
          (app as unknown as { isQuitting: boolean }).isQuitting = true;
          app.quit();
        },
      },
    ]);

  tray.setContextMenu(buildContextMenu());

  tray.on("click", () => {
    if (!win.isDestroyed()) {
      if (win.isVisible()) {
        win.hide();
      } else {
        win.show();
        win.focus();
      }
    }
  });

  return tray;
}

export function destroyTray() {
  if (tray) {
    tray.destroy();
    tray = null;
  }
}
