import "@testing-library/jest-dom";
import { vi } from "vitest";

// jsdom lacks ResizeObserver (used by NavStack liquid indicator)
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

// Global Electron Mock for Node/Vitest test environment
vi.mock("electron", () => {
  return {
    app: {
      isPackaged: false,
      getVersion: vi.fn(() => "0.1.0"),
      getPath: vi.fn((name: string) => `/mock/path/${name}`),
      getName: vi.fn(() => "oh-ai-email"),
      on: vi.fn(),
      whenReady: vi.fn().mockResolvedValue(undefined),
    },
    ipcMain: {
      handle: vi.fn(),
      on: vi.fn(),
      removeHandler: vi.fn(),
    },
    ipcRenderer: {
      invoke: vi.fn(),
      on: vi.fn(),
      send: vi.fn(),
      removeListener: vi.fn(),
    },
    safeStorage: {
      isEncryptionAvailable: vi.fn(() => true),
      encryptString: vi.fn((str: string) => Buffer.from(str)),
      decryptString: vi.fn((buf: Buffer) => buf.toString("utf-8")),
    },
    net: {
      fetch: vi.fn(),
    },
    dialog: {
      showOpenDialog: vi.fn(),
      showMessageBox: vi.fn(),
    },
    shell: {
      openExternal: vi.fn(),
    },
    BrowserWindow: class {
      loadURL() {}
      loadFile() {}
      on() {}
      webContents = {
        send: vi.fn(),
        on: vi.fn(),
      };
    },
  };
});
