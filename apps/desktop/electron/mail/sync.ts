import {
  deleteMessage,
  getAccount,
  getMessage,
  listFolders,
  persist,
  recomputeFolderUnread,
  upsertFolder,
  upsertMessage,
} from "../db";
import { loadSecret } from "../store";
import {
  appendToMailbox,
  buildRawSentMessage,
  fetchRecentMessages,
  formatDateLabel,
  listRemoteFolders,
  markUidSeen,
  passwordKey,
  withImapAccount,
} from "./imap";
import type { AccountRecord, FolderRecord, MessageRecord, SyncResult } from "./types";

function classifySplit(from: string, subject: string): "important" | "other" {
  const domain = from.split("@")[1]?.toLowerCase() ?? "";
  const hay = `${from} ${subject}`.toLowerCase();
  if (
    domain.includes("stripe") ||
    domain.includes("github") ||
    hay.includes("会议") ||
    hay.includes("invoice") ||
    hay.includes("urgent") ||
    hay.includes("重要")
  ) {
    return "important";
  }
  // newsletters often other
  if (hay.includes("unsubscribe") || hay.includes("newsletter") || hay.includes("noreply")) {
    return "other";
  }
  return "important";
}

function folderId(accountId: string, role: string, remotePath: string): string {
  return `${accountId}:${role}:${Buffer.from(remotePath).toString("base64url")}`;
}

function messageId(accountId: string, folderId: string, uid: number): string {
  return `${accountId}:${folderId}:${uid}`;
}

const ROLE_PRIORITY: Record<string, number> = {
  inbox: 0,
  sent: 1,
  drafts: 2,
  archive: 3,
  trash: 4,
  other: 9,
};

/** Sync folders + recent messages for an account. Prefers role-mapped folders (inbox first). */
export async function syncAccount(accountId: string, limitPerFolder = 40): Promise<SyncResult> {
  const account = getAccount(accountId);
  if (!account) return { accountId, folders: 0, messages: 0, error: "账号不存在" };

  const password = loadSecret(passwordKey(accountId));
  if (!password) {
    return { accountId, folders: 0, messages: 0, error: "未找到保存的密码/授权码，请重新添加账号" };
  }

  try {
    const result = await withImapAccount(account, password, async (client) => {
      const remote = await listRemoteFolders(client);
      // One folder per primary role when possible
      const byRole = new Map<string, (typeof remote)[0]>();
      for (const f of remote) {
        if (f.role === "other") continue;
        if (!byRole.has(f.role)) byRole.set(f.role, f);
      }
      // Always sync inbox; also sent if present
      const toSync = ["inbox", "sent", "drafts", "trash"]
        .map((role) => byRole.get(role))
        .filter(Boolean) as typeof remote;

      if (toSync.length === 0) {
        toSync.push({ path: "INBOX", name: "INBOX", role: "inbox" });
      }

      let messageCount = 0;
      for (const rf of toSync) {
        const id = folderId(accountId, rf.role, rf.path);
        const folder: FolderRecord = {
          id,
          accountId,
          remotePath: rf.path,
          role: rf.role,
          name: rf.role === "inbox" ? "收件箱" : rf.role === "sent" ? "已发送" : rf.role === "drafts" ? "草稿" : rf.role === "trash" ? "垃圾箱" : rf.name,
          unread: 0,
        };
        upsertFolder(folder);

        try {
          const fetched = await fetchRecentMessages(client, rf.path, limitPerFolder);
          for (const m of fetched) {
            const mid = messageId(accountId, id, m.uid);
            // Keep user (or prior) split; only classify brand-new rows
            const existing = getMessage(mid);
            const rec: MessageRecord = {
              id: mid,
              accountId,
              folderId: id,
              uid: m.uid,
              from: m.from,
              fromName: m.fromName,
              subject: m.subject,
              snippet: m.snippet,
              dateMs: m.dateMs,
              dateLabel: formatDateLabel(new Date(m.dateMs)),
              unread: m.unread,
              split: existing?.split ?? classifySplit(m.from, m.subject),
              html: m.html,
            };
            upsertMessage(rec);
            messageCount += 1;
          }
          recomputeFolderUnread(accountId, id);
        } catch (err) {
          // folder may not exist on some providers
          console.warn(`[sync] folder ${rf.path}`, err);
        }
      }
      persist();
      return { folders: toSync.length, messages: messageCount };
    });

    return { accountId, folders: result.folders, messages: result.messages };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { accountId, folders: 0, messages: 0, error: msg };
  }
}

