import type { MailMessage } from "./types";

/** Local substring search over subject / from / snippet / body html text. */
export function searchMessages(messages: MailMessage[], query: string): MailMessage[] {
  const q = query.trim().toLowerCase();
  if (!q) return messages;
  return messages.filter((m) => {
    const hay = [m.from, m.fromName, m.subject, m.snippet, m.html ?? ""].join("\n").toLowerCase();
    return hay.includes(q);
  });
}

/** Highlight matched spans with mark tags for list/reader snippets (safe for plain text). */
export function highlightMatch(text: string, query: string): string {
  const q = query.trim();
  if (!q) return text;
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.replace(new RegExp(`(${escaped})`, "gi"), "«$1»");
}
