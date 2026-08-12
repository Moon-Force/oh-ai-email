import { create } from "zustand";
import type { MailFolder, MailFolderId, MailMessage, ShellView } from "./types";
import { searchMessages } from "./search";
import { classify } from "../organize/rules";

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
  setFolders: (f: MailFolder[]) => void;
  setMessages: (m: MailMessage[]) => void;
  select: (id: string | null) => void;
  markRead: (id: string) => void;
  setFolder: (id: MailFolderId) => void;
  setSplit: (s: SplitFilter) => void;
  setSearchQuery: (q: string) => void;
  setView: (v: ShellView) => void;
  setComposeOpen: (open: boolean) => void;
  setConnectionError: (err: string | null) => void;
  visibleMessages: () => MailMessage[];
  unreadInFolder: (id: MailFolderId) => number;
};

const defaultRules = [
  { domain: "stripe.com", split: "important" as const },
  { domain: "lumen", split: "important" as const },
  { keyword: "会议", split: "important" as const },
  { keyword: "Q3", split: "important" as const },
];

const mockFolders: MailFolder[] = [
  { id: "inbox", name: "收件箱", unread: 3 },
  { id: "sent", name: "已发送", unread: 0 },
  { id: "drafts", name: "草稿", unread: 0 },
  { id: "archive", name: "归档", unread: 0 },
  { id: "trash", name: "垃圾箱", unread: 0 },
];

const mockMessagesBase: MailMessage[] = [
  {
    id: "1",
    folderId: "inbox",
    from: "sarah@stripe.com",
    fromName: "Sarah Chen",
    subject: "Q3 发布物料已就绪，请审阅",
    snippet: "Hey team, attached the final brand deck and updated pricing page…",
    date: "今天 09:41",
    unread: true,
    split: "important",
    html: "<p>Hey team,</p><p>Attached the final brand deck and updated pricing page with the new illustrations. Everything is now ready for the Q3 campaign launch on August 12th. Let me know if you spot anything off.</p><p>Best,<br/>Sarah</p>",
  },
  {
    id: "2",
    folderId: "inbox",
    from: "alex@lumen.soft",
    fromName: "Alex Rivera",
    subject: "定价页反馈",
    snippet: "新开关看起来好多了，配合 Liquid Glass…",
    date: "昨天",
    unread: true,
    split: "important",
    html: "<p>新开关看起来好多了。配合 Liquid Glass 侧栏后，夜间对比度也稳住了。</p>",
  },
  {
    id: "3",
    folderId: "inbox",
    from: "legal@acme.com",
    fromName: "Legal · Acme",
    subject: "合同签字提醒",
    snippet: "请在 EOD 前审阅 4.2 节 IP 归属…",
    date: "08:22",
    unread: false,
    split: "other",
    html: "<p>请在 EOD 前审阅第 4.2 节关于 IP 归属的条款。</p>",
  },
  {
    id: "4",
    folderId: "inbox",
    from: "bob@example.com",
    fromName: "Bob",
    subject: "会议纪要",
    snippet: "昨天会议要点如下…",
    date: "昨天",
    unread: false,
    split: "important",
    html: "<p>会议纪要：</p><ul><li>确定 MVP 范围</li><li>Liquid Glass 仅功能层</li></ul>",
  },
  {
    id: "5",
    folderId: "inbox",
    from: "promo@newsletter.io",
    fromName: "Newsletter",
    subject: "本周产品简报",
    snippet: "五条你可能错过的更新…",
    date: "周一",
    unread: true,
    split: "other",
    html: "<p>本周产品简报：五条你可能错过的更新。</p>",
  },
];

const mockMessages: MailMessage[] = mockMessagesBase.map((m) => ({
  ...m,
  split: classify(m.from, m.subject, defaultRules),
}));

export const useMailStore = create<State>((set, get) => ({
  folders: mockFolders,
  messages: mockMessages,
  selectedId: "1",
  activeFolderId: "inbox",
  split: "important",
  searchQuery: "",
  view: "mail",
  composeOpen: false,
  connectionError: null,
  setFolders: (folders) => set({ folders }),
  setMessages: (messages) => set({ messages }),
  select: (id) => set({ selectedId: id }),
  markRead: (id) =>
    set((s) => ({
      messages: s.messages.map((m) => (m.id === id ? { ...m, unread: false } : m)),
    })),
  setFolder: (id) => set({ activeFolderId: id, selectedId: null }),
  setSplit: (split) => set({ split }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setView: (view) => set({ view }),
  setComposeOpen: (composeOpen) => set({ composeOpen }),
  setConnectionError: (connectionError) => set({ connectionError }),
  visibleMessages: () => {
    const { messages, activeFolderId, split, searchQuery } = get();
    let list = messages.filter((m) => m.folderId === activeFolderId);
    if (split !== "all") list = list.filter((m) => m.split === split);
    return searchMessages(list, searchQuery);
  },
  unreadInFolder: (id) => get().messages.filter((m) => m.folderId === id && m.unread).length,
}));

/** Hue-ish ambient tint from sender string for glass edge bleed. */
export function ambientFromSender(from: string): string {
  let h = 0;
  for (let i = 0; i < from.length; i++) h = (h * 31 + from.charCodeAt(i)) % 360;
  return `color-mix(in oklab, hsl(${h} 55% 55%) 12%, transparent)`;
}
