import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("api", {
  ping: (): Promise<string> => ipcRenderer.invoke("ping"),
  secretSave: (k: string, v: string) => ipcRenderer.invoke("secret:save", k, v),
  secretLoad: (k: string) => ipcRenderer.invoke("secret:load", k),
});

declare global {
  interface Window {
    api: {
      ping: () => Promise<string>;
      secretSave: (k: string, v: string) => Promise<boolean>;
      secretLoad: (k: string) => Promise<string | null>;
    };
  }
}
