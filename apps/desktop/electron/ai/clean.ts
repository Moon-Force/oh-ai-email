/** Strip HTML tags and collapse whitespace for model context. */
export function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/** Remove quote lines and truncate for prompts. */
export function cleanContext(text: string, maxLen = 6000): string {
  const withoutQuote = text
    .replace(/^>.*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (withoutQuote.length <= maxLen) return withoutQuote;
  return withoutQuote.slice(0, maxLen);
}

export function buildMailContext(opts: {
  subject?: string;
  from?: string;
  body: string;
  maxLen?: number;
}): string {
  const plain = opts.body.includes("<") ? stripHtml(opts.body) : opts.body;
  const cleaned = cleanContext(plain, opts.maxLen ?? 6000);
  const parts: string[] = [];
  if (opts.from?.trim()) parts.push(`From: ${opts.from.trim()}`);
  if (opts.subject?.trim()) parts.push(`Subject: ${opts.subject.trim()}`);
  parts.push("", cleaned || "(empty body)");
  return parts.join("\n");
}
