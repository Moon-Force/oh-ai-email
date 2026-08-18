export type MailFolderId = "inbox" | "sent" | "drafts" | "archive" | "trash" | "snoozed";

export type MailFolder = {
  id: string;
  role: MailFolderId | "other";
  name: string;
  unread: number;
  remotePath?: string;
};

export type MailAttachment = {
  id: string;
  filename: string;
  contentType: string;
  size: number;
};

export type MailMessage = {
  id: string;
  accountId: string;
  folderId: string;
  /** UI role for filtering when folderId is composite */
  folderRole: MailFolderId | "other";
  uid: number;
  from: string;
  fromName: string;
  to?: string;
  replyTo?: string;
  subject: string;
  snippet: string;
  date: string;
  dateMs: number;
  unread: boolean;
  split: "important" | "other";
  html?: string;
  snoozedUntil?: number | null;
  isPinned?: boolean;
  isMuted?: boolean;
  attachments?: MailAttachment[];
};

export type ShellView = "mail" | "settings" | "add-account" | "calendar" | "contacts";
