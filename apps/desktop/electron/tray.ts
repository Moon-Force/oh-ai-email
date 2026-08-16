import { app, BrowserWindow, Menu, nativeImage, type NativeImage, Tray } from "electron";
import path from "node:path";
import fs from "node:fs";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let tray: Tray | null = null;

function createPngBuffer(width: number, height: number, rgbaBuffer: Buffer): Buffer {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 6;
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;

  const createChunk = (type: string, data: Buffer) => {
    const len = data.length;
    const chunk = Buffer.alloc(12 + len);
    chunk.writeUInt32BE(len, 0);
    chunk.write(type, 4, 4, "ascii");
    data.copy(chunk, 8);
    let crc = 0xffffffff;
    const toCrc = chunk.subarray(4, 8 + len);
    for (let i = 0; i < toCrc.length; i++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -((crc ^ toCrc[i]) & 1));
    }
    chunk.writeInt32BE(~crc, 8 + len);
    return chunk;
  };

  const ihdrChunk = createChunk("IHDR", ihdrData);
  const scanlines = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    const scanlineOffset = y * (width * 4 + 1);
    scanlines[scanlineOffset] = 0;
    const rawOffset = y * width * 4;
    rgbaBuffer.copy(scanlines, scanlineOffset + 1, rawOffset, rawOffset + width * 4);
  }

  const compressed = zlib.deflateSync(scanlines);
  const idatChunk = createChunk("IDAT", compressed);
  const iendChunk = createChunk("IEND", Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

/** Create a high-DPI crisp vector Mail envelope icon */
function createFallbackTrayIcon(): NativeImage {
  const size = 32;
  const buffer = Buffer.alloc(size * size * 4);

  const setPixel = (x: number, y: number, r: number, g: number, b: number, a: number) => {
    if (x < 0 || x >= size || y < 0 || y >= size) return;
    const idx = (y * size + x) * 4;
    const srcA = a / 255;
    const dstA = buffer[idx + 3] / 255;
    const outA = srcA + dstA * (1 - srcA);
    if (outA <= 0) return;
    buffer[idx] = Math.round((r * srcA + buffer[idx] * dstA * (1 - srcA)) / outA);
    buffer[idx + 1] = Math.round((g * srcA + buffer[idx + 1] * dstA * (1 - srcA)) / outA);
    buffer[idx + 2] = Math.round((b * srcA + buffer[idx + 2] * dstA * (1 - srcA)) / outA);
    buffer[idx + 3] = Math.round(outA * 255);
  };

  // Draw mail envelope body (Blue rounded rectangle)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (x >= 2 && x <= 29 && y >= 6 && y <= 25) {
        const inLeftTop = x < 6 && y < 10;
        const inRightTop = x > 25 && y < 10;
        const inLeftBottom = x < 6 && y > 21;
        const inRightBottom = x > 25 && y > 21;
        let inside = true;
        if (inLeftTop) inside = Math.hypot(x - 6, y - 10) <= 4;
        else if (inRightTop) inside = Math.hypot(x - 25, y - 10) <= 4;
        else if (inLeftBottom) inside = Math.hypot(x - 6, y - 21) <= 4;
        else if (inRightBottom) inside = Math.hypot(x - 25, y - 21) <= 4;

        if (inside) {
          const grad = (y - 6) / 20;
          setPixel(
            x,
            y,
            Math.round(25 + grad * 10),
            Math.round(118 + grad * 15),
            Math.round(210 + grad * 20),
            255
          );
        }
      }
    }
  }

  // Draw crisp white lines
  const drawLine = (
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    r: number,
    g: number,
    b: number,
    a: number,
    width = 1.5
  ) => {
    const dist = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.ceil(dist * 3);
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const cx = x0 + (x1 - x0) * t;
      const cy = y0 + (y1 - y0) * t;
      for (let ox = -2; ox <= 2; ox++) {
        for (let oy = -2; oy <= 2; oy++) {
          const px = Math.round(cx + ox);
          const py = Math.round(cy + oy);
          const d = Math.hypot(px - cx, py - cy);
          if (d <= width) {
            const factor = Math.max(0, 1 - d / width);
            setPixel(px, py, r, g, b, Math.round(a * factor));
          }
        }
      }
    }
  };

  drawLine(4, 9, 16, 19, 255, 255, 255, 255, 1.6);
  drawLine(28, 9, 16, 19, 255, 255, 255, 255, 1.6);
  drawLine(4, 23, 12, 16, 255, 255, 255, 180, 1.2);
  drawLine(28, 23, 20, 16, 255, 255, 255, 180, 1.2);

  const pngBuf = createPngBuffer(size, size, buffer);
  return nativeImage.createFromBuffer(pngBuf).resize({ width: 16, height: 16 });
}

export function getTrayIconPath(): string | null {
  const isWin = process.platform === "win32";
  const preferredExt = isWin ? ".ico" : ".png";
  const secondaryExt = isWin ? ".png" : ".ico";

  const candidateDirs = [
    path.join(__dirname, "assets"),
    path.join(__dirname, "../electron/assets"),
    path.join(app.getAppPath(), "dist-electron/assets"),
    path.join(app.getAppPath(), "electron/assets"),
    path.join(app.getAppPath(), "build"),
    path.join(process.cwd(), "electron/assets"),
    path.join(process.cwd(), "apps/desktop/electron/assets"),
  ];

  for (const dir of candidateDirs) {
    const primary = path.join(dir, `tray-icon${preferredExt}`);
    if (fs.existsSync(primary)) return primary;
    const secondary = path.join(dir, `tray-icon${secondaryExt}`);
    if (fs.existsSync(secondary)) return secondary;
    const fallbackIco = path.join(dir, "icon.ico");
    if (fs.existsSync(fallbackIco)) return fallbackIco;
  }

  return null;
}

export function initTray(
  win: BrowserWindow,
  callbacks?: {
    onSyncNow?: () => void;
    onOpenCompose?: () => void;
  }
): Tray {
  if (tray) return tray;

  const iconPath = getTrayIconPath();
  let iconImage: NativeImage | string;

  if (iconPath) {
    if (process.platform === "win32") {
      // On Windows, passing file path directly to Tray or nativeImage ensures high-fidelity HICON rendering
      iconImage = nativeImage.createFromPath(iconPath);
    } else {
      iconImage = nativeImage.createFromPath(iconPath).resize({ width: 18, height: 18 });
    }
  } else {
    iconImage = createFallbackTrayIcon();
  }

  tray = new Tray(iconImage);
  tray.setToolTip("oh-my-email");

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
