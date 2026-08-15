import { app } from "electron";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import type { AccountRecord, AttachmentMeta, FolderRecord, MessageRecord } from "./mail/types";

const require = createRequire(import.meta.url);

// sql.js types are loose; keep local aliases for the subset we use.
type SqlJsDatabase = {
  run: (sql: string, params?: unknown[]) => void;
  prepare: (sql: string) => {
    bind: (params: unknown[]) => void;
    step: () => boolean;
    getAsObject: () => Record<string, unknown>;
    free: () => void;
  };
  export: () => Uint8Array;
};

type SqlJsStatic = {
  Database: new (data?: ArrayLike<number> | Buffer | null) => SqlJsDatabase;
};

let SQL: SqlJsStatic | null = null;
let db: SqlJsDatabase | null = null;
let dbPath = "";

function ensureDir(p: string) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
}

export async function initDb(): Promise<void> {
  if (db) return;
  const initSqlJs = require("sql.js") as (cfg?: {
    locateFile?: (file: string) => string;
  }) => Promise<SqlJsStatic>;
  // main is dist/sql-wasm.js — wasm lives next to it (exports block package.json resolve)
  const wasmDir = path.dirname(require.resolve("sql.js"));
  SQL = await initSqlJs({
    locateFile: (file: string) => path.join(wasmDir, file),
  });
  dbPath = path.join(app.getPath("userData"), "mail.sqlite");
  ensureDir(dbPath);
  if (fs.existsSync(dbPath)) {
    const buf = fs.readFileSync(dbPath);
    db = new SQL.Database(buf);
  } else {
    db = new SQL.Database();
  }
  migrate();
  persist();
}

function migrate() {
  const d = getDb();
  d.run(`
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      display_name TEXT,
      provider_id TEXT,
      imap_host TEXT NOT NULL,
      imap_port INTEGER NOT NULL,
      imap_tls TEXT NOT NULL,
      smtp_host TEXT NOT NULL,
      smtp_port INTEGER NOT NULL,
      smtp_tls TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);
  d.run(`
    CREATE TABLE IF NOT EXISTS folders (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      remote_path TEXT NOT NULL,
      role TEXT NOT NULL,
      name TEXT NOT NULL,
      unread INTEGER NOT NULL DEFAULT 0,
      UNIQUE(account_id, remote_path)
    );
  `);
  d.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      folder_id TEXT NOT NULL,
      uid INTEGER NOT NULL,
      from_addr TEXT NOT NULL,
      from_name TEXT NOT NULL,
      subject TEXT NOT NULL,
      snippet TEXT NOT NULL,
      date_ms INTEGER NOT NULL,
      date_label TEXT NOT NULL,
      unread INTEGER NOT NULL DEFAULT 1,
      split TEXT NOT NULL DEFAULT 'other',
      html TEXT,
      UNIQUE(account_id, folder_id, uid)
    );
  `);
  d.run(`CREATE INDEX IF NOT EXISTS idx_messages_folder ON messages(account_id, folder_id, date_ms DESC);`);
  d.run(`
    CREATE TABLE IF NOT EXISTS attachments (
      id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      content_type TEXT NOT NULL,
      size INTEGER NOT NULL DEFAULT 0,
      storage_path TEXT NOT NULL,
      sort_index INTEGER NOT NULL DEFAULT 0
    );
  `);
  d.run(`CREATE INDEX IF NOT EXISTS idx_attachments_message ON attachments(message_id);`);
}

function getDb(): SqlJsDatabase {
  if (!db) throw new Error("Database not initialized");
  return db;
}

export function persist() {
  if (!db || !dbPath) return;
  const data = db.export();
  ensureDir(dbPath);
  fs.writeFileSync(dbPath, Buffer.from(data));
}

function rowsFrom(stmt: ReturnType<SqlJsDatabase["prepare"]>): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  while (stmt.step()) out.push(stmt.getAsObject());
  stmt.free();
  return out;
}

export function listAccounts(): AccountRecord[] {
  const d = getDb();
  const stmt = d.prepare(`SELECT * FROM accounts ORDER BY created_at ASC`);
  return rowsFrom(stmt).map(mapAccount);
}

export function getAccount(id: string): AccountRecord | null {
  const d = getDb();
  const stmt = d.prepare(`SELECT * FROM accounts WHERE id = ?`);
  stmt.bind([id]);
  const rows = rowsFrom(stmt);
  return rows[0] ? mapAccount(rows[0]) : null;
}

