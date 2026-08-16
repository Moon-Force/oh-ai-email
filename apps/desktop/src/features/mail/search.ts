import type { MailMessage } from "./types";

export interface ParsedQuery {
  from?: string;
  to?: string;
  subject?: string;
  isUnread?: boolean;
  hasAttachment?: boolean;
  split?: "important" | "other";
  terms: string[];
}

/** Parse search string into structured filters (from:, subject:, is:unread, has:attachment, split:) and search terms. */
export function parseSearchQuery(query: string): ParsedQuery {
  const raw = query.trim();
  const parsed: ParsedQuery = { terms: [] };
  if (!raw) return parsed;

  const tokens = raw.split(/\s+/);
  for (const token of tokens) {
    const lower = token.toLowerCase();

    if (lower.startsWith("from:") || lower.startsWith("发件人:")) {
      parsed.from = token
        .slice(token.indexOf(":") + 1)
        .trim()
        .toLowerCase();
    } else if (lower.startsWith("to:") || lower.startsWith("收件人:")) {
      parsed.to = token
        .slice(token.indexOf(":") + 1)
        .trim()
        .toLowerCase();
    } else if (lower.startsWith("subject:") || lower.startsWith("主题:")) {
      parsed.subject = token
        .slice(token.indexOf(":") + 1)
        .trim()
        .toLowerCase();
    } else if (lower === "is:unread" || lower === "is:未读" || lower === "未读") {
      parsed.isUnread = true;
    } else if (lower === "is:read" || lower === "is:已读" || lower === "已读") {
      parsed.isUnread = false;
    } else if (
      lower === "has:attachment" ||
      lower === "has:att" ||
      lower === "有附件" ||
      lower === "含附件"
    ) {
      parsed.hasAttachment = true;
    } else if (lower === "split:important" || lower === "is:important" || lower === "重要") {
      parsed.split = "important";
    } else if (lower === "split:other" || lower === "is:other" || lower === "其他") {
      parsed.split = "other";
    } else {
      parsed.terms.push(lower);
    }
  }

  return parsed;
}

/** Local natural language and field-aware search over subject / from / snippet / body with score ranking. */
export function searchMessages(messages: MailMessage[], query: string): MailMessage[] {
  const parsed = parseSearchQuery(query);
  const rawQuery = query.trim().toLowerCase();
  if (!rawQuery) return messages;

  const results: { message: MailMessage; score: number }[] = [];

  for (const m of messages) {
    // 1. Field-specific checks
    if (parsed.from) {
      const fromMatch =
        m.from.toLowerCase().includes(parsed.from) ||
        (m.fromName ?? "").toLowerCase().includes(parsed.from);
      if (!fromMatch) continue;
    }
    if (parsed.to && m.to) {
      const toMatch = m.to.toLowerCase().includes(parsed.to);
      if (!toMatch) continue;
    }
    if (parsed.subject) {
      const subMatch = m.subject.toLowerCase().includes(parsed.subject);
      if (!subMatch) continue;
    }
    if (parsed.isUnread !== undefined) {
      if (Boolean(m.unread) !== parsed.isUnread) continue;
    }
    if (parsed.hasAttachment !== undefined) {
      const hasAtt = Boolean(
        (m.attachments && m.attachments.length > 0) || (m.snippet && m.snippet.includes("📎"))
      );
      if (hasAtt !== parsed.hasAttachment) continue;
    }
    if (parsed.split !== undefined) {
      if (m.split !== parsed.split) continue;
    }

    // 2. Multi-term matching across fields
    let termMatch = true;
    let score = 0;

    const fromText = `${m.from} ${m.fromName ?? ""}`.toLowerCase();
    const subText = m.subject.toLowerCase();
    const bodyText = `${m.snippet ?? ""} ${m.html ?? ""}`.toLowerCase();

    for (const term of parsed.terms) {
      const inSub = subText.includes(term);
      const inFrom = fromText.includes(term);
      const inBody = bodyText.includes(term);

      if (!inSub && !inFrom && !inBody) {
        termMatch = false;
        break;
      }

      if (inSub) score += 10;
      if (inFrom) score += 5;
      if (inBody) score += 2;
    }

    if (!termMatch) continue;

    results.push({ message: m, score });
  }

  // Sort by score desc, then date desc
  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (b.message.dateMs ?? 0) - (a.message.dateMs ?? 0);
  });

  return results.map((r) => r.message);
}

/** Highlight matched spans with mark characters for list/reader snippets (safe for plain text). */
export function highlightMatch(text: string, query: string): string {
  const parsed = parseSearchQuery(query);
  const terms = parsed.terms.filter(Boolean);
  if (terms.length === 0 && !parsed.from && !parsed.subject) return text;

  const allTerms = [...terms, parsed.from, parsed.subject].filter(Boolean) as string[];
  if (allTerms.length === 0) return text;

  const pattern = allTerms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  return text.replace(new RegExp(`(${pattern})`, "gi"), "«$1»");
}
