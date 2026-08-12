export function buildReplyQuote(from: string, body: string) {
  return `On behalf of ${from}:\n> ${body.replace(/\n/g, "\n> ")}`;
}
