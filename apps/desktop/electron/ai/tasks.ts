import { buildMailContext, cleanContext } from "./clean";
import { chatComplete, type AiResult } from "./complete";
import type { AiMode } from "./settings";
import {
  systemForCompose,
  systemForDraftReply,
  systemForRewrite,
  systemForSummarize,
  type RewriteTone,
} from "./prompts";

export async function taskSummarize(input: {
  subject?: string;
  from?: string;
  body: string;
  mode?: AiMode;
}): Promise<AiResult> {
  const ctx = buildMailContext(input);
  return chatComplete(
    [
      { role: "system", content: systemForSummarize() },
      { role: "user", content: ctx },
    ],
    { mode: input.mode },
  );
}

export async function taskDraftReply(input: {
  subject?: string;
  from?: string;
  body: string;
  mode?: AiMode;
}): Promise<AiResult> {
  const ctx = buildMailContext(input);
  return chatComplete(
    [
      { role: "system", content: systemForDraftReply() },
      { role: "user", content: `Write a reply to this email:\n\n${ctx}` },
    ],
    { mode: input.mode },
  );
}

export async function taskRewrite(input: {
  text: string;
  tone: RewriteTone;
  mode?: AiMode;
}): Promise<AiResult> {
  const cleaned = cleanContext(input.text, 6000);
  if (!cleaned.trim()) {
    return { ok: false, code: "EMPTY", error: "没有可改写的文本" };
  }
  return chatComplete(
    [
      { role: "system", content: systemForRewrite(input.tone) },
      { role: "user", content: cleaned },
    ],
    { mode: input.mode },
  );
}

export async function taskCompose(input: {
  prompt: string;
  existingBody?: string;
  mode?: AiMode;
}): Promise<AiResult> {
  const prompt = input.prompt.trim();
  if (!prompt) {
    return { ok: false, code: "EMPTY", error: "请先输入写作提示" };
  }
  const user =
    input.existingBody?.trim()
      ? `Instruction: ${prompt}\n\nExisting draft to improve or replace:\n${cleanContext(input.existingBody, 4000)}`
      : `Instruction: ${prompt}`;
  return chatComplete(
    [
      { role: "system", content: systemForCompose() },
      { role: "user", content: user },
    ],
    { mode: input.mode },
  );
}
