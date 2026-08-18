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
  d.run(
    `CREATE INDEX IF NOT EXISTS idx_agent_messages_session ON agent_messages(session_id, created_at ASC);`
  );

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

  d.run(`
    CREATE TABLE IF NOT EXISTS calendar_events (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      location TEXT,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      start_ms INTEGER NOT NULL,
      end_ms INTEGER NOT NULL,
      all_day INTEGER NOT NULL DEFAULT 0,
      category TEXT NOT NULL DEFAULT 'meeting',
      color TEXT NOT NULL DEFAULT '#2563eb',
      status TEXT NOT NULL DEFAULT 'confirmed',
      attendees_json TEXT,
      source_message_id TEXT,
      source_message_subject TEXT,
      ics_uid TEXT,
      recurrence TEXT DEFAULT 'none',
      remind_minutes_before INTEGER DEFAULT 15,
      is_reminded INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
  d.run(`CREATE INDEX IF NOT EXISTS idx_calendar_start ON calendar_events(start_ms);`);
  d.run(
    `CREATE INDEX IF NOT EXISTS idx_calendar_remind ON calendar_events(start_ms, is_reminded);`
  );
  d.run(
    `CREATE INDEX IF NOT EXISTS idx_calendar_source_msg ON calendar_events(source_message_id);`
  );

  d.run(`
    CREATE TABLE IF NOT EXISTS contacts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      secondary_emails_json TEXT,
      phone TEXT,
      company TEXT,
      job_title TEXT,
      avatar_color TEXT,
      notes TEXT,
      tags_json TEXT,
      is_starred INTEGER NOT NULL DEFAULT 0,
      last_contacted_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
  d.run(`CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);`);
  d.run(`CREATE INDEX IF NOT EXISTS idx_contacts_name ON contacts(name);`);
  d.run(`CREATE INDEX IF NOT EXISTS idx_contacts_starred ON contacts(is_starred);`);
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
    ? d.prepare(
        `SELECT * FROM messages WHERE account_id = ? AND (subject LIKE ? OR snippet LIKE ? OR from_addr LIKE ? OR from_name LIKE ?) ORDER BY date_ms DESC;`
      )
    : d.prepare(
        `SELECT * FROM messages WHERE subject LIKE ? OR snippet LIKE ? OR from_addr LIKE ? OR from_name LIKE ? ORDER BY date_ms DESC;`
      );
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
    d.prepare(
      `SELECT id, title, skill_id, created_at, updated_at, compacted_summary FROM agent_sessions ORDER BY updated_at DESC;`
    )
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
  const stmt = d.prepare(
    `SELECT id, title, skill_id, created_at, updated_at, compacted_summary FROM agent_sessions WHERE id = ?;`
  );
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
  const stmt = d.prepare(
    `SELECT id, name, description, allowed_tools, system_prompt, tags, created_at, updated_at FROM custom_skills ORDER BY updated_at DESC;`
  );
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
  const stmt = d.prepare(
    `SELECT id, name, description, allowed_tools, system_prompt, tags, created_at, updated_at FROM custom_skills WHERE id = ?;`
  );
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
  const stmt = d.prepare(
    `SELECT id, account_id, to_addr, subject, body, reply_to_message_id, updated_at FROM drafts WHERE id = ?;`
  );
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
    ? d.prepare(
        `SELECT id, account_id, to_addr, subject, body, reply_to_message_id, updated_at FROM drafts WHERE account_id = ? ORDER BY updated_at DESC;`
      )
    : d.prepare(
        `SELECT id, account_id, to_addr, subject, body, reply_to_message_id, updated_at FROM drafts ORDER BY updated_at DESC;`
      );
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

// -----------------------------------------------------------------------------
// Calendar Events Database Operations
// -----------------------------------------------------------------------------

export type CalendarEventCategory = "meeting" | "work" | "personal" | "reminder" | "travel";

export type CalendarEventRecord = {
  id: string;
  title: string;
  description?: string;
  location?: string;
  startTime: string;
  endTime: string;
  startMs: number;
  endMs: number;
  allDay: boolean;
  category: CalendarEventCategory;
  color: string;
  status: "confirmed" | "tentative" | "cancelled";
  attendees: string[];
  sourceMessageId?: string;
  sourceMessageSubject?: string;
  icsUid?: string;
  recurrence: "none" | "daily" | "weekly" | "monthly";
  remindMinutesBefore: number;
  isReminded: boolean;
  createdAt: number;
  updatedAt: number;
};

function rowToCalendarEvent(r: Record<string, unknown>): CalendarEventRecord {
  let attendees: string[] = [];
  if (typeof r.attendees_json === "string" && r.attendees_json.trim()) {
    try {
      attendees = JSON.parse(r.attendees_json);
    } catch {
      attendees = [];
    }
  }
  return {
    id: String(r.id),
    title: String(r.title),
    description: r.description != null ? String(r.description) : undefined,
    location: r.location != null ? String(r.location) : undefined,
    startTime: String(r.start_time),
    endTime: String(r.end_time),
    startMs: Number(r.start_ms),
    endMs: Number(r.end_ms),
    allDay: Number(r.all_day) === 1,
    category: (String(r.category) as CalendarEventCategory) || "meeting",
    color: String(r.color || "#2563eb"),
    status: (String(r.status) as "confirmed" | "tentative" | "cancelled") || "confirmed",
    attendees,
    sourceMessageId: r.source_message_id != null ? String(r.source_message_id) : undefined,
    sourceMessageSubject:
      r.source_message_subject != null ? String(r.source_message_subject) : undefined,
    icsUid: r.ics_uid != null ? String(r.ics_uid) : undefined,
    recurrence: (String(r.recurrence) as "none" | "daily" | "weekly" | "monthly") || "none",
    remindMinutesBefore: r.remind_minutes_before != null ? Number(r.remind_minutes_before) : 15,
    isReminded: Number(r.is_reminded) === 1,
    createdAt: Number(r.created_at),
    updatedAt: Number(r.updated_at),
  };
}

export function createCalendarEvent(
  event: Omit<CalendarEventRecord, "id" | "createdAt" | "updatedAt"> & {
    id?: string;
    createdAt?: number;
    updatedAt?: number;
  }
): CalendarEventRecord {
  const d = getDb();
  const id = event.id || `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const now = Date.now();
  const createdAt = event.createdAt || now;
  const updatedAt = event.updatedAt || now;

  d.run(
    `INSERT INTO calendar_events (
      id, title, description, location, start_time, end_time, start_ms, end_ms,
      all_day, category, color, status, attendees_json, source_message_id, source_message_subject,
      ics_uid, recurrence, remind_minutes_before, is_reminded, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      id,
      event.title,
      event.description ?? null,
      event.location ?? null,
      event.startTime,
      event.endTime,
      event.startMs,
      event.endMs,
      event.allDay ? 1 : 0,
      event.category || "meeting",
      event.color || "#2563eb",
      event.status || "confirmed",
      JSON.stringify(event.attendees || []),
      event.sourceMessageId ?? null,
      event.sourceMessageSubject ?? null,
      event.icsUid ?? null,
      event.recurrence || "none",
      event.remindMinutesBefore ?? 15,
      event.isReminded ? 1 : 0,
      createdAt,
      updatedAt,
    ]
  );
  persist();
  return getCalendarEventById(id)!;
}

