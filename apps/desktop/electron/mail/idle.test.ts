import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { IdleAccountWorker, idleManager } from "./idle";
import type { AccountRecord } from "./types";
import type { BrowserWindow } from "electron";

// Mock dependencies
const mockGetAccount = vi.fn();
const mockListAccounts = vi.fn();
const mockLoadSecret = vi.fn();
const mockSyncAccount = vi.fn();
const mockCreateClient = vi.fn();

vi.mock("../db", () => ({
  getAccount: (id: string) => mockGetAccount(id),
  listAccounts: () => mockListAccounts(),
}));

vi.mock("../store", () => ({
  loadSecret: (k: string) => mockLoadSecret(k),
}));

vi.mock("./sync", () => ({
  syncAccount: (id: string, limit: number) => mockSyncAccount(id, limit),
}));

vi.mock("./imap", () => ({
  createClient: (input: unknown) => mockCreateClient(input),
  passwordKey: (id: string) => `acct:${id}:pass`,
}));

describe("IdleAccountWorker and IdleManager (IMAP IDLE Push)", () => {
  let mockClient: any;
  let listeners: Record<string, Function>;

  beforeEach(() => {
    vi.clearAllMocks();
    listeners = {};

    mockClient = {
      on: vi.fn((event: string, cb: Function) => {
        listeners[event] = cb;
      }),
      connect: vi.fn().mockResolvedValue(undefined),
      getMailboxLock: vi.fn().mockResolvedValue({
        release: vi.fn(),
      }),
      idle: vi.fn().mockResolvedValue(undefined),
      noop: vi.fn().mockResolvedValue(undefined),
      logout: vi.fn().mockResolvedValue(undefined),
      close: vi.fn(),
    };

    mockCreateClient.mockReturnValue(mockClient);

    const testAccount: AccountRecord = {
      id: "acc-1",
      email: "user@example.com",
      displayName: "User",
      imapHost: "imap.example.com",
      imapPort: 993,
      imapTls: "ssl",
      smtpHost: "smtp.example.com",
      smtpPort: 465,
      smtpTls: "ssl",
      createdAt: 1000,
    };

    mockGetAccount.mockImplementation((id: string) => (id === "acc-1" ? testAccount : null));
    mockListAccounts.mockReturnValue([testAccount]);
    mockLoadSecret.mockReturnValue("secret_pass");
    mockSyncAccount.mockResolvedValue({ accountId: "acc-1", folders: 1, messages: 2 });
  });

  afterEach(async () => {
    await idleManager.stop();
  });

  it("starts IdleAccountWorker, connects, locks INBOX and enters IDLE", async () => {
    const mockSend = vi.fn();
    const mockWin = {
      isDestroyed: () => false,
      webContents: { send: mockSend },
    } as unknown as BrowserWindow;

    const worker = new IdleAccountWorker("acc-1", () => mockWin);
    await worker.start();

    expect(mockCreateClient).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "secret_pass",
      imapHost: "imap.example.com",
      imapPort: 993,
      imapTls: "ssl",
    });

    expect(mockClient.connect).toHaveBeenCalled();
    expect(mockClient.getMailboxLock).toHaveBeenCalledWith("INBOX");
    expect(mockClient.idle).toHaveBeenCalled();

    const status = worker.getStatus();
    expect(status.status).toBe("idle");
    expect(status.email).toBe("user@example.com");

    await worker.stop();
    expect(mockClient.logout).toHaveBeenCalled();
    expect(worker.getStatus().status).toBe("stopped");
  });

  it("handles exists push event, triggers incremental sync and notifies renderer", async () => {
    const mockSend = vi.fn();
    const mockWin = {
      isDestroyed: () => false,
      webContents: { send: mockSend },
    } as unknown as BrowserWindow;

    const worker = new IdleAccountWorker("acc-1", () => mockWin);
    await worker.start();

    expect(listeners["exists"]).toBeDefined();

    // Simulate server pushing an 'exists' event (new email arrived!)
    await listeners["exists"]({ count: 50 });

    expect(mockSyncAccount).toHaveBeenCalledWith("acc-1", 15);
    expect(mockSend).toHaveBeenCalledWith("mail:pushed", {
      accountId: "acc-1",
      eventType: "exists",
      count: 50,
      messagesSynced: 2,
    });

    const status = worker.getStatus();
    expect(status.lastEventAt).toBeDefined();

    await worker.stop();
  });

  it("IdleManager manages all active account workers", async () => {
    const mockSend = vi.fn();
    const mockWin = {
      isDestroyed: () => false,
      webContents: { send: mockSend },
    } as unknown as BrowserWindow;

    await idleManager.start(mockWin);

    const statuses = idleManager.getStatuses();
    expect(statuses.length).toBe(1);
    expect(statuses[0]?.accountId).toBe("acc-1");

    await idleManager.stop();
    expect(idleManager.getStatuses().length).toBe(0);
  });
});