export async function markMessageReadRemote(messageIdStr: string): Promise<void> {
  const msg = getMessage(messageIdStr);
  if (!msg) return;

  const account = getAccount(msg.accountId);
  if (!account) return;
  const password = loadSecret(passwordKey(msg.accountId));
  if (!password) return;

  const folders = listFolders(msg.accountId);
  const folder = folders.find((f) => f.id === msg.folderId);
  if (!folder) return;

  try {
    await withImapAccount(account, password, async (client) => {
      await markUidSeen(client, folder.remotePath, msg.uid);
    });
  } catch (err) {
    console.warn("[imap] mark seen failed", err);
  }
}

export function sortFoldersForUi(folders: FolderRecord[]): FolderRecord[] {
  return [...folders].sort(
    (a, b) => (ROLE_PRIORITY[a.role] ?? 9) - (ROLE_PRIORITY[b.role] ?? 9) || a.name.localeCompare(b.name),
  );
}

function ensureLocalSentFolder(accountId: string, remotePath = "Sent"): FolderRecord {
  const existing = listFolders(accountId).find((f) => f.role === "sent");
  if (existing) return existing;
  const rec: FolderRecord = {
    id: folderId(accountId, "sent", remotePath),
    accountId,
    remotePath,
    role: "sent",
    name: "已发送",
    unread: 0,
  };
  upsertFolder(rec);
  persist();
  return rec;
}

function bodyToHtml(body: string): string {
  const esc = body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  return `<pre style="font-family:Segoe UI,system-ui,sans-serif;white-space:pre-wrap;font-size:14px;line-height:1.5">${esc}</pre>`;
}

/**
 * After SMTP success: write local Sent row immediately, then best-effort
 * IMAP APPEND + refresh Sent folder so UI does not need manual sync.
 */
export async function recordSentAfterSend(opts: {
  account: AccountRecord;
  password: string;
  to: string;
  cc?: string;
  subject: string;
  body: string;
}): Promise<{ localMessageId: string; folderId: string; appended: boolean }> {
  const { account, password, to, cc, subject, body } = opts;
  let sentFolder = ensureLocalSentFolder(account.id);
  const now = Date.now();
  // Negative UID marks local-only rows (avoids clashing with server UIDs)
  const uid = -now;
  const localMessageId = messageId(account.id, sentFolder.id, uid);
  const snippet = body.replace(/\s+/g, " ").trim().slice(0, 160) || subject || "(无主题)";
  const html = bodyToHtml(body);

  const rec: MessageRecord = {
    id: localMessageId,
    accountId: account.id,
    folderId: sentFolder.id,
    uid,
    from: account.email,
    fromName: account.displayName || account.email.split("@")[0] || account.email,
    subject: subject || "(无主题)",
    snippet: cc ? `至 ${to}；抄送 ${cc} · ${snippet}` : `至 ${to} · ${snippet}`,
    dateMs: now,
    dateLabel: formatDateLabel(new Date(now)),
    unread: false,
    split: "important",
    html,
  };
  upsertMessage(rec);
  recomputeFolderUnread(account.id, sentFolder.id);
  persist();

  let appended = false;
  let resultId = localMessageId;
  try {
    const remoteResult = await withImapAccount(account, password, async (client) => {
      const remote = await listRemoteFolders(client);
      const remoteSent = remote.find((f) => f.role === "sent");
      if (!remoteSent) return { appended: false, selectId: localMessageId };

      if (remoteSent.path !== sentFolder.remotePath) {
        // Keep stable local folder id; only update remote path for APPEND/sync
        sentFolder = { ...sentFolder, remotePath: remoteSent.path, name: "已发送" };
        upsertFolder(sentFolder);
        persist();
      }
      const raw = buildRawSentMessage({
        from: account.email,
        fromName: account.displayName,
        to,
        cc,
        subject: subject || "(无主题)",
        body,
        date: new Date(now),
      });
      await appendToMailbox(client, remoteSent.path, raw);

      // Pull latest Sent so server copy also appears
      try {
        const fetched = await fetchRecentMessages(client, remoteSent.path, 15);
        let newestServerId: string | null = null;
        let newestMs = 0;
        for (const m of fetched) {
          const mid = messageId(account.id, sentFolder.id, m.uid);
          const existing = getMessage(mid);
          upsertMessage({
            id: mid,
            accountId: account.id,
            folderId: sentFolder.id,
            uid: m.uid,
            from: m.from,
            fromName: m.fromName,
            subject: m.subject,
            snippet: m.snippet,
            dateMs: m.dateMs,
            dateLabel: formatDateLabel(new Date(m.dateMs)),
            unread: m.unread,
            split: existing?.split ?? classifySplit(m.from, m.subject),
            html: m.html,
          });
          if (m.dateMs >= newestMs) {
            newestMs = m.dateMs;
            newestServerId = mid;
          }
        }
        // Drop local placeholder once server copy is in DB (avoid duplicates)
        if (newestServerId) {
          deleteMessage(localMessageId);
          recomputeFolderUnread(account.id, sentFolder.id);
          persist();
          return { appended: true, selectId: newestServerId };
        }
        recomputeFolderUnread(account.id, sentFolder.id);
        persist();
      } catch (err) {
        console.warn("[send] refresh sent folder failed", err);
      }
      return { appended: true, selectId: localMessageId };
    });
    appended = remoteResult.appended;
    resultId = remoteResult.selectId;
  } catch (err) {
    console.warn("[send] IMAP append to Sent failed (local copy kept)", err);
  }

  return { localMessageId: resultId, folderId: sentFolder.id, appended };
}

