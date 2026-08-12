/** Typed wrappers around window.api (Electron preload). Safe no-ops in browser tests. */

export type TlsMode = "ssl" | "starttls" | "none";

export type AccountDto = {
  id: string;
  email: string;
  displayName?: string;
  providerId?: string;
  imapHost: string;
  imapPort: number;
  imapTls: TlsMode;
  smtpHost: string;
  smtpPort: number;
  smtpTls: TlsMode;
  createdAt: number;
};

export type FolderDto = {
  id: string;
  accountId: string;
  remotePath: string;
  role: string;
  name: string;
  unread: number;
};

export type MessageDto = {
  id: string;
  accountId: string;
  folderId: string;
  uid: number;
  from: string;
  fromName: string;
  subject: string;
  snippet: string;
  dateMs: number;
  dateLabel: string;
  unread: boolean;
  split: "important" | "other";
  html?: string;
};

export type AddAccountPayload = {
  email: string;
  password: string;
  displayName?: string;
  providerId?: string;
  imapHost: string;
  imapPort: number;
  imapTls: TlsMode;
  smtpHost: string;
  smtpPort: number;
  smtpTls: TlsMode;
};

export type TestResult = { ok: true; greeting?: string } | { ok: false; error: string };

export type AddResult =
  | {
      ok: true;
      account: AccountDto;
      sync: { accountId: string; folders: number; messages: number; error?: string };
    }
  | { ok: false; error: string };

export type MailSnapshot = {
  accounts: AccountDto[];
  activeAccountId: string | null;
  folders: FolderDto[];
  messages: MessageDto[];
};

export type SyncResultDto = {
  accountId: string;
  folders: number;
  messages: number;
  error?: string;
};

type Api = {
  ping: () => Promise<string>;
  secretSave: (k: string, v: string) => Promise<boolean>;
  secretLoad: (k: string) => Promise<string | null>;
  secretDelete: (k: string) => Promise<boolean>;
  accountList: () => Promise<AccountDto[]>;
  accountTest: (payload: AddAccountPayload) => Promise<TestResult>;
  accountAdd: (payload: AddAccountPayload) => Promise<AddResult>;
  accountRemove: (id: string) => Promise<boolean>;
  mailSync: (accountId?: string) => Promise<SyncResultDto[]>;
  mailSnapshot: (accountId?: string) => Promise<MailSnapshot>;
  mailGet: (id: string) => Promise<MessageDto | null>;
  mailMarkRead: (id: string) => Promise<MessageDto | null>;
  mailSetSplit: (id: string, split: "important" | "other") => Promise<MessageDto | null>;
  mailSend: (payload: SendMailPayload) => Promise<SendMailResult>;
  mailSaveDraft: (payload: SaveDraftPayload) => Promise<SaveDraftResult>;
};

export type SendMailAttachment = {
  filename: string;
  contentType?: string;
  contentBase64: string;
  size?: number;
};

export type SendMailPayload = {
  accountId?: string;
  to: string;
  cc?: string;
  subject: string;
  body: string;
  html?: string;
  attachments?: SendMailAttachment[];
};

export type SendMailResult =
  | {
      ok: true;
      messageId?: string;
      localMessageId?: string;
      folderId?: string;
      appendedToServer?: boolean;
    }
  | { ok: false; error: string };

export type SaveDraftPayload = {
  accountId?: string;
  to: string;
  cc?: string;
  subject: string;
  body: string;
  html?: string;
};

export type SaveDraftResult =
  | {
      ok: true;
      localMessageId: string;
      folderId: string;
      appendedToServer?: boolean;
    }
  | { ok: false; error: string };

function getApi(): Api | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { api?: Api }).api ?? null;
}

export function hasDesktopApi(): boolean {
  return getApi() != null;
}

export async function ping(): Promise<string> {
  return getApi()?.ping() ?? "pong";
}

export async function accountTest(payload: AddAccountPayload): Promise<TestResult> {
  const api = getApi();
  if (!api) return { ok: false, error: "仅桌面端可测试 IMAP 连接" };
  return api.accountTest(payload);
}

export async function accountAdd(payload: AddAccountPayload): Promise<AddResult> {
  const api = getApi();
  if (!api) return { ok: false, error: "仅桌面端可添加账号" };
  return api.accountAdd(payload);
}

export async function accountRemove(id: string): Promise<boolean> {
  return getApi()?.accountRemove(id) ?? false;
}

export async function mailSnapshot(accountId?: string): Promise<MailSnapshot> {
  const api = getApi();
  if (!api) {
    return { accounts: [], activeAccountId: null, folders: [], messages: [] };
  }
  return api.mailSnapshot(accountId);
}

export async function mailSync(accountId?: string): Promise<SyncResultDto[]> {
  return getApi()?.mailSync(accountId) ?? [];
}

export async function mailMarkRead(id: string): Promise<MessageDto | null> {
  return getApi()?.mailMarkRead(id) ?? null;
}

export async function mailSetSplit(
  id: string,
  split: "important" | "other",
): Promise<MessageDto | null> {
  return getApi()?.mailSetSplit(id, split) ?? null;
}

export async function mailGet(id: string): Promise<MessageDto | null> {
  return getApi()?.mailGet(id) ?? null;
}

export async function mailSend(payload: SendMailPayload): Promise<SendMailResult> {
  const api = getApi();
  if (!api) {
    return { ok: false, error: "仅桌面端可发送邮件（当前为浏览器/测试环境）" };
  }
  return api.mailSend(payload);
}

export async function mailSaveDraft(payload: SaveDraftPayload): Promise<SaveDraftResult> {
  const api = getApi();
  if (!api) {
    return { ok: false, error: "仅桌面端可存草稿（当前为浏览器/测试环境）" };
  }
  return api.mailSaveDraft(payload);
}