export function updateCalendarEvent(
  id: string,
  patch: Partial<CalendarEventRecord>
): CalendarEventRecord | null {
  const existing = getCalendarEventById(id);
  if (!existing) return null;

  const d = getDb();
  const updated: CalendarEventRecord = {
    ...existing,
    ...patch,
    updatedAt: Date.now(),
  };

  // If time or reminder changed, reset isReminded if startMs is in future
  const isReminded =
    patch.startMs !== undefined || patch.remindMinutesBefore !== undefined
      ? (patch.isReminded ?? false)
      : patch.isReminded !== undefined
        ? patch.isReminded
        : existing.isReminded;

  d.run(
    `UPDATE calendar_events SET
      title = ?, description = ?, location = ?, start_time = ?, end_time = ?,
      start_ms = ?, end_ms = ?, all_day = ?, category = ?, color = ?, status = ?,
      attendees_json = ?, source_message_id = ?, source_message_subject = ?,
      ics_uid = ?, recurrence = ?, remind_minutes_before = ?, is_reminded = ?, updated_at = ?
    WHERE id = ?;`,
    [
      updated.title,
      updated.description ?? null,
      updated.location ?? null,
      updated.startTime,
      updated.endTime,
      updated.startMs,
      updated.endMs,
      updated.allDay ? 1 : 0,
      updated.category,
      updated.color,
      updated.status,
      JSON.stringify(updated.attendees || []),
      updated.sourceMessageId ?? null,
      updated.sourceMessageSubject ?? null,
      updated.icsUid ?? null,
      updated.recurrence,
      updated.remindMinutesBefore,
      isReminded ? 1 : 0,
      updated.updatedAt,
      id,
    ]
  );
  persist();
  return getCalendarEventById(id);
}

