export function cleanContext(text: string, maxLen = 4000): string {
  const withoutQuote = text.replace(/^>.*$/gm, "").trim();
  return withoutQuote.slice(0, maxLen);
}

export type AiMode = "cloud" | "local";

export async function summarize(text: string, mode: AiMode = "cloud"): Promise<string> {
  const cleaned = cleanContext(text);
  if (!cleaned) return mode === "local" ? "【本机摘要】（正文为空）" : "【摘要】（正文为空）";
  if (mode === "local")
    return `【本机摘要】${cleaned.slice(0, 120)}${cleaned.length > 120 ? "…" : ""}`;
  return `【摘要】要点：${cleaned.slice(0, 120)}${cleaned.length > 120 ? "…" : ""}`;
}

export async function draftReply(text: string, mode: AiMode = "cloud"): Promise<string> {
  const cleaned = cleanContext(text, 80);
  const prefix = mode === "local" ? "【本机草稿】" : "";
  return `${prefix}你好，\n\n关于「${cleaned || "来信"}」，我的回复如下：\n\n（请在此补充细节）\n\n祝好`;
}

export async function rewriteTone(
  text: string,
  tone: "shorter" | "formal" | "expand"
): Promise<string> {
  const cleaned = cleanContext(text, 2000);
  if (tone === "shorter") {
    return cleaned.split(/\n+/).filter(Boolean).slice(0, 3).join("\n");
  }
  if (tone === "formal") {
    return `敬启者：\n\n${cleaned}\n\n此致\n敬礼`;
  }
  return `${cleaned}\n\n补充说明：如有需要我可以进一步展开相关细节。`;
}
