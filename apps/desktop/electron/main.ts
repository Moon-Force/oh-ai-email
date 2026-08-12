import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadSecret, saveSecret } from "./store";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

  win.once("ready-to-show", () => win.show());

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

ipcMain.handle("ping", () => "pong");
ipcMain.handle("secret:save", (_e, key: string, value: string) => {
  saveSecret(key, value);
  return true;
});
ipcMain.handle("secret:load", (_e, key: string) => loadSecret(key));

app.whenReady().then(createWindow);
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

if (process.platform === "win32") app.setAppUserModelId("com.oh-ai-email.desktop");
