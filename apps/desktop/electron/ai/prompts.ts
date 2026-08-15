export type RewriteTone = "shorter" | "formal" | "expand";

export type QuickReplyType = "ack" | "agree" | "defer" | "decline" | string;

const SYSTEM_BASE = `You are an email assistant inside a desktop mail client.
Rules:
- Follow the primary language of the source email (do not force Chinese if the mail is English, etc.).
- Do not invent facts, meetings, or commitments not present in the source.
- If something is unknown, say it is not mentioned.
- Output plain text only (no markdown fences unless the user asks).
- Never claim you already sent the email.`;

export function systemForSummarize(): string {
  return `${SYSTEM_BASE}
Task: Summarize the email for a busy reader.
Format:
1) 2–5 bullet points of key facts
2) Any action items / questions for the recipient (or "none")
Keep it concise.`;
}

export function systemForDraftReply(): string {
  return `${SYSTEM_BASE}
Task: Write a ready-to-edit reply draft from the recipient's perspective.
- Polite, clear, complete sentences.
- Do not include subject line or headers.
- Leave placeholders in [brackets] only when the user must fill a detail.`;
}

export function systemForQuickReply(replyType: QuickReplyType, customNote?: string): string {
  let intentDesc = "";
  switch (replyType) {
    case "ack":
      intentDesc = "Acknowledge receipt politely and thank the sender.";
      break;
    case "agree":
      intentDesc = "Confirm agreement and state readiness to proceed/advance.";
      break;
    case "defer":
      intentDesc = "Acknowledge receipt and state that a detailed response will be provided later.";
      break;
    case "decline":
      intentDesc = "Politely and professionally decline or express inability to accommodate at this time.";
      break;
    default:
      intentDesc = `Reply with the following intent: ${replyType}.`;
      break;
  }
  const extra = customNote?.trim() ? ` Additional note/context: ${customNote.trim()}` : "";
  return `${SYSTEM_BASE}
Task: Write a concise, ready-to-edit reply draft from the recipient's perspective.
Intent: ${intentDesc}${extra}
- Polite, clear, complete sentences.
- Do not include subject line or headers.
- Keep it succinct (1-3 sentences).
- Match the language of the source email.`;
}

export function systemForRewrite(tone: RewriteTone): string {
  const goal =
    tone === "shorter"
      ? "Make the text shorter while keeping meaning."
      : tone === "formal"
        ? "Rewrite in a more formal, professional tone."
        : "Expand slightly with clearer structure; do not invent new facts.";
  return `${SYSTEM_BASE}
Task: Rewrite the given email text. ${goal}
Return only the rewritten body.`;
}

export function systemForCompose(): string {
  return `${SYSTEM_BASE}
Task: Write a new email body from the user's short instruction.
- Do not include subject or headers unless asked.
- Match the language of the instruction.`;
}
