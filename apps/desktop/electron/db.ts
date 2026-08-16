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
      snoozed_until INTEGER DEFAULT NULL,
      is_pinned INTEGER NOT NULL DEFAULT 0,
      is_muted INTEGER NOT NULL DEFAULT 0,
      UNIQUE(account_id, folder_id, uid)
    );
  `);

  // Incremental schema migration for existing databases MUST run before creating index on new columns
  try {
    const cols = rowsFrom(d.prepare(`PRAGMA table_info(messages)`)).map((c) => String(c.name));
    if (!cols.includes("snoozed_until")) {
      try {
        d.run(`ALTER TABLE messages ADD COLUMN snoozed_until INTEGER DEFAULT NULL`);
      } catch {
        // ignore if already added
      }
    }
    if (!cols.includes("is_pinned")) {
      try {
        d.run(`ALTER TABLE messages ADD COLUMN is_pinned INTEGER NOT NULL DEFAULT 0`);
      } catch {
        // ignore if already added
      }
    }
    if (!cols.includes("is_muted")) {
      try {
        d.run(`ALTER TABLE messages ADD COLUMN is_muted INTEGER NOT NULL DEFAULT 0`);
      } catch {
        // ignore if already added
      }
    }
  } catch {
    // fallback attempt if PRAGMA table_info fails
    try {
      d.run(`ALTER TABLE messages ADD COLUMN snoozed_until INTEGER DEFAULT NULL`);
    } catch {}
    try {
      d.run(`ALTER TABLE messages ADD COLUMN is_pinned INTEGER NOT NULL DEFAULT 0`);
    } catch {}
    try {
      d.run(`ALTER TABLE messages ADD COLUMN is_muted INTEGER NOT NULL DEFAULT 0`);
    } catch {}
  }

  d.run(
    `CREATE INDEX IF NOT EXISTS idx_messages_folder ON messages(account_id, folder_id, date_ms DESC);`
  );
  d.run(`CREATE INDEX IF NOT EXISTS idx_messages_snooze ON messages(snoozed_until);`);

  d.run(`
    CREATE TABLE IF NOT EXISTS agent_sessions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      skill_id TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      compacted_summary TEXT
    );
  `);

  d.run(`
    CREATE TABLE IF NOT EXISTS agent_messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      thinking_content TEXT,
      tool_calls TEXT,
      proposals TEXT,
      created_at INTEGER NOT NULL
    );
  `);
  d.run(`CREATE INDEX IF NOT EXISTS idx_agent_messages_session ON agent_messages(session_id, created_at ASC);`);

  d.run(`
    CREATE TABLE IF NOT EXISTS drafts (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      to_addr TEXT NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      reply_to_message_id TEXT,
      updated_at INTEGER NOT NULL
    );
  `);

  d.run(`
    CREATE TABLE IF NOT EXISTS custom_skills (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      allowed_tools TEXT NOT NULL,
      system_prompt TEXT NOT NULL,
      tags TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

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
    ]
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
  return path.join(
    app.getPath("userData"),
    "mail-attachments",
    messageId.replace(/[^\w.-]+/g, "_")
  );
}

export function listAttachments(messageId: string): AttachmentMeta[] {
  const d = getDb();
  const stmt = d.prepare(
    `SELECT * FROM attachments WHERE message_id = ? ORDER BY sort_index ASC, filename ASC`
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
      [a.id, messageId, a.filename, a.contentType, a.size, a.storagePath, i]
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
    [f.id, f.accountId, f.remotePath, f.role, f.name, f.unread]
  );
}

export function listMessages(accountId: string, folderId: string): MessageRecord[] {
  const d = getDb();
  const stmt = d.prepare(
    `SELECT * FROM messages WHERE account_id = ? AND folder_id = ? ORDER BY date_ms DESC LIMIT 200`
  );
  stmt.bind([accountId, folderId]);
  return rowsFrom(stmt).map(mapMessage);
}

