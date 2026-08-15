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

export type AttachmentDto = {
  id: string;
  filename: string;
  contentType: string;
  size: number;
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
  attachments?: AttachmentDto[];
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
  prefsGet: () => Promise<AppPrefsDto>;
  prefsSave: (partial: Partial<AppPrefsDto>) => Promise<AppPrefsDto>;
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
  mailSaveAttachment: (
    attachmentId: string,
  ) => Promise<{ ok: true; path: string } | { ok: false; error: string }>;
  mailOpenAttachment: (
    attachmentId: string,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  mailSend: (payload: SendMailPayload) => Promise<SendMailResult>;
  mailSaveDraft: (payload: SaveDraftPayload) => Promise<SaveDraftResult>;
  aiGetSettings: () => Promise<AiSettingsDto>;
  aiSaveSettings: (payload: AiSaveSettingsPayload) => Promise<AiSettingsDto>;
  aiProbeOllama: () => Promise<AiProbeOllamaResult>;
  aiProbeCloud: () => Promise<AiProbeCloudResult>;
  aiAbort: (requestId: string) => Promise<boolean>;
  aiSummarize: (payload: AiMailPayload) => Promise<AiTaskResult>;
  aiDraftReply: (payload: AiMailPayload) => Promise<AiTaskResult>;
  aiQuickReply: (payload: AiQuickReplyPayload) => Promise<AiTaskResult>;
  aiRewrite: (payload: AiRewritePayload) => Promise<AiTaskResult>;
  aiCompose: (payload: AiComposePayload) => Promise<AiTaskResult>;
};

export type AiModeDto = "cloud" | "local";

export type AiSettingsDto = {
  mode: AiModeDto;
  baseUrl: string;
  model: string;
  ollamaHost: string;
  ollamaModel: string;
  cloudPrivacyAck: boolean;
  preferLocalWhenAvailable: boolean;
  hasCloudApiKey: boolean;
};

export type AiSaveSettingsPayload = Partial<
  Omit<AiSettingsDto, "hasCloudApiKey">
> & { apiKey?: string };

export type AiTaskResult =
  | { ok: true; text: string; mode: AiModeDto }
  | { ok: false; code: string; error: string };

export type AiMailPayload = {
  subject?: string;
  from?: string;
  body: string;
  mode?: AiModeDto;
  requestId?: string;
};

export type AiQuickReplyPayload = {
  subject?: string;
  from?: string;
  body: string;
  replyType: string;
  customNote?: string;
  mode?: AiModeDto;
  requestId?: string;
};

export type AiRewritePayload = {
  text: string;
  tone: "shorter" | "formal" | "expand";
  mode?: AiModeDto;
  requestId?: string;
};

export type AiComposePayload = {
  prompt: string;
  existingBody?: string;
  mode?: AiModeDto;
  requestId?: string;
};

export type AiProbeOllamaResult =
  | { ok: true; models: string[] }
  | { ok: false; error: string };

export type AiProbeCloudResult =
  | { ok: true }
  | { ok: false; error: string; code?: string };

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

export type AppPrefsDto = {
  /** 0 = manual only */
  syncIntervalMin: number;
};

export async function prefsGet(): Promise<AppPrefsDto> {
  const api = getApi();
  if (!api?.prefsGet) return { syncIntervalMin: 5 };
  return api.prefsGet();
}

export async function prefsSave(partial: Partial<AppPrefsDto>): Promise<AppPrefsDto> {
  const api = getApi();
  if (!api?.prefsSave) {
    return { syncIntervalMin: partial.syncIntervalMin ?? 5 };
  }
  return api.prefsSave(partial);
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

export async function mailSaveAttachment(
  attachmentId: string,
): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  const api = getApi();
  if (!api) return { ok: false, error: "仅桌面端可下载附件" };
  return api.mailSaveAttachment(attachmentId);
}

export async function mailOpenAttachment(
  attachmentId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const api = getApi();
  if (!api) return { ok: false, error: "仅桌面端可打开附件" };
  return api.mailOpenAttachment(attachmentId);
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

const AI_BROWSER_ERR =
  "仅桌面端可调用 AI。请在 Electron 中运行，并到设置 → AI 配置密钥或 Ollama。";

export async function aiGetSettings(): Promise<AiSettingsDto> {
  const api = getApi();
  if (!api) {
    return {
      mode: "cloud",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-4o-mini",
      ollamaHost: "http://127.0.0.1:11434",
      ollamaModel: "llama3.2",
      cloudPrivacyAck: false,
      preferLocalWhenAvailable: false,
      hasCloudApiKey: false,
    };
  }
  return api.aiGetSettings();
}

export async function aiSaveSettings(payload: AiSaveSettingsPayload): Promise<AiSettingsDto> {
  const api = getApi();
  if (!api) {
    return {
      mode: payload.mode ?? "cloud",
      baseUrl: payload.baseUrl ?? "https://api.openai.com/v1",
      model: payload.model ?? "gpt-4o-mini",
      ollamaHost: payload.ollamaHost ?? "http://127.0.0.1:11434",
      ollamaModel: payload.ollamaModel ?? "llama3.2",
      cloudPrivacyAck: payload.cloudPrivacyAck ?? false,
      preferLocalWhenAvailable: payload.preferLocalWhenAvailable ?? false,
      hasCloudApiKey: Boolean(payload.apiKey?.trim()),
    };
  }
  return api.aiSaveSettings(payload);
}

export async function aiProbeOllama(): Promise<AiProbeOllamaResult> {
  return getApi()?.aiProbeOllama() ?? { ok: false, error: "仅桌面端可探测 Ollama" };
}

export async function aiProbeCloud(): Promise<AiProbeCloudResult> {
  return getApi()?.aiProbeCloud() ?? { ok: false, error: "仅桌面端可探测云端", code: "CONFIG" };
}

export async function aiAbort(requestId: string): Promise<boolean> {
  return getApi()?.aiAbort(requestId) ?? false;
}

export async function aiSummarize(payload: AiMailPayload): Promise<AiTaskResult> {
  const api = getApi();
  if (!api) return { ok: false, code: "CONFIG", error: AI_BROWSER_ERR };
  return api.aiSummarize(payload);
}

export async function aiDraftReply(payload: AiMailPayload): Promise<AiTaskResult> {
  const api = getApi();
  if (!api) return { ok: false, code: "CONFIG", error: AI_BROWSER_ERR };
  return api.aiDraftReply(payload);
}

export async function aiQuickReply(payload: AiQuickReplyPayload): Promise<AiTaskResult> {
  const api = getApi();
  if (!api) return { ok: false, code: "CONFIG", error: AI_BROWSER_ERR };
  return api.aiQuickReply(payload);
}

export async function aiRewrite(payload: AiRewritePayload): Promise<AiTaskResult> {
  const api = getApi();
  if (!api) return { ok: false, code: "CONFIG", error: AI_BROWSER_ERR };
  return api.aiRewrite(payload);
}

export async function aiCompose(payload: AiComposePayload): Promise<AiTaskResult> {
  const api = getApi();
  if (!api) return { ok: false, code: "CONFIG", error: AI_BROWSER_ERR };
  return api.aiCompose(payload);
}
