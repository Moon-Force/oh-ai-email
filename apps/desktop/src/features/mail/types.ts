export type MailFolderId = "inbox" | "sent" | "drafts" | "archive" | "trash";

export type MailFolder = {
  id: MailFolderId;
  name: string;
  unread: number;
};

export type MailMessage = {
  id: string;
  folderId: MailFolderId;
  from: string;
  fromName: string;
  subject: string;
  snippet: string;
  date: string;
  unread: boolean;
  split: "important" | "other";
  html?: string;
};

export type ShellView = "mail" | "settings" | "add-account";
