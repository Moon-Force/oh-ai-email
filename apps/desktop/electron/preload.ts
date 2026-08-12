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
};

contextBridge.exposeInMainWorld("api", api);

declare global {
  interface Window {
    api: typeof api;
  }
}