export function listAllMessages(accountId: string): MessageRecord[] {
  const d = getDb();
  const stmt = d.prepare(
    `SELECT * FROM messages WHERE account_id = ? ORDER BY date_ms DESC LIMIT 500`
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
      date_ms, date_label, unread, split, html, snoozed_until, is_pinned, is_muted
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      from_addr=excluded.from_addr,
      from_name=excluded.from_name,
      subject=excluded.subject,
      snippet=excluded.snippet,
      date_ms=excluded.date_ms,
      date_label=excluded.date_label,
      unread=excluded.unread,
      split=excluded.split,
      html=COALESCE(excluded.html, messages.html),
      snoozed_until=COALESCE(messages.snoozed_until, excluded.snoozed_until),
      is_pinned=COALESCE(messages.is_pinned, excluded.is_pinned),
      is_muted=COALESCE(messages.is_muted, excluded.is_muted)`,
    [
      m.id,
      m.accountId,
      m.folderId || "inbox",
      m.uid ?? 0,
      m.from,
      m.fromName ?? "",
      m.subject,
      m.snippet ?? "",
      m.dateMs ?? Date.now(),
      m.dateLabel ?? new Date(m.dateMs || Date.now()).toLocaleDateString(),
      m.unread ? 1 : 0,
      m.split || "other",
      m.html ?? null,
      m.snoozedUntil ?? null,
      m.isPinned ? 1 : 0,
      m.isMuted ? 1 : 0,
    ]
  );
}

export function searchMessagesFts(query: string, accountId?: string): MessageRecord[] {
  const d = getDb();
  const pattern = `%${query.trim()}%`;
  const stmt = accountId
    ? d.prepare(`SELECT * FROM messages WHERE account_id = ? AND (subject LIKE ? OR snippet LIKE ? OR from_addr LIKE ? OR from_name LIKE ?) ORDER BY date_ms DESC;`)
    : d.prepare(`SELECT * FROM messages WHERE subject LIKE ? OR snippet LIKE ? OR from_addr LIKE ? OR from_name LIKE ? ORDER BY date_ms DESC;`);
  if (accountId) {
    stmt.bind([accountId, pattern, pattern, pattern, pattern]);
  } else {
    stmt.bind([pattern, pattern, pattern, pattern]);
  }
  return rowsFrom(stmt).map(mapMessage);
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

export function setMessageSnooze(id: string, untilMs: number | null) {
  const d = getDb();
  d.run(`UPDATE messages SET snoozed_until = ? WHERE id = ?`, [untilMs ?? null, id]);
  persist();
}

export function setMessagePinned(id: string, isPinned: boolean) {
  const d = getDb();
  d.run(`UPDATE messages SET is_pinned = ? WHERE id = ?`, [isPinned ? 1 : 0, id]);
  persist();
}

export function setMessageMuted(id: string, isMuted: boolean) {
  const d = getDb();
  d.run(`UPDATE messages SET is_muted = ? WHERE id = ?`, [isMuted ? 1 : 0, id]);
  persist();
}

export function checkAndWakeSnoozedMessages(): MessageRecord[] {
  const d = getDb();
  const now = Date.now();
  const stmt = d.prepare(
    `SELECT * FROM messages WHERE snoozed_until IS NOT NULL AND snoozed_until <= ?`
  );
  stmt.bind([now]);
  const rows = rowsFrom(stmt);
  if (rows.length === 0) return [];
  const list = rows.map((r) => withAttachments(mapMessage(r)));
  d.run(
    `UPDATE messages SET snoozed_until = NULL WHERE snoozed_until IS NOT NULL AND snoozed_until <= ?`,
    [now]
  );
  persist();
  return list;
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
    `SELECT COUNT(*) AS c FROM messages WHERE account_id = ? AND folder_id = ? AND unread = 1`
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
    snoozedUntil: r.snoozed_until != null ? Number(r.snoozed_until) : null,
    isPinned: Number(r.is_pinned) === 1,
    isMuted: Number(r.is_muted) === 1,
  };
}

export interface AgentSessionRecord {
  id: string;
  title: string;
  skillId?: string;
  createdAt: number;
  updatedAt: number;
  compactedSummary?: string;
}

export interface AgentMessageDbRecord {
  id: string;
  sessionId: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  thinkingContent?: string;
  toolCalls?: string;
  proposals?: string;
  createdAt: number;
}

export function createAgentSession(session: AgentSessionRecord): void {
  const d = getDb();
  d.run(
    `INSERT OR REPLACE INTO agent_sessions (id, title, skill_id, created_at, updated_at, compacted_summary)
     VALUES (?, ?, ?, ?, ?, ?);`,
    [
      session.id,
      session.title,
      session.skillId ?? null,
      session.createdAt,
      session.updatedAt,
      session.compactedSummary ?? null,
    ]
  );
  persist();
}

export function listAgentSessions(): AgentSessionRecord[] {
  const d = getDb();
  const rows = rowsFrom(
    d.prepare(`SELECT id, title, skill_id, created_at, updated_at, compacted_summary FROM agent_sessions ORDER BY updated_at DESC;`)
  );
  return rows.map((r) => ({
    id: String(r.id),
    title: String(r.title),
    skillId: r.skill_id != null ? String(r.skill_id) : undefined,
    createdAt: Number(r.created_at),
    updatedAt: Number(r.updated_at),
    compactedSummary: r.compacted_summary != null ? String(r.compacted_summary) : undefined,
  }));
}

export function getAgentSession(id: string): AgentSessionRecord | null {
  const d = getDb();
  const stmt = d.prepare(`SELECT id, title, skill_id, created_at, updated_at, compacted_summary FROM agent_sessions WHERE id = ?;`);
  stmt.bind([id]);
  if (!stmt.step()) {
    stmt.free();
    return null;
  }
  const r = stmt.getAsObject();
  stmt.free();
  return {
    id: String(r.id),
    title: String(r.title),
    skillId: r.skill_id != null ? String(r.skill_id) : undefined,
    createdAt: Number(r.created_at),
    updatedAt: Number(r.updated_at),
    compactedSummary: r.compacted_summary != null ? String(r.compacted_summary) : undefined,
  };
}

export function deleteAgentSession(id: string): void {
  const d = getDb();
  d.run(`DELETE FROM agent_messages WHERE session_id = ?;`, [id]);
  d.run(`DELETE FROM agent_sessions WHERE id = ?;`, [id]);
  persist();
}

export function insertAgentMessage(msg: AgentMessageDbRecord): void {
  const d = getDb();
  d.run(
    `INSERT INTO agent_messages (id, session_id, role, content, thinking_content, tool_calls, proposals, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      msg.id,
      msg.sessionId,
      msg.role,
      msg.content,
      msg.thinkingContent ?? null,
      msg.toolCalls ?? null,
      msg.proposals ?? null,
      msg.createdAt,
    ]
  );
  d.run(`UPDATE agent_sessions SET updated_at = ? WHERE id = ?;`, [msg.createdAt, msg.sessionId]);
  persist();
}