export function upsertAccount(a: AccountRecord) {
  const d = getDb();
  d.run(
    `INSERT INTO accounts (id, email, display_name, provider_id, imap_host, imap_port, imap_tls, smtp_host, smtp_port, smtp_tls, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       email=excluded.email,
       display_name=excluded.display_name,
       provider_id=excluded.provider_id,
       imap_host=excluded.imap_host,
       imap_port=excluded.imap_port,
       imap_tls=excluded.imap_tls,
       smtp_host=excluded.smtp_host,
       smtp_port=excluded.smtp_port,
       smtp_tls=excluded.smtp_tls`,
    [
      a.id,
      a.email,
      a.displayName ?? null,
      a.providerId ?? null,
      a.imapHost,
      a.imapPort,
      a.imapTls,
      a.smtpHost,
      a.smtpPort,
      a.smtpTls,
      a.createdAt,
    ],
  );
  persist();
}

export function deleteAccount(id: string) {
  const d = getDb();
  // Drop attachment files for this account's messages
  const stmt = d.prepare(`SELECT id FROM messages WHERE account_id = ?`);
  stmt.bind([id]);
  for (const row of rowsFrom(stmt)) {
    deleteAttachmentsForMessage(String(row.id));
  }
  d.run(`DELETE FROM messages WHERE account_id = ?`, [id]);
  d.run(`DELETE FROM folders WHERE account_id = ?`, [id]);
  d.run(`DELETE FROM accounts WHERE id = ?`, [id]);
  persist();
}

export function attachmentsDir(messageId: string): string {
  return path.join(app.getPath("userData"), "mail-attachments", messageId.replace(/[^\w.-]+/g, "_"));
}

export function listAttachments(messageId: string): AttachmentMeta[] {
  const d = getDb();
  const stmt = d.prepare(
    `SELECT * FROM attachments WHERE message_id = ? ORDER BY sort_index ASC, filename ASC`,
  );
  stmt.bind([messageId]);
  return rowsFrom(stmt).map(mapAttachment);
}

export function getAttachment(id: string): AttachmentMeta | null {
  const d = getDb();
  const stmt = d.prepare(`SELECT * FROM attachments WHERE id = ?`);
  stmt.bind([id]);
  const rows = rowsFrom(stmt);
  return rows[0] ? mapAttachment(rows[0]) : null;
}