export function deleteCalendarEvent(id: string): boolean {
  const d = getDb();
  d.run(`DELETE FROM calendar_events WHERE id = ?;`, [id]);
  persist();
  return true;
}

export function getCalendarEventById(id: string): CalendarEventRecord | null {
  const d = getDb();
  const stmt = d.prepare(`SELECT * FROM calendar_events WHERE id = ?;`);
  stmt.bind([id]);
  if (!stmt.step()) {
    stmt.free();
    return null;
  }
  const r = stmt.getAsObject();
  stmt.free();
  return rowToCalendarEvent(r);
}

export function listCalendarEvents(startMs?: number, endMs?: number): CalendarEventRecord[] {
  const d = getDb();
  let sql = `SELECT * FROM calendar_events`;
  const params: unknown[] = [];

  if (startMs !== undefined && endMs !== undefined) {
    sql += ` WHERE (end_ms >= ? AND start_ms <= ?)`;
    params.push(startMs, endMs);
  } else if (startMs !== undefined) {
    sql += ` WHERE end_ms >= ?`;
    params.push(startMs);
  } else if (endMs !== undefined) {
    sql += ` WHERE start_ms <= ?`;
    params.push(endMs);
  }

  sql += ` ORDER BY start_ms ASC, all_day DESC;`;
  const stmt = d.prepare(sql);
  if (params.length > 0) {
    stmt.bind(params);
  }

  const events: CalendarEventRecord[] = [];
  while (stmt.step()) {
    events.push(rowToCalendarEvent(stmt.getAsObject()));
  }
  stmt.free();
  return events;
}

export function getUpcomingReminders(nowMs: number, lookaheadMs = 60_000): CalendarEventRecord[] {
  const d = getDb();
  // Events where remindMinutesBefore >= 0 and not yet reminded
  // target reminder timestamp = start_ms - (remind_minutes_before * 60000)
  // Check if reminder timestamp is <= nowMs + lookaheadMs and start_ms >= nowMs - 300000 (not expired more than 5 min ago)
  const stmt = d.prepare(`
    SELECT * FROM calendar_events
    WHERE is_reminded = 0
      AND remind_minutes_before >= 0
      AND (start_ms - (remind_minutes_before * 60000)) <= ?
      AND start_ms >= ?
    ORDER BY start_ms ASC;
  `);
  stmt.bind([nowMs + lookaheadMs, nowMs - 300_000]);

  const events: CalendarEventRecord[] = [];
  while (stmt.step()) {
    events.push(rowToCalendarEvent(stmt.getAsObject()));
  }
  stmt.free();
  return events;
}

export function markCalendarEventReminded(id: string): void {
  const d = getDb();
  d.run(`UPDATE calendar_events SET is_reminded = 1 WHERE id = ?;`, [id]);
  persist();
}

// -----------------------------------------------------------------------------
// Contacts Database Operations
// -----------------------------------------------------------------------------

export type ContactRecord = {
  id: string;
  name: string;
  email: string;
  secondaryEmails: string[];
  phone?: string;
  company?: string;
  jobTitle?: string;
  avatarColor?: string;
  notes?: string;
  tags: string[];
  isStarred: boolean;
  lastContactedAt?: number;
  createdAt: number;
  updatedAt: number;
};