export function listAgentMessages(sessionId: string): AgentMessageDbRecord[] {
  const d = getDb();
  const stmt = d.prepare(
    `SELECT id, session_id, role, content, thinking_content, tool_calls, proposals, created_at
     FROM agent_messages WHERE session_id = ? ORDER BY created_at ASC;`
  );
  stmt.bind([sessionId]);
  const rows: AgentMessageDbRecord[] = [];
  while (stmt.step()) {
    const r = stmt.getAsObject();
    rows.push({
      id: String(r.id),
      sessionId: String(r.session_id),
      role: String(r.role) as AgentMessageDbRecord["role"],
      content: String(r.content),
      thinkingContent: r.thinking_content != null ? String(r.thinking_content) : undefined,
      toolCalls: r.tool_calls != null ? String(r.tool_calls) : undefined,
      proposals: r.proposals != null ? String(r.proposals) : undefined,
      createdAt: Number(r.created_at),
    });
  }
  stmt.free();
  return rows;
}

export interface CustomSkillDbRecord {
  id: string;
  name: string;
  description: string;
  allowedTools: string[];
  systemPrompt: string;
  tags?: string[];
  createdAt: number;
  updatedAt: number;
}

export function saveCustomSkill(skill: CustomSkillDbRecord): void {
  const d = getDb();
  d.run(
    `INSERT INTO custom_skills (id, name, description, allowed_tools, system_prompt, tags, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name=excluded.name,
       description=excluded.description,
       allowed_tools=excluded.allowed_tools,
       system_prompt=excluded.system_prompt,
       tags=excluded.tags,
       updated_at=excluded.updated_at;`,
    [
      skill.id,
      skill.name,
      skill.description,
      JSON.stringify(skill.allowedTools || []),
      skill.systemPrompt,
      skill.tags ? JSON.stringify(skill.tags) : null,
      skill.createdAt,
      skill.updatedAt,
    ]
  );
  persist();
}

