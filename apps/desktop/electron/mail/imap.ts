import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import type { AccountRecord, FolderRole, ImapConnectInput, TestConnectionResult } from "./types";

export function passwordKey(accountId: string): string {
  return `acct:${accountId}:pass`;
}

function createClient(input: ImapConnectInput): ImapFlow {
  const secure = input.imapTls === "ssl" || input.imapPort === 993;
  return new ImapFlow({
    host: input.imapHost,
    port: input.imapPort,
    secure,
    auth: {
      user: input.email,
      pass: input.password,
    },
    logger: false,
    tls: {
      rejectUnauthorized: true,
      minVersion: "TLSv1.2",
    },
    connectionTimeout: 20_000,
    greetingTimeout: 20_000,
    socketTimeout: 60_000,
  });
}

function humanizeImapError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  if (lower.includes("authentication") || lower.includes("invalid credentials") || lower.includes("auth")) {
    return "认证失败：请检查邮箱地址与授权码（多数服务商不支持登录密码）";
  }
  if (lower.includes("timeout") || lower.includes("timed out")) {
    return "连接超时：请检查网络、IMAP 服务器与端口";
  }
  if (lower.includes("certificate") || lower.includes("ssl") || lower.includes("tls")) {
    return `证书/TLS 错误：${msg}`;
  }
  if (lower.includes("enotfound") || lower.includes("getaddrinfo")) {
    return `无法解析服务器地址：${msg}`;
  }
  if (lower.includes("econnrefused")) {
    return `服务器拒绝连接：${msg}`;
  }
  return msg || "未知连接错误";
}

export async function testImapConnection(input: ImapConnectInput): Promise<TestConnectionResult> {
  const client = createClient(input);
  try {
    await client.connect();
    const caps = client.capabilities ? [...client.capabilities].join(", ") : undefined;
    await client.logout().catch(() => undefined);
    return { ok: true, greeting: caps };
  } catch (err) {
    try {
      client.close();
    } catch {
      /* ignore */
    }
    return { ok: false, error: humanizeImapError(err) };
  }
}

export type RemoteFolder = {
  path: string;
  name: string;
  role: FolderRole;
};

export function classifyFolderRole(pathName: string): FolderRole {
  const p = pathName.toLowerCase();
  if (p === "inbox" || p.endsWith("/inbox")) return "inbox";
  if (p.includes("sent") || p.includes("已发送")) return "sent";
  if (p.includes("draft") || p.includes("草稿")) return "drafts";
  if (p.includes("archive") || p.includes("归档") || p.includes("all mail")) return "archive";
  if (p.includes("trash") || p.includes("deleted") || p.includes("已删除") || p.includes("junk") || p.includes("spam") || p.includes("垃圾")) {
    return "trash";
  }
  return "other";
}

export async function withImapAccount<T>(
  account: AccountRecord,
  password: string,
  fn: (client: ImapFlow) => Promise<T>,
): Promise<T> {
  const client = createClient({
    email: account.email,
    password,
    imapHost: account.imapHost,
    imapPort: account.imapPort,
    imapTls: account.imapTls,
  });
  try {
    await client.connect();
    return await fn(client);
  } finally {
    try {
      await client.logout();
    } catch {
      try {
        client.close();
      } catch {
        /* ignore */
      }
    }
  }
}

export async function listRemoteFolders(client: ImapFlow): Promise<RemoteFolder[]> {
  const boxes = await client.list();
  const out: RemoteFolder[] = [];
  for (const box of boxes) {
    if (box.flags?.has("\\Noselect")) continue;
    const pathName = box.path;
    out.push({
      path: pathName,
      name: box.name || pathName,
      role: classifyFolderRole(pathName),
    });
  }
  // Ensure INBOX present
  if (!out.some((f) => f.role === "inbox")) {
    out.unshift({ path: "INBOX", name: "INBOX", role: "inbox" });
  }
  return out;
}

export type FetchedMessage = {
  uid: number;
  from: string;
  fromName: string;
  subject: string;
  snippet: string;
  dateMs: number;
  unread: boolean;
  html?: string;
};

