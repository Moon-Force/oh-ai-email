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

export type RedactResult = {
  text: string;
  replacements: Record<string, string>;
};

/** Redact emails, phone numbers, and card/ID numbers with safe placeholders. */
export function redactSensitiveData(input: string): RedactResult {
  const replacements: Record<string, string> = {};
  let counter = 1;

  let out = input;

  // 1. Email addresses
  out = out.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, (match) => {
    const placeholder = `[EMAIL_${counter++}]`;
    replacements[placeholder] = match;
    return placeholder;
  });

  // 2. Phone numbers (11 digits or +86 format)
  out = out.replace(/(?:\+?86[- ]?)?1[3-9]\d{9}\b/g, (match) => {
    const placeholder = `[PHONE_${counter++}]`;
    replacements[placeholder] = match;
    return placeholder;
  });

  // 3. 15-19 digit card / ID numbers
  out = out.replace(/\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{3,7}\b/g, (match) => {
    const placeholder = `[NUM_${counter++}]`;
    replacements[placeholder] = match;
    return placeholder;
  });

  return { text: out, replacements };
}

/** Restore original data from placeholders if present in model output. */
export function restoreRedactedData(text: string, replacements: Record<string, string>): string {
  let restored = text;
  for (const [placeholder, original] of Object.entries(replacements)) {
    restored = restored.split(placeholder).join(original);
  }
  return restored;
}