const AVATAR_COLORS = [
  "#2563EB", // Blue
  "#7C3AED", // Violet
  "#DB2777", // Pink
  "#EA580C", // Orange
  "#16A34A", // Green
  "#0D9488", // Teal
  "#0284C7", // Sky
  "#4F46E5", // Indigo
];

export function getDeterministicAvatarColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

function rowToContact(r: Record<string, unknown>): ContactRecord {
  let secondaryEmails: string[] = [];
  if (typeof r.secondary_emails_json === "string" && r.secondary_emails_json.trim()) {
    try {
      secondaryEmails = JSON.parse(r.secondary_emails_json);
    } catch {
      secondaryEmails = [];
    }
  }

  let tags: string[] = [];
  if (typeof r.tags_json === "string" && r.tags_json.trim()) {
    try {
      tags = JSON.parse(r.tags_json);
    } catch {
      tags = [];
    }
  }

  return {
    id: String(r.id),
    name: String(r.name),
    email: String(r.email),
    secondaryEmails,
    phone: r.phone != null ? String(r.phone) : undefined,
    company: r.company != null ? String(r.company) : undefined,
    jobTitle: r.job_title != null ? String(r.job_title) : undefined,
    avatarColor: r.avatar_color != null ? String(r.avatar_color) : undefined,
    notes: r.notes != null ? String(r.notes) : undefined,
    tags,
    isStarred: Number(r.is_starred) === 1,
    lastContactedAt: r.last_contacted_at != null ? Number(r.last_contacted_at) : undefined,
    createdAt: Number(r.created_at),
    updatedAt: Number(r.updated_at),
  };
}

export function createContact(
  contact: Omit<ContactRecord, "id" | "createdAt" | "updatedAt"> & {
    id?: string;
    createdAt?: number;
    updatedAt?: number;
  }
): ContactRecord {
  const d = getDb();
  const id = contact.id || `cnt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const now = Date.now();
  const createdAt = contact.createdAt || now;
  const updatedAt = contact.updatedAt || now;
  const avatarColor =
    contact.avatarColor || getDeterministicAvatarColor(contact.name || contact.email);

  d.run(
    `INSERT INTO contacts (
      id, name, email, secondary_emails_json, phone, company, job_title, avatar_color,
      notes, tags_json, is_starred, last_contacted_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      id,
      contact.name.trim() || contact.email.split("@")[0],
      contact.email.trim().toLowerCase(),
      JSON.stringify(contact.secondaryEmails || []),
      contact.phone?.trim() ?? null,
      contact.company?.trim() ?? null,
      contact.jobTitle?.trim() ?? null,
      avatarColor,
      contact.notes?.trim() ?? null,
      JSON.stringify(contact.tags || []),
      contact.isStarred ? 1 : 0,
      contact.lastContactedAt ?? null,
      createdAt,
      updatedAt,
    ]
  );
  persist();
  return getContactById(id)!;
}

export function updateContact(id: string, patch: Partial<ContactRecord>): ContactRecord | null {
  const existing = getContactById(id);
  if (!existing) return null;

  const d = getDb();
  const updated: ContactRecord = {
    ...existing,
    ...patch,
    updatedAt: Date.now(),
  };

  d.run(
    `UPDATE contacts SET
      name = ?, email = ?, secondary_emails_json = ?, phone = ?, company = ?,
      job_title = ?, avatar_color = ?, notes = ?, tags_json = ?, is_starred = ?,
      last_contacted_at = ?, updated_at = ?
    WHERE id = ?;`,
    [
      updated.name.trim(),
      updated.email.trim().toLowerCase(),
      JSON.stringify(updated.secondaryEmails || []),
      updated.phone?.trim() ?? null,
      updated.company?.trim() ?? null,
      updated.jobTitle?.trim() ?? null,
      updated.avatarColor || existing.avatarColor,
      updated.notes?.trim() ?? null,
      JSON.stringify(updated.tags || []),
      updated.isStarred ? 1 : 0,
      updated.lastContactedAt ?? null,
      updated.updatedAt,
      id,
    ]
  );
  persist();
  return getContactById(id);
}

export function deleteContact(id: string): boolean {
  const d = getDb();
  d.run(`DELETE FROM contacts WHERE id = ?;`, [id]);
  persist();
  return true;
}

