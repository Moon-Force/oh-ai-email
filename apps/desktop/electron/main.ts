import { app, BrowserWindow } from "electron";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { registerIpc } from "./ipc";
import { destroyTray, initTray } from "./tray";
import { startIdleManager, stopIdleManager } from "./mail/idle";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mainWindow: BrowserWindow | null = null;
(app as unknown as { isQuitting: boolean }).isQuitting = false;

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: "#E4E9F2",
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    title: "oh-ai-email",
    show: false,
  });

  mainWindow = win;

  win.once("ready-to-show", () => win.show());

  win.on("close", (event) => {
    if (!(app as unknown as { isQuitting: boolean }).isQuitting) {
      event.preventDefault();
      win.hide();
    }
  });

  win.webContents.on("did-fail-load", (_e, errorCode, errorDescription) => {
    console.warn(`[main] did-fail-load: ${errorCode} - ${errorDescription}`);
    if (process.env.VITE_DEV_SERVER_URL) {
      setTimeout(() => {
        if (!win.isDestroyed()) {
          win.loadURL(process.env.VITE_DEV_SERVER_URL!);
        }
      }, 1000);
    }
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    const indexPath = path.join(__dirname, "../dist/index.html");
    if (fs.existsSync(indexPath)) {
      win.loadFile(indexPath);
    } else {
      console.error("[main] dist/index.html not found, please run build first");
    }
  }

  initTray(win, {
    onSyncNow: () => {
      win.webContents.send("mail:trigger-sync");
    },
    onOpenCompose: () => {
      win.webContents.send("mail:open-compose");
    },
  });

  void startIdleManager(win);
}

app.whenReady().then(async () => {
  try {
    await registerIpc();
  } catch (err) {
    console.error("[main] failed to init mail backend", err);
  }
  createWindow();
});

app.on("before-quit", () => {
  (app as unknown as { isQuitting: boolean }).isQuitting = true;
  void stopIdleManager();
  destroyTray();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  } else if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
  }
});

if (process.platform === "win32") app.setAppUserModelId("com.oh-ai-email.desktop");
