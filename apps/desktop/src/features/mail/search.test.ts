import { describe, expect, it } from "vitest";
import { highlightMatch, searchMessages } from "./search";
import type { MailMessage } from "./types";

const sample: MailMessage[] = [
  {
    id: "1",
    folderId: "inbox",
    from: "a@b.com",
    fromName: "Alice",
    subject: "Q3 launch",
    snippet: "brand deck",
    date: "today",
    unread: true,
    split: "important",
    html: "<p>pricing page</p>",
  },
  {
    id: "2",
    folderId: "inbox",
    from: "c@d.com",
    fromName: "Bob",
    subject: "Hello",
    snippet: "world",
    date: "y",
    unread: false,
    split: "other",
  },
];

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
});

describe("highlightMatch", () => {
  it("wraps matches", () => {
    expect(highlightMatch("oh-ai-email local", "local")).toBe("oh-ai-email «local»");
  });

  it("returns original when empty query", () => {
    expect(highlightMatch("abc", "")).toBe("abc");
  });
});