export function listCustomSkills(): CustomSkillDbRecord[] {
  const d = getDb();
  const stmt = d.prepare(`SELECT id, name, description, allowed_tools, system_prompt, tags, created_at, updated_at FROM custom_skills ORDER BY updated_at DESC;`);
  const rows: CustomSkillDbRecord[] = [];
  while (stmt.step()) {
    const r = stmt.getAsObject();
    let allowedTools: string[] = [];
    try {
      allowedTools = JSON.parse(String(r.allowed_tools || "[]"));
    } catch {
      allowedTools = [];
    }
    let tags: string[] | undefined;
    if (r.tags) {
      try {
        tags = JSON.parse(String(r.tags));
      } catch {
        tags = undefined;
      }
    }
    rows.push({
      id: String(r.id),
      name: String(r.name),
      description: String(r.description),
      allowedTools,
      systemPrompt: String(r.system_prompt),
      tags,
      createdAt: Number(r.created_at),
      updatedAt: Number(r.updated_at),
    });
  }
  stmt.free();
  return rows;
}

export function getCustomSkill(id: string): CustomSkillDbRecord | null {
  const d = getDb();
  const stmt = d.prepare(`SELECT id, name, description, allowed_tools, system_prompt, tags, created_at, updated_at FROM custom_skills WHERE id = ?;`);
  stmt.bind([id]);
  if (!stmt.step()) {
    stmt.free();
    return null;
  }
  const r = stmt.getAsObject();
  stmt.free();
  let allowedTools: string[] = [];
  try {
    allowedTools = JSON.parse(String(r.allowed_tools || "[]"));
  } catch {
    allowedTools = [];
  }
  let tags: string[] | undefined;
  if (r.tags) {
    try {
      tags = JSON.parse(String(r.tags));
    } catch {
      tags = undefined;
    }
  }
  return {
    id: String(r.id),
    name: String(r.name),
    description: String(r.description),
    allowedTools,
    systemPrompt: String(r.system_prompt),
    tags,
    createdAt: Number(r.created_at),
    updatedAt: Number(r.updated_at),
  };
}

export function deleteCustomSkill(id: string): void {
  const d = getDb();
  d.run(`DELETE FROM custom_skills WHERE id = ?;`, [id]);
  persist();
}

export interface DraftRecord {
  id: string;
  accountId: string;
  to: string;
  subject: string;
  body: string;
  replyToMessageId?: string;
  updatedAt: number;
}

export function upsertDraft(draft: DraftRecord): void {
  const d = getDb();
  d.run(
    `INSERT INTO drafts (id, account_id, to_addr, subject, body, reply_to_message_id, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       account_id=excluded.account_id,
       to_addr=excluded.to_addr,
       subject=excluded.subject,
       body=excluded.body,
       reply_to_message_id=excluded.reply_to_message_id,
       updated_at=excluded.updated_at;`,
    [
      draft.id,
      draft.accountId,
      draft.to,
      draft.subject,
      draft.body,
      draft.replyToMessageId ?? null,
      draft.updatedAt,
    ]
  );
  persist();
}

export function getDraft(id: string): DraftRecord | null {
  const d = getDb();
  const stmt = d.prepare(`SELECT id, account_id, to_addr, subject, body, reply_to_message_id, updated_at FROM drafts WHERE id = ?;`);
  stmt.bind([id]);
  if (!stmt.step()) {
    stmt.free();
    return null;
  }
  const r = stmt.getAsObject();
  stmt.free();
  return {
    id: String(r.id),
    accountId: String(r.account_id),
    to: String(r.to_addr),
    subject: String(r.subject),
    body: String(r.body),
    replyToMessageId: r.reply_to_message_id != null ? String(r.reply_to_message_id) : undefined,
    updatedAt: Number(r.updated_at),
  };
}

export function listDrafts(accountId?: string): DraftRecord[] {
  const d = getDb();
  const stmt = accountId
    ? d.prepare(`SELECT id, account_id, to_addr, subject, body, reply_to_message_id, updated_at FROM drafts WHERE account_id = ? ORDER BY updated_at DESC;`)
    : d.prepare(`SELECT id, account_id, to_addr, subject, body, reply_to_message_id, updated_at FROM drafts ORDER BY updated_at DESC;`);
  if (accountId) {
    stmt.bind([accountId]);
  }
  const rows: DraftRecord[] = [];
  while (stmt.step()) {
    const r = stmt.getAsObject();
    rows.push({
      id: String(r.id),
      accountId: String(r.account_id),
      to: String(r.to_addr),
      subject: String(r.subject),
      body: String(r.body),
      replyToMessageId: r.reply_to_message_id != null ? String(r.reply_to_message_id) : undefined,
      updatedAt: Number(r.updated_at),
    });
  }
  stmt.free();
  return rows;
}

export function deleteDraft(id: string): void {
  const d = getDb();
  d.run(`DELETE FROM drafts WHERE id = ?;`, [id]);
  persist();
}