export function deleteAttachmentsForMessage(messageId: string) {
  const existing = listAttachments(messageId);
  for (const a of existing) {
    try {
      if (a.storagePath && fs.existsSync(a.storagePath)) fs.unlinkSync(a.storagePath);
    } catch {
      /* ignore */
    }
  }
  const dir = attachmentsDir(messageId);
  try {
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
  const d = getDb();
  d.run(`DELETE FROM attachments WHERE message_id = ?`, [messageId]);
}

/** Replace DB rows only — caller must already have files on disk. */
export function replaceAttachments(messageId: string, items: AttachmentMeta[]) {
  const d = getDb();
  d.run(`DELETE FROM attachments WHERE message_id = ?`, [messageId]);
  items.forEach((a, i) => {
    d.run(
      `INSERT INTO attachments (id, message_id, filename, content_type, size, storage_path, sort_index)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [a.id, messageId, a.filename, a.contentType, a.size, a.storagePath, i],
    );
  });
}

export function withAttachments(m: MessageRecord): MessageRecord {
  return { ...m, attachments: listAttachments(m.id) };
}

function mapAttachment(r: Record<string, unknown>): AttachmentMeta {
  return {
    id: String(r.id),
    messageId: String(r.message_id),
    filename: String(r.filename),
    contentType: String(r.content_type || "application/octet-stream"),
    size: Number(r.size) || 0,
    storagePath: String(r.storage_path || ""),
  };
}

export function listFolders(accountId: string): FolderRecord[] {
  const d = getDb();
  const stmt = d.prepare(`SELECT * FROM folders WHERE account_id = ? ORDER BY name ASC`);
  stmt.bind([accountId]);
  return rowsFrom(stmt).map(mapFolder);
}

export function upsertFolder(f: FolderRecord) {
  const d = getDb();
  d.run(
    `INSERT INTO folders (id, account_id, remote_path, role, name, unread)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       remote_path=excluded.remote_path,
       role=excluded.role,
       name=excluded.name,
       unread=excluded.unread`,
    [f.id, f.accountId, f.remotePath, f.role, f.name, f.unread],
  );
}

export function listMessages(accountId: string, folderId: string): MessageRecord[] {
  const d = getDb();
  const stmt = d.prepare(
    `SELECT * FROM messages WHERE account_id = ? AND folder_id = ? ORDER BY date_ms DESC LIMIT 200`,
  );
  stmt.bind([accountId, folderId]);
  return rowsFrom(stmt).map(mapMessage);
}

export function listAllMessages(accountId: string): MessageRecord[] {
  const d = getDb();
  const stmt = d.prepare(
    `SELECT * FROM messages WHERE account_id = ? ORDER BY date_ms DESC LIMIT 500`,
  );
  stmt.bind([accountId]);
  return rowsFrom(stmt).map((r) => withAttachments(mapMessage(r)));
}

export function getMessage(id: string): MessageRecord | null {
  const d = getDb();
  const stmt = d.prepare(`SELECT * FROM messages WHERE id = ?`);
  stmt.bind([id]);
  const rows = rowsFrom(stmt);
  return rows[0] ? withAttachments(mapMessage(rows[0])) : null;
}

export function upsertMessage(m: MessageRecord) {
  const d = getDb();
  d.run(
    `INSERT INTO messages (
      id, account_id, folder_id, uid, from_addr, from_name, subject, snippet,
      date_ms, date_label, unread, split, html
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      from_addr=excluded.from_addr,
      from_name=excluded.from_name,
      subject=excluded.subject,
      snippet=excluded.snippet,
      date_ms=excluded.date_ms,
      date_label=excluded.date_label,
      unread=excluded.unread,
      split=excluded.split,
      html=COALESCE(excluded.html, messages.html)`,
    [
      m.id,
      m.accountId,
      m.folderId,
      m.uid,
      m.from,
      m.fromName,
      m.subject,
      m.snippet,
      m.dateMs,
      m.dateLabel,
      m.unread ? 1 : 0,
      m.split,
      m.html ?? null,
    ],
  );
}

export function setMessageUnread(id: string, unread: boolean) {
  const d = getDb();
  d.run(`UPDATE messages SET unread = ? WHERE id = ?`, [unread ? 1 : 0, id]);
  persist();
}

export function setMessageSplit(id: string, split: "important" | "other") {
  const d = getDb();
  d.run(`UPDATE messages SET split = ? WHERE id = ?`, [split, id]);
  persist();
}

export function setMessageHtml(id: string, html: string) {
  const d = getDb();
  d.run(`UPDATE messages SET html = ? WHERE id = ?`, [html, id]);
  persist();
}

export function deleteMessage(id: string) {
  deleteAttachmentsForMessage(id);
  const d = getDb();
  d.run(`DELETE FROM messages WHERE id = ?`, [id]);
  persist();
}

export function recomputeFolderUnread(accountId: string, folderId: string) {
  const d = getDb();
  const stmt = d.prepare(
    `SELECT COUNT(*) AS c FROM messages WHERE account_id = ? AND folder_id = ? AND unread = 1`,
  );
  stmt.bind([accountId, folderId]);
  const row = rowsFrom(stmt)[0];
  const count = Number(row?.c ?? 0);
  d.run(`UPDATE folders SET unread = ? WHERE id = ?`, [count, folderId]);
}

function mapAccount(r: Record<string, unknown>): AccountRecord {
  return {
    id: String(r.id),
    email: String(r.email),
    displayName: r.display_name != null ? String(r.display_name) : undefined,
    providerId: r.provider_id != null ? String(r.provider_id) : undefined,
    imapHost: String(r.imap_host),
    imapPort: Number(r.imap_port),
    imapTls: String(r.imap_tls) as AccountRecord["imapTls"],
    smtpHost: String(r.smtp_host),
    smtpPort: Number(r.smtp_port),
    smtpTls: String(r.smtp_tls) as AccountRecord["smtpTls"],
    createdAt: Number(r.created_at),
  };
}

function mapFolder(r: Record<string, unknown>): FolderRecord {
  return {
    id: String(r.id),
    accountId: String(r.account_id),
    remotePath: String(r.remote_path),
    role: String(r.role) as FolderRecord["role"],
    name: String(r.name),
    unread: Number(r.unread),
  };
}

function mapMessage(r: Record<string, unknown>): MessageRecord {
  return {
    id: String(r.id),
    accountId: String(r.account_id),
    folderId: String(r.folder_id),
    uid: Number(r.uid),
    from: String(r.from_addr),
    fromName: String(r.from_name),
    subject: String(r.subject),
    snippet: String(r.snippet),
    dateMs: Number(r.date_ms),
    dateLabel: String(r.date_label),
    unread: Number(r.unread) === 1,
    split: (String(r.split) === "important" ? "important" : "other") as "important" | "other",
    html: r.html != null ? String(r.html) : undefined,
  };
}
