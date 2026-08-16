import { BrowserWindow } from "electron";
import type { ImapFlow } from "imapflow";
import { getAccount, listAccounts } from "../db";
import { loadSecret } from "../store";
import { createClient, passwordKey } from "./imap";
import { syncAccount } from "./sync";
import type { AccountRecord } from "./types";

export type IdleConnectionStatus = "idle" | "connecting" | "syncing" | "error" | "stopped";

export interface IdleWorkerState {
  accountId: string;
  email: string;
  status: IdleConnectionStatus;
  lastEventAt?: number;
  error?: string;
}

export class IdleAccountWorker {
  private client: ImapFlow | null = null;
  private running = false;
  private keepaliveTimer: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private status: IdleConnectionStatus = "stopped";
  private lastError: string | null = null;
  private lastEventAt: number | null = null;

  constructor(
    public readonly accountId: string,
    private getMainWindow: () => BrowserWindow | null,
  ) {}

  public getStatus(): IdleWorkerState {
    const acc = getAccount(this.accountId);
    return {
      accountId: this.accountId,
      email: acc?.email || this.accountId,
      status: this.status,
      lastEventAt: this.lastEventAt ?? undefined,
      error: this.lastError ?? undefined,
    };
  }

  public async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.reconnectAttempts = 0;
    await this.connectAndIdle();
  }

  public async stop(): Promise<void> {
    this.running = false;
    this.clearTimers();
    this.status = "stopped";
    if (this.client) {
      try {
        await this.client.logout();
      } catch {
        try {
          this.client.close();
        } catch {
          // ignore
        }
      }
      this.client = null;
    }
  }

  private clearTimers() {
    if (this.keepaliveTimer) {
      clearInterval(this.keepaliveTimer);
      this.keepaliveTimer = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private async connectAndIdle(): Promise<void> {
    if (!this.running) return;
    this.clearTimers();

    const account = getAccount(this.accountId);
    if (!account) {
      this.status = "error";
      this.lastError = "账号不存在";
      return;
    }

    const password = loadSecret(passwordKey(this.accountId));
    if (!password) {
      this.status = "error";
      this.lastError = "未找到保存的密码或授权码";
      return;
    }

    this.status = "connecting";
    this.lastError = null;

    try {
      const client = createClient({
        email: account.email,
        password,
        imapHost: account.imapHost,
        imapPort: account.imapPort,
        imapTls: account.imapTls,
      });

      this.client = client;

      client.on("close", () => {
        if (this.running) {
          this.scheduleReconnect("连接已断开");
        }
      });

      client.on("error", (err: Error) => {
        console.warn(`[idle:${account.email}] IMAP error`, err.message);
        if (this.running) {
          this.scheduleReconnect(err.message);
        }
      });

      client.on("exists", async (data: { count: number; prevCount?: number }) => {
        this.lastEventAt = Date.now();
        console.info(`[idle:${account.email}] New mail exists event, total count: ${data.count}`);
        await this.handlePushEvent(account, "exists", data.count);
      });

      (client as unknown as { on: (event: string, cb: Function) => void }).on(
        "expunge",
        async (data: { seq: number }) => {
          this.lastEventAt = Date.now();
          await this.handlePushEvent(account, "expunge", data?.seq);
        },
      );

      (client as unknown as { on: (event: string, cb: Function) => void }).on("flags", async () => {
        this.lastEventAt = Date.now();
        await this.handlePushEvent(account, "flags");
      });

      await client.connect();

      // Lock/select INBOX
      const lock = await client.getMailboxLock("INBOX");
      try {
        this.status = "idle";
        this.reconnectAttempts = 0;
        console.info(`[idle:${account.email}] Entered IMAP IDLE on INBOX`);

        // Setup keepalive NOOP every 14 minutes (RFC recommends < 29 min)
        this.keepaliveTimer = setInterval(async () => {
          if (this.client && this.running && this.status === "idle") {
            try {
              await this.client.noop();
            } catch (noopErr) {
              console.warn(`[idle:${account.email}] Keepalive NOOP failed`, noopErr);
              this.scheduleReconnect("保活心跳失败");
            }
          }
        }, 14 * 60 * 1000);

        // Keep IDLE loop running until stopped
        await client.idle();
      } finally {
        lock.release();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[idle:${account.email}] Failed to connect/idle: ${msg}`);
      this.scheduleReconnect(msg);
    }
  }

  private scheduleReconnect(reason: string) {
    if (!this.running) return;
    this.status = "error";
    this.lastError = reason;
    this.clearTimers();

    if (this.client) {
      try {
        this.client.close();
      } catch {
        // ignore
      }
      this.client = null;
    }

    this.reconnectAttempts += 1;
    // Exponential backoff: 5s, 10s, 20s, max 60s
    const delay = Math.min(5000 * Math.pow(2, Math.min(this.reconnectAttempts - 1, 4)), 60000);
    console.info(`[idle:${this.accountId}] Reconnecting in ${(delay / 1000).toFixed(0)}s (attempt ${this.reconnectAttempts})...`);

    this.reconnectTimer = setTimeout(() => {
      void this.connectAndIdle();
    }, delay);
  }

  private async handlePushEvent(account: AccountRecord, eventType: string, countOrSeq?: number) {
    try {
      // Incremental sync of the latest messages
      const syncResult = await syncAccount(account.id, 15);
      console.info(`[idle:${account.email}] Incremental sync on push completed, synced ${syncResult.messages} messages`);

      // Notify renderer window for instant UI refresh
      const win = this.getMainWindow();
      if (win && !win.isDestroyed()) {
        win.webContents.send("mail:pushed", {
          accountId: account.id,
          eventType,
          count: countOrSeq,
          messagesSynced: syncResult.messages,
        });
      }
    } catch (err) {
      console.warn(`[idle:${account.email}] Error handling push sync`, err);
    }
  }
}

class IdleManager {
  private workers = new Map<string, IdleAccountWorker>();
  private mainWindow: BrowserWindow | null = null;
  private started = false;

  public setMainWindow(win: BrowserWindow | null) {
    this.mainWindow = win;
  }

  public async start(win?: BrowserWindow | null): Promise<void> {
    if (win !== undefined) {
      this.mainWindow = win;
    }
    this.started = true;
    await this.refresh();
  }

  public async stop(): Promise<void> {
    this.started = false;
    const currentWorkers = Array.from(this.workers.values());
    this.workers.clear();
    await Promise.all(currentWorkers.map((w) => w.stop()));
    console.info("[IdleManager] All IMAP IDLE push workers stopped.");
  }

  public async refresh(): Promise<void> {
    if (!this.started) return;
    const accounts = listAccounts();
    const activeIds = new Set(accounts.map((a) => a.id));

    // Remove obsolete workers
    for (const [id, worker] of this.workers.entries()) {
      if (!activeIds.has(id)) {
        void worker.stop();
        this.workers.delete(id);
      }
    }

    // Add / ensure workers for existing accounts
    for (const account of accounts) {
      if (!this.workers.has(account.id)) {
        const worker = new IdleAccountWorker(account.id, () => this.mainWindow);
        this.workers.set(account.id, worker);
        void worker.start();
      }
    }
  }

  public getStatuses(): IdleWorkerState[] {
    return Array.from(this.workers.values()).map((w) => w.getStatus());
  }
}

export const idleManager = new IdleManager();

export async function startIdleManager(win?: BrowserWindow | null): Promise<void> {
  await idleManager.start(win);
}

export async function stopIdleManager(): Promise<void> {
  await idleManager.stop();
}

export async function refreshIdleAccounts(): Promise<void> {
  await idleManager.refresh();
}

export function getIdleStatuses(): IdleWorkerState[] {
  return idleManager.getStatuses();
}
