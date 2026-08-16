export type TlsMode = "ssl" | "starttls" | "none";

export type FolderRole = "inbox" | "sent" | "drafts" | "archive" | "trash" | "other";

export type AccountRecord = {
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

export type FolderRecord = {
  id: string;
  accountId: string;
  remotePath: string;
  role: FolderRole;
  name: string;
  unread: number;
};

export type MessageRecord = {
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
  snoozedUntil?: number | null;
  isPinned?: boolean;
  isMuted?: boolean;
  /** Populated when listing for UI (not a messages column). */
  attachments?: AttachmentMeta[];
};

/** Attachment metadata (content lives on disk under userData). */
export type AttachmentMeta = {
  id: string;
  messageId: string;
  filename: string;
  contentType: string;
  size: number;
  /** Absolute path to cached file (main process only; strip for UI if needed). */
  storagePath: string;
};

export type ImapConnectInput = {
  email: string;
  password: string;
  imapHost: string;
  imapPort: number;
  imapTls: TlsMode;
};

export type TestConnectionResult = { ok: true; greeting?: string } | { ok: false; error: string };

export type SyncResult = {
  accountId: string;
  folders: number;
  messages: number;
  error?: string;
};
