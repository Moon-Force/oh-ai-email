import { create } from "zustand";
import type { MailFolder, MailFolderId, MailMessage, ShellView } from "./types";
import { searchMessages } from "./search";
import type { FolderDto, MessageDto } from "../../lib/ipc";
import { mailMarkRead, mailSetSplit, mailSnapshot, mailSync } from "../../lib/ipc";
import { accountFromDto, useAccountsStore } from "../accounts/store";

type SplitFilter = "important" | "other" | "all";

type State = {
  folders: MailFolder[];
  messages: MailMessage[];
  selectedId: string | null;
  activeFolderId: MailFolderId;
  split: SplitFilter;
  searchQuery: string;
  view: ShellView;
  composeOpen: boolean;
  connectionError: string | null;
  syncing: boolean;
  lastSyncAt: number | null;
  setFolders: (f: MailFolder[]) => void;
  setMessages: (m: MailMessage[]) => void;
  select: (id: string | null) => void;
  markRead: (id: string) => void;
  /** Manually set 分箱: important | other. Survives re-sync. */
  setMessageSplit: (id: string, split: "important" | "other") => void;
  setFolder: (id: MailFolderId) => void;
  setSplit: (s: SplitFilter) => void;
  setSearchQuery: (q: string) => void;
  setView: (v: ShellView) => void;
  setComposeOpen: (open: boolean) => void;
  setConnectionError: (err: string | null) => void;
  applySnapshot: (folders: FolderDto[], messages: MessageDto[]) => void;
  hydrate: (accountId?: string) => Promise<void>;
  syncNow: (accountId?: string) => Promise<void>;
  visibleMessages: () => MailMessage[];
  unreadInFolder: (id: MailFolderId) => number;
};

const EMPTY_FOLDERS: MailFolder[] = [
  { id: "role:inbox", role: "inbox", name: "收件箱", unread: 0 },
  { id: "role:sent", role: "sent", name: "已发送", unread: 0 },
  { id: "role:drafts", role: "drafts", name: "草稿", unread: 0 },
  { id: "role:archive", role: "archive", name: "归档", unread: 0 },
  { id: "role:trash", role: "trash", name: "垃圾箱", unread: 0 },
];

function mapRole(role: string): MailFolderId | "other" {
  if (role === "inbox" || role === "sent" || role === "drafts" || role === "archive" || role === "trash") {
    return role;
  }
  return "other";
}

function mapFolder(f: FolderDto): MailFolder {
  return {
    id: f.id,
    role: mapRole(f.role),
    name: f.name,
    unread: f.unread,
    remotePath: f.remotePath,
  };
}

function mapMessage(m: MessageDto, folders: MailFolder[]): MailMessage {
  const folder = folders.find((f) => f.id === m.folderId);
  return {
    id: m.id,
    accountId: m.accountId,
    folderId: m.folderId,
    folderRole: folder?.role ?? "other",
    uid: m.uid,
    from: m.from,
    fromName: m.fromName,
    subject: m.subject,
    snippet: m.snippet,
    date: m.dateLabel,
    dateMs: m.dateMs,
    unread: m.unread,
    split: m.split,
    html: m.html,
  };
}

function mergeUiFolders(remote: MailFolder[]): MailFolder[] {
  const byRole = new Map(remote.filter((f) => f.role !== "other").map((f) => [f.role, f]));
  return EMPTY_FOLDERS.map((base) => {
    const hit = byRole.get(base.role);
    return hit
      ? { ...base, id: hit.id, unread: hit.unread, remotePath: hit.remotePath, name: hit.name || base.name }
      : base;
  });
}

export const useMailStore = create<State>((set, get) => ({
  folders: EMPTY_FOLDERS,
  messages: [],
  selectedId: null,
  activeFolderId: "inbox",
  split: "all",
  searchQuery: "",
  view: "mail",
  composeOpen: false,
  connectionError: null,
  syncing: false,
  lastSyncAt: null,
  setFolders: (folders) => set({ folders }),
  setMessages: (messages) => set({ messages }),
  select: (id) => set({ selectedId: id }),
  markRead: (id) => {
    set((s) => ({
      messages: s.messages.map((m) => (m.id === id ? { ...m, unread: false } : m)),
      folders: s.folders.map((f) => {
        const msg = s.messages.find((m) => m.id === id);
        if (!msg || msg.folderId !== f.id || !msg.unread) return f;
        return { ...f, unread: Math.max(0, f.unread - 1) };
      }),
    }));
    void mailMarkRead(id);
  },
  setMessageSplit: (id, split) => {
    set((s) => ({
      messages: s.messages.map((m) => (m.id === id ? { ...m, split } : m)),
    }));
    void mailSetSplit(id, split);
  },
  setFolder: (id) => set({ activeFolderId: id, selectedId: null }),
  setSplit: (split) => set({ split }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setView: (view) => set({ view }),
  setComposeOpen: (composeOpen) => set({ composeOpen }),
  setConnectionError: (connectionError) => set({ connectionError }),
  applySnapshot: (folderDtos, messageDtos) => {
    const remoteFolders = folderDtos.map(mapFolder);
    const folders = mergeUiFolders(remoteFolders);
    const messages = messageDtos.map((m) => mapMessage(m, remoteFolders));
    const selectedId = get().selectedId;
    set({
      folders,
      messages,
      selectedId: selectedId && messages.some((m) => m.id === selectedId) ? selectedId : messages[0]?.id ?? null,
    });
  },
  hydrate: async (accountId) => {
    const snap = await mailSnapshot(accountId);
    useAccountsStore.getState().setAccounts(snap.accounts.map(accountFromDto), snap.activeAccountId);
    get().applySnapshot(snap.folders, snap.messages);
  },
  syncNow: async (accountId) => {
    set({ syncing: true, connectionError: null });
    try {
      const results = await mailSync(accountId);
      const err = results.find((r) => r.error)?.error;
      if (err) set({ connectionError: err });
      await get().hydrate(accountId ?? useAccountsStore.getState().activeAccountId ?? undefined);
      set({ lastSyncAt: Date.now() });
    } catch (e) {
      set({ connectionError: e instanceof Error ? e.message : String(e) });
    } finally {
      set({ syncing: false });
    }
  },
  visibleMessages: () => {
    const { messages, activeFolderId, split, searchQuery, folders } = get();
    const folder = folders.find((f) => f.role === activeFolderId);
    let list = folder ? messages.filter((m) => m.folderId === folder.id) : messages.filter((m) => m.folderRole === activeFolderId);
    if (split !== "all") list = list.filter((m) => m.split === split);
    return searchMessages(list, searchQuery);
  },
  unreadInFolder: (id) => {
    const folder = get().folders.find((f) => f.role === id);
    if (folder) return folder.unread;
    return get().messages.filter((m) => m.folderRole === id && m.unread).length;
  },
}));

/** Hue-ish ambient tint from sender string. */
export function ambientFromSender(from: string): string {
  let h = 0;
  for (let i = 0; i < from.length; i++) h = (h * 31 + from.charCodeAt(i)) % 360;
  return `color-mix(in oklab, hsl(${h} 55% 55%) 12%, transparent)`;
}