export function getContactById(id: string): ContactRecord | null {
  const d = getDb();
  const stmt = d.prepare(`SELECT * FROM contacts WHERE id = ?;`);
  stmt.bind([id]);
  if (!stmt.step()) {
    stmt.free();
    return null;
  }
  const r = stmt.getAsObject();
  stmt.free();
  return rowToContact(r);
}

export function getContactByEmail(email: string): ContactRecord | null {
  const d = getDb();
  const normalized = email.trim().toLowerCase();
  const stmt = d.prepare(`SELECT * FROM contacts WHERE LOWER(email) = ? LIMIT 1;`);
  stmt.bind([normalized]);
  if (!stmt.step()) {
    stmt.free();
    return null;
  }
  const r = stmt.getAsObject();
  stmt.free();
  return rowToContact(r);
}

export function listContacts(filter?: {
  query?: string;
  tag?: string;
  starredOnly?: boolean;
}): ContactRecord[] {
  const d = getDb();
  let sql = `SELECT * FROM contacts WHERE 1=1`;
  const params: unknown[] = [];

  if (filter?.starredOnly) {
    sql += ` AND is_starred = 1`;
  }
  if (filter?.tag) {
    sql += ` AND tags_json LIKE ?`;
    params.push(`%"${filter.tag}"%`);
  }
  if (filter?.query && filter.query.trim()) {
    const q = `%${filter.query.trim().toLowerCase()}%`;
    sql += ` AND (LOWER(name) LIKE ? OR LOWER(email) LIKE ? OR LOWER(company) LIKE ? OR LOWER(notes) LIKE ?)`;
    params.push(q, q, q, q);
  }

  sql += ` ORDER BY is_starred DESC, name COLLATE NOCASE ASC;`;
  const stmt = d.prepare(sql);
  if (params.length > 0) {
    stmt.bind(params);
  }

  const contacts: ContactRecord[] = [];
  while (stmt.step()) {
    contacts.push(rowToContact(stmt.getAsObject()));
  }
  stmt.free();
  return contacts;
}

export function toggleContactStarred(id: string): boolean {
  const existing = getContactById(id);
  if (!existing) return false;
  const newStarred = !existing.isStarred;
  updateContact(id, { isStarred: newStarred });
  return newStarred;
}

export function touchContactLastContacted(email: string, dateMs = Date.now()): void {
  const existing = getContactByEmail(email);
  if (existing) {
    updateContact(existing.id, { lastContactedAt: dateMs });
  }
}

/**
 * Harvest unique sender and recipient email addresses from messages table
 * that are not yet explicitly saved in contacts.
 */
export function harvestContactsFromMessages(limit = 50): Array<{
  name: string;
  email: string;
  count: number;
  lastDateMs: number;
}> {
  const d = getDb();
  // Aggregate from_addr and from_name
  const stmt = d.prepare(`
    SELECT from_addr, from_name, COUNT(*) as msg_count, MAX(date_ms) as latest_date
    FROM messages
    WHERE from_addr != '' AND from_addr IS NOT NULL
    GROUP BY LOWER(from_addr)
    ORDER BY latest_date DESC
    LIMIT 200;
  `);

  const existingContacts = listContacts();
  const existingEmails = new Set<string>();
  for (const c of existingContacts) {
    existingEmails.add(c.email.toLowerCase());
    for (const sec of c.secondaryEmails) {
      existingEmails.add(sec.toLowerCase());
    }
  }

  const candidates: Array<{ name: string; email: string; count: number; lastDateMs: number }> = [];
  while (stmt.step()) {
    const r = stmt.getAsObject();
    const email = String(r.from_addr || "")
      .trim()
      .toLowerCase();
    const name = String(r.from_name || "").trim() || email.split("@")[0];
    const count = Number(r.msg_count || 1);
    const lastDateMs = Number(r.latest_date || Date.now());

    if (email && email.includes("@") && !existingEmails.has(email)) {
      candidates.push({ name, email, count, lastDateMs });
      if (candidates.length >= limit) break;
    }
  }
  stmt.free();
  return candidates;
}