function formatDateLabel(d: Date): string {
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return `今天 ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
  const yday = new Date(now);
  yday.setDate(now.getDate() - 1);
  const isYday =
    d.getFullYear() === yday.getFullYear() &&
    d.getMonth() === yday.getMonth() &&
    d.getDate() === yday.getDate();
  if (isYday) return "昨天";
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function pickAddress(
  list: { address?: string | null; name?: string | null }[] | undefined,
): {
  from: string;
  fromName: string;
} {
  const v = list?.[0];
  return {
    from: v?.address || "unknown",
    fromName: v?.name || v?.address || "未知发件人",
  };
}

/** Fetch recent messages from a mailbox (UID order, last `limit`). */
export async function fetchRecentMessages(
  client: ImapFlow,
  mailboxPath: string,
  limit = 50,
): Promise<FetchedMessage[]> {
  const lock = await client.getMailboxLock(mailboxPath);
  const results: FetchedMessage[] = [];
  try {
    const exists = client.mailbox && typeof client.mailbox === "object" ? client.mailbox.exists : 0;
    if (!exists || exists < 1) return results;

    const start = Math.max(1, exists - limit + 1);
    const range = `${start}:${exists}`;

    for await (const msg of client.fetch(range, {
      uid: true,
      flags: true,
      envelope: true,
      bodyStructure: true,
      source: true,
    })) {
      const env = msg.envelope;
      const { from, fromName } = pickAddress(env?.from as { address?: string; name?: string }[] | undefined);
      const subject = env?.subject || "(无主题)";
      const date = env?.date ? new Date(env.date) : new Date();
      const unread = !(msg.flags?.has("\\Seen") ?? false);

      let html: string | undefined;
      let snippet = "";
      if (msg.source) {
        try {
          const parsed = await simpleParser(msg.source);
          html =
            typeof parsed.html === "string"
              ? parsed.html
              : parsed.textAsHtml || undefined;
          const text = parsed.text || (html ? html.replace(/<[^>]+>/g, " ") : "");
          snippet = text.replace(/\s+/g, " ").trim().slice(0, 160);
        } catch {
          snippet = subject;
        }
      }
      if (!snippet) snippet = subject;

      results.push({
        uid: msg.uid,
        from,
        fromName,
        subject,
        snippet,
        dateMs: date.getTime(),
        unread,
        html,
      });
    }
  } finally {
    lock.release();
  }
  // Newest first
  results.sort((a, b) => b.dateMs - a.dateMs);
  return results;
}

export async function markUidSeen(
  client: ImapFlow,
  mailboxPath: string,
  uid: number,
): Promise<void> {
  const lock = await client.getMailboxLock(mailboxPath);
  try {
    await client.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true });
  } finally {
    lock.release();
  }
}

function encodeMimeWord(s: string): string {
  if (/^[\x20-\x7E]*$/.test(s)) return s;
  return `=?UTF-8?B?${Buffer.from(s, "utf8").toString("base64")}?=`;
}

/** Build a minimal RFC822 message for IMAP APPEND to Sent. */
export function buildRawSentMessage(opts: {
  from: string;
  fromName?: string;
  to: string;
  cc?: string;
  subject: string;
  body: string;
  date?: Date;
}): string {
  const date = opts.date ?? new Date();
  const from =
    opts.fromName && opts.fromName.trim()
      ? `"${opts.fromName.replace(/"/g, "")}" <${opts.from}>`
      : opts.from;
  const lines = [
    `From: ${from}`,
    `To: ${opts.to}`,
    ...(opts.cc ? [`Cc: ${opts.cc}`] : []),
    `Subject: ${encodeMimeWord(opts.subject || "(无主题)")}`,
    `Date: ${date.toUTCString()}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    opts.body || "",
  ];
  return lines.join("\r\n");
}

/** Append a raw message into a mailbox (e.g. Sent / Drafts). */
export async function appendToMailbox(
  client: ImapFlow,
  mailboxPath: string,
  raw: string,
  flags: string[] = ["\\Seen"],
): Promise<void> {
  await client.append(mailboxPath, Buffer.from(raw, "utf8"), flags, new Date());
}

export { formatDateLabel };
