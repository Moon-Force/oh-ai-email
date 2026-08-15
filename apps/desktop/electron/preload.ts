import { contextBridge, ipcRenderer } from "electron";

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
  | { ok: true; account: AccountDto; sync: { accountId: string; folders: number; messages: number; error?: string } }
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

const api = {
  ping: (): Promise<string> => ipcRenderer.invoke("ping"),
  prefsGet: (): Promise<{ syncIntervalMin: number }> => ipcRenderer.invoke("prefs:get"),
  prefsSave: (partial: { syncIntervalMin?: number }): Promise<{ syncIntervalMin: number }> =>
    ipcRenderer.invoke("prefs:save", partial),
  secretSave: (k: string, v: string): Promise<boolean> => ipcRenderer.invoke("secret:save", k, v),
  secretLoad: (k: string): Promise<string | null> => ipcRenderer.invoke("secret:load", k),
  secretDelete: (k: string): Promise<boolean> => ipcRenderer.invoke("secret:delete", k),

  accountList: (): Promise<AccountDto[]> => ipcRenderer.invoke("account:list"),
  accountTest: (payload: AddAccountPayload): Promise<TestResult> => ipcRenderer.invoke("account:test", payload),
  accountAdd: (payload: AddAccountPayload): Promise<AddResult> => ipcRenderer.invoke("account:add", payload),
  accountRemove: (id: string): Promise<boolean> => ipcRenderer.invoke("account:remove", id),

  mailSync: (accountId?: string): Promise<SyncResultDto[]> => ipcRenderer.invoke("mail:sync", accountId),
  mailSnapshot: (accountId?: string): Promise<MailSnapshot> => ipcRenderer.invoke("mail:snapshot", accountId),
  mailGet: (id: string): Promise<MessageDto | null> => ipcRenderer.invoke("mail:get", id),
  mailMarkRead: (id: string): Promise<MessageDto | null> => ipcRenderer.invoke("mail:markRead", id),
  mailSetSplit: (
    id: string,
    split: "important" | "other",
  ): Promise<MessageDto | null> => ipcRenderer.invoke("mail:setSplit", id, split),
  mailSaveAttachment: (
    attachmentId: string,
  ): Promise<{ ok: true; path: string } | { ok: false; error: string }> =>
    ipcRenderer.invoke("mail:saveAttachment", attachmentId),
  mailOpenAttachment: (
    attachmentId: string,
  ): Promise<{ ok: true } | { ok: false; error: string }> =>
    ipcRenderer.invoke("mail:openAttachment", attachmentId),
  mailSend: (payload: {
    accountId?: string;
    to: string;
    cc?: string;
    subject: string;
    body: string;
    html?: string;
    attachments?: {
      filename: string;
      contentType?: string;
      contentBase64: string;
      size?: number;
    }[];
  }): Promise<
    | {
        ok: true;
        messageId?: string;
        localMessageId?: string;
        folderId?: string;
        appendedToServer?: boolean;
      }
    | { ok: false; error: string }
  > => ipcRenderer.invoke("mail:send", payload),

  mailSaveDraft: (payload: {
    accountId?: string;
    to: string;
    cc?: string;
    subject: string;
    body: string;
    html?: string;
  }): Promise<
    | {
        ok: true;
        localMessageId: string;
        folderId: string;
        appendedToServer?: boolean;
      }
    | { ok: false; error: string }
  > => ipcRenderer.invoke("mail:saveDraft", payload),

  aiGetSettings: (): Promise<{
    mode: "cloud" | "local";
    baseUrl: string;
    model: string;
    ollamaHost: string;
    ollamaModel: string;
    cloudPrivacyAck: boolean;
    preferLocalWhenAvailable: boolean;
    hasCloudApiKey: boolean;
  }> => ipcRenderer.invoke("ai:getSettings"),

  aiSaveSettings: (
    payload: {
      mode?: "cloud" | "local";
      baseUrl?: string;
      model?: string;
      ollamaHost?: string;
      ollamaModel?: string;
      cloudPrivacyAck?: boolean;
      preferLocalWhenAvailable?: boolean;
      apiKey?: string;
    },
  ): Promise<{
    mode: "cloud" | "local";
    baseUrl: string;
    model: string;
    ollamaHost: string;
    ollamaModel: string;
    cloudPrivacyAck: boolean;
    preferLocalWhenAvailable: boolean;
    hasCloudApiKey: boolean;
  }> => ipcRenderer.invoke("ai:saveSettings", payload),

  aiProbeOllama: (): Promise<{ ok: true; models: string[] } | { ok: false; error: string }> =>
    ipcRenderer.invoke("ai:probeOllama"),

  aiProbeCloud: (): Promise<
    { ok: true } | { ok: false; error: string; code?: string }
  > => ipcRenderer.invoke("ai:probeCloud"),

  aiSummarize: (payload: {
    subject?: string;
    from?: string;
    body: string;
    mode?: "cloud" | "local";
  }): Promise<AiTaskResult> => ipcRenderer.invoke("ai:summarize", payload),

  aiDraftReply: (payload: {
    subject?: string;
    from?: string;
    body: string;
    mode?: "cloud" | "local";
  }): Promise<AiTaskResult> => ipcRenderer.invoke("ai:draftReply", payload),

  aiRewrite: (payload: {
    text: string;
    tone: "shorter" | "formal" | "expand";
    mode?: "cloud" | "local";
  }): Promise<AiTaskResult> => ipcRenderer.invoke("ai:rewrite", payload),

  aiCompose: (payload: {
    prompt: string;
    existingBody?: string;
    mode?: "cloud" | "local";
  }): Promise<AiTaskResult> => ipcRenderer.invoke("ai:compose", payload),
};

type AiTaskResult =
  | { ok: true; text: string; mode: "cloud" | "local" }
  | { ok: false; code: string; error: string };

contextBridge.exposeInMainWorld("api", api);

declare global {
  interface Window {
    api: typeof api;
  }
}
