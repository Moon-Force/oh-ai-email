import { describe, expect, it } from "vitest";
import { highlightMatch, parseSearchQuery, searchMessages } from "./search";
import type { MailMessage } from "./types";

const sample: MailMessage[] = [
  {
    id: "1",
    accountId: "a",
    folderId: "inbox",
    folderRole: "inbox",
    uid: 1,
    from: "alice@company.com",
    fromName: "Alice",
    subject: "Q3 launch meeting",
    snippet: "brand deck and timeline 📎",
    date: "today",
    dateMs: 100,
    unread: true,
    split: "important",
    html: "<p>pricing page discussion</p>",
    attachmentMetas: [{ id: "att1", filename: "deck.pdf", size: 1024, mimeType: "application/pdf" }],
  },
  {
    id: "2",
    accountId: "a",
    folderId: "inbox",
    folderRole: "inbox",
    uid: 2,
    from: "bob@other.com",
    fromName: "Bob",
    subject: "Hello and welcome",
    snippet: "welcome to the newsletter",
    date: "yesterday",
    dateMs: 50,
    unread: false,
    split: "other",
  },
];

describe("parseSearchQuery", () => {
  it("extracts field tokens and terms", () => {
    const q = parseSearchQuery("from:alice is:unread has:attachment split:important launch");
    expect(q.from).toBe("alice");
    expect(q.isUnread).toBe(true);
    expect(q.hasAttachment).toBe(true);
    expect(q.split).toBe("important");
    expect(q.terms).toEqual(["launch"]);
  });

  it("handles Chinese field prefixes", () => {
    const q = parseSearchQuery("发件人:bob 主题:hello 未读 重要");
    expect(q.from).toBe("bob");
    expect(q.subject).toBe("hello");
    expect(q.isUnread).toBe(true);
    expect(q.split).toBe("important");
  });
});

describe("searchMessages", () => {
  it("returns all when query empty", () => {
    expect(searchMessages(sample, "  ")).toHaveLength(2);
  });

  it("matches subject case-insensitively", () => {
    expect(searchMessages(sample, "q3")).toEqual([sample[0]]);
  });

  it("matches html body text", () => {
    expect(searchMessages(sample, "pricing")).toEqual([sample[0]]);
  });

  it("matches from name", () => {
    expect(searchMessages(sample, "bob")).toEqual([sample[1]]);
  });

  it("filters by is:unread", () => {
    expect(searchMessages(sample, "is:unread")).toEqual([sample[0]]);
    expect(searchMessages(sample, "is:read")).toEqual([sample[1]]);
  });

  it("filters by has:attachment", () => {
    expect(searchMessages(sample, "has:attachment")).toEqual([sample[0]]);
  });

  it("filters by split:important", () => {
    expect(searchMessages(sample, "split:important")).toEqual([sample[0]]);
    expect(searchMessages(sample, "split:other")).toEqual([sample[1]]);
  });

  it("combines multi-term search", () => {
    expect(searchMessages(sample, "Alice Q3")).toEqual([sample[0]]);
    expect(searchMessages(sample, "Alice nonexisting")).toHaveLength(0);
  });
});

describe("highlightMatch", () => {
  it("wraps matches with markers", () => {
    expect(highlightMatch("oh-ai-email local", "local")).toBe("oh-ai-email «local»");
  });

  it("handles field queries in highlighting", () => {
    expect(highlightMatch("email from alice", "from:alice")).toBe("email from «alice»");
  });

  it("returns original when empty query", () => {
    expect(highlightMatch("abc", "")).toBe("abc");
  });
});