function ensureLocalDraftsFolder(accountId: string, remotePath = "Drafts"): FolderRecord {
  const existing = listFolders(accountId).find((f) => f.role === "drafts");
  if (existing) return existing;
  const rec: FolderRecord = {
    id: folderId(accountId, "drafts", remotePath),
    accountId,
    remotePath,
    role: "drafts",
    name: "草稿",
    unread: 0,
  };
  upsertFolder(rec);
  persist();
  return rec;
}

/**
 * Save a draft locally (and best-effort IMAP APPEND to Drafts).
 * Always leaves a local row so 草稿箱 updates without manual sync.
 */
export async function recordDraft(opts: {
  account: AccountRecord;
  password: string;
  to: string;
  cc?: string;
  subject: string;
  body: string;
  html?: string;
}): Promise<{ localMessageId: string; folderId: string; appended: boolean }> {
  const { account, password, to, cc, subject, body, html } = opts;
  let draftsFolder = ensureLocalDraftsFolder(account.id);
  const now = Date.now();
  const uid = -now;
  const localMessageId = messageId(account.id, draftsFolder.id, uid);
  const plain = body.replace(/\s+/g, " ").trim();
  const snippet = plain.slice(0, 160) || subject || "(无主题)";
  const storedHtml =
    html && html.trim() && html !== "<p></p>"
      ? html
      : bodyToHtml(body);

  const toLabel = to.trim() || "(未填收件人)";
  const rec: MessageRecord = {
    id: localMessageId,
    accountId: account.id,
    folderId: draftsFolder.id,
    uid,
    from: account.email,
    fromName: account.displayName || account.email.split("@")[0] || account.email,
    subject: subject.trim() || "(无主题)",
    snippet: cc?.trim()
      ? `草稿 · 至 ${toLabel}；抄送 ${cc.trim()} · ${snippet}`
      : `草稿 · 至 ${toLabel} · ${snippet}`,
    dateMs: now,
    dateLabel: formatDateLabel(new Date(now)),
    unread: false,
    split: "important",
    html: storedHtml,
  };
  upsertMessage(rec);
  recomputeFolderUnread(account.id, draftsFolder.id);
  persist();

  let appended = false;
  try {
    const remoteResult = await withImapAccount(account, password, async (client) => {
      const remote = await listRemoteFolders(client);
      const remoteDrafts = remote.find((f) => f.role === "drafts");
      if (!remoteDrafts) return { appended: false };

      if (remoteDrafts.path !== draftsFolder.remotePath) {
        draftsFolder = { ...draftsFolder, remotePath: remoteDrafts.path, name: "草稿" };
        upsertFolder(draftsFolder);
        persist();
      }

      const raw = buildRawSentMessage({
        from: account.email,
        fromName: account.displayName,
        to: to.trim() || account.email,
        cc,
        subject: subject.trim() || "(无主题)",
        body: plain || subject || "",
        date: new Date(now),
      });
      await appendToMailbox(client, remoteDrafts.path, raw, ["\\Draft", "\\Seen"]);
      return { appended: true };
    });
    appended = remoteResult.appended;
  } catch (err) {
    console.warn("[draft] IMAP append to Drafts failed (local copy kept)", err);
  }

  return { localMessageId, folderId: draftsFolder.id, appended };
}
