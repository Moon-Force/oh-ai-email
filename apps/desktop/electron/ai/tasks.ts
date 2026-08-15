import { buildMailContext, cleanContext } from "./clean";
import { abortAiRequest, chatComplete, type AiErrorCode, type AiResult } from "./complete";
import type { AiMode } from "./settings";
import {
  systemForActionItems,
  systemForAttachmentAnalysis,
  systemForCompose,
  systemForDraftReply,
  systemForLearnUserTone,
  systemForQuickReply,
  systemForRewrite,
  systemForSuggestSplit,
  systemForSummarize,
  systemForThreadSummary,
  systemForTranslation,
  type QuickReplyType,
  type RewriteTone,
} from "./prompts";

export { abortAiRequest };

export type ActionItemsResult =
  | {
      ok: true;
      tags: string[];
      actionItems: string[];
      deadline?: string;
      mode: AiMode;
    }
  | { ok: false; code: AiErrorCode; error: string };

export type ThreadSummaryTimelineItem = {
  sender: string;
  date?: string;
  point: string;
};

export type ThreadSummaryResult =
  | {
      ok: true;
      summary: string;
      timeline: ThreadSummaryTimelineItem[];
      mode: AiMode;
    }
  | { ok: false; code: AiErrorCode; error: string };

export type SuggestSplitResult =
  | {
      ok: true;
      split: "important" | "other";
      reason: string;
      confidence?: "high" | "medium" | "low" | string;
      mode: AiMode;
    }
  | { ok: false; code: AiErrorCode; error: string };

export async function taskSummarize(input: {
  subject?: string;
  from?: string;
  body: string;
  mode?: AiMode;
  requestId?: string;
}): Promise<AiResult> {
  const ctx = buildMailContext(input);
  return chatComplete(
    [
      { role: "system", content: systemForSummarize() },
      { role: "user", content: ctx },
    ],
    { mode: input.mode, requestId: input.requestId },
  );
}

export async function taskDraftReply(input: {
  subject?: string;
  from?: string;
  body: string;
  userPersona?: string;
  mode?: AiMode;
  requestId?: string;
}): Promise<AiResult> {
  const ctx = buildMailContext(input);
  return chatComplete(
    [
      { role: "system", content: systemForDraftReply(input.userPersona) },
      { role: "user", content: `Write a reply to this email:\n\n${ctx}` },
    ],
    { mode: input.mode, requestId: input.requestId },
  );
}

export async function taskQuickReply(input: {
  subject?: string;
  from?: string;
  body: string;
  replyType: QuickReplyType;
  customNote?: string;
  mode?: AiMode;
  requestId?: string;
}): Promise<AiResult> {
  const ctx = buildMailContext(input);
  return chatComplete(
    [
      { role: "system", content: systemForQuickReply(input.replyType, input.customNote) },
      { role: "user", content: `Write a quick reply to this email:\n\n${ctx}` },
    ],
    { mode: input.mode, requestId: input.requestId },
  );
}

export async function taskExtractActionItems(input: {
  subject?: string;
  from?: string;
  body: string;
  mode?: AiMode;
  requestId?: string;
}): Promise<ActionItemsResult> {
  const ctx = buildMailContext(input);
  const result = await chatComplete(
    [
      { role: "system", content: systemForActionItems() },
      { role: "user", content: ctx },
    ],
    { mode: input.mode, requestId: input.requestId },
  );

  if (!result.ok) {
    return result;
  }

  try {
    let raw = result.text.trim();
    if (raw.startsWith("```")) {
      raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    }
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      raw = jsonMatch[0];
    }
    const parsed = JSON.parse(raw) as {
      tags?: unknown;
      actionItems?: unknown;
      deadline?: unknown;
    };
    const tags = Array.isArray(parsed.tags) ? parsed.tags.map(String).filter(Boolean) : [];
    const actionItems = Array.isArray(parsed.actionItems)
      ? parsed.actionItems.map(String).filter(Boolean)
      : [];
    const deadline =
      typeof parsed.deadline === "string" && parsed.deadline.trim()
        ? parsed.deadline.trim()
        : undefined;

    return {
      ok: true,
      tags: tags.length > 0 ? tags : ["仅供参考"],
      actionItems,
      deadline,
      mode: result.mode,
    };
  } catch {
    const lines = result.text
      .split("\n")
      .map((l) => l.replace(/^[-*•\d.)\s]+/, "").trim())
      .filter(Boolean);
    return {
      ok: true,
      tags: lines.length > 0 ? ["待办事项"] : ["仅供参考"],
      actionItems: lines,
      mode: result.mode,
    };
  }
}

export async function taskRewrite(input: {
  text: string;
  tone: RewriteTone;
  userPersona?: string;
  mode?: AiMode;
  requestId?: string;
}): Promise<AiResult> {
  const cleaned = cleanContext(input.text, 6000);
  if (!cleaned.trim()) {
    return { ok: false, code: "EMPTY", error: "没有可改写的文本" };
  }
  return chatComplete(
    [
      { role: "system", content: systemForRewrite(input.tone, input.userPersona) },
      { role: "user", content: cleaned },
    ],
    { mode: input.mode, requestId: input.requestId },
  );
}

export async function taskCompose(input: {
  prompt: string;
  existingBody?: string;
  mode?: AiMode;
  requestId?: string;
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
    { mode: input.mode, requestId: input.requestId },
  );
}

export async function taskThreadSummary(input: {
  subject?: string;
  messages: { sender: string; date?: string; body: string }[];
  mode?: AiMode;
  requestId?: string;
}): Promise<ThreadSummaryResult> {
  if (!input.messages || input.messages.length === 0) {
    return { ok: false, code: "EMPTY", error: "没有可分析的邮件线索" };
  }

  const formattedMessages = input.messages
    .map((m, idx) => {
      const sender = m.sender || "未知发件人";
      const date = m.date ? ` (${m.date})` : "";
      const body = cleanContext(m.body, 3000);
      return `[Message #${idx + 1}] From: ${sender}${date}\n${body}`;
    })
    .join("\n\n---\n\n");

  const promptUser = `${input.subject ? `Thread Subject: ${input.subject}\n\n` : ""}${formattedMessages}`;

  const result = await chatComplete(
    [
      { role: "system", content: systemForThreadSummary() },
      { role: "user", content: promptUser },
    ],
    { mode: input.mode, requestId: input.requestId },
  );

  if (!result.ok) {
    return result;
  }

  try {
    let raw = result.text.trim();
    if (raw.startsWith("```")) {
      raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    }
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      raw = jsonMatch[0];
    }
    const parsed = JSON.parse(raw) as {
      summary?: unknown;
      timeline?: unknown;
    };
    const summary = typeof parsed.summary === "string" ? parsed.summary.trim() : "";
    const timeline: ThreadSummaryTimelineItem[] = Array.isArray(parsed.timeline)
      ? parsed.timeline
          .map((item: Record<string, unknown>) => ({
            sender: typeof item?.sender === "string" ? item.sender : "未知发件人",
            date:
              typeof item?.date === "string" && item.date.trim() ? item.date.trim() : undefined,
            point: typeof item?.point === "string" ? item.point.trim() : String(item || "").trim(),
          }))
          .filter((item) => Boolean(item.point))
      : [];

    return {
      ok: true,
      summary: summary || result.text,
      timeline,
      mode: result.mode,
    };
  } catch {
    return {
      ok: true,
      summary: result.text,
      timeline: input.messages.map((m) => ({
        sender: m.sender,
        date: m.date,
        point: cleanContext(m.body, 120),
      })),
      mode: result.mode,
    };
  }
}

export async function taskSuggestSplit(input: {
  subject?: string;
  sender?: string;
  from?: string;
  body: string;
  mode?: AiMode;
  requestId?: string;
}): Promise<SuggestSplitResult> {
  const from = input.from ?? input.sender;
  const ctx = buildMailContext({ subject: input.subject, from, body: input.body });
  const result = await chatComplete(
    [
      { role: "system", content: systemForSuggestSplit() },
      { role: "user", content: ctx },
    ],
    { mode: input.mode, requestId: input.requestId },
  );

  if (!result.ok) {
    return result;
  }

  try {
    let raw = result.text.trim();
    if (raw.startsWith("```")) {
      raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    }
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      raw = jsonMatch[0];
    }
    const parsed = JSON.parse(raw) as {
      split?: unknown;
      reason?: unknown;
      confidence?: unknown;
    };
    const split =
      parsed.split === "important" || parsed.split === "other" ? parsed.split : "important";
    const reason =
      typeof parsed.reason === "string" && parsed.reason.trim()
        ? parsed.reason.trim()
        : result.text.trim();
    const confidence =
      typeof parsed.confidence === "string" && parsed.confidence.trim()
        ? parsed.confidence.trim()
        : undefined;

    return {
      ok: true,
      split,
      reason,
      confidence,
      mode: result.mode,
    };
  } catch {
    return {
      ok: true,
      split: "important",
      reason: result.text.slice(0, 120) || "已完成分箱建议分析",
      mode: result.mode,
    };
  }
}

export async function taskTranslate(input: {
  text: string;
  targetLang?: "zh" | "en";
  mode?: AiMode;
  requestId?: string;
}): Promise<AiResult> {
  const cleaned = cleanContext(input.text, 6_000);
  if (!cleaned) {
    return { ok: false, code: "EMPTY", error: "待翻译文本为空" };
  }
  const targetLang = input.targetLang ?? "zh";
  const system = systemForTranslation(targetLang);
  return chatComplete(
    [
      { role: "system", content: system },
      { role: "user", content: cleaned },
    ],
    { mode: input.mode, requestId: input.requestId },
  );
}

export type UserPersonaResult =
  | {
      ok: true;
      personaSummary: string;
      toneStyle: string;
      greetingHabit: string;
      signoffHabit: string;
      keyTraits: string[];
      mode: AiMode;
    }
  | { ok: false; code: AiErrorCode; error: string };

export async function taskLearnUserTone(input: {
  sentSamples: string[];
  mode?: AiMode;
  requestId?: string;
}): Promise<UserPersonaResult> {
  if (!input.sentSamples || input.sentSamples.length === 0) {
    return { ok: false, code: "EMPTY", error: "发件箱中暂无足够的历史已发邮件供学习" };
  }
  const samplesText = input.sentSamples
    .slice(0, 10)
    .map((s, idx) => `--- 邮件样本 ${idx + 1} ---\n${cleanContext(s, 1000)}`)
    .join("\n\n");

  const result = await chatComplete(
    [
      { role: "system", content: systemForLearnUserTone() },
      { role: "user", content: `这是我最近发送的部分邮件样本，请分析并提取我的写作习惯与风格画像：\n\n${samplesText}` },
    ],
    { mode: input.mode, requestId: input.requestId },
  );

  if (!result.ok) return result;

  try {
    let raw = result.text.trim();
    if (raw.startsWith("```")) {
      raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    }
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) raw = jsonMatch[0];
    const parsed = JSON.parse(raw) as {
      personaSummary?: string;
      toneStyle?: string;
      greetingHabit?: string;
      signoffHabit?: string;
      keyTraits?: string[];
    };
    return {
      ok: true,
      personaSummary: parsed.personaSummary || "高效专业，表达清晰简练",
      toneStyle: parsed.toneStyle || "专业高效",
      greetingHabit: parsed.greetingHabit || "你好",
      signoffHabit: parsed.signoffHabit || "祝好",
      keyTraits:
        Array.isArray(parsed.keyTraits) && parsed.keyTraits.length > 0
          ? parsed.keyTraits.map(String)
          : ["表达精准", "重点清晰"],
      mode: result.mode,
    };
  } catch {
    return {
      ok: true,
      personaSummary: result.text.slice(0, 150) || "高效专业，表达清晰简练",
      toneStyle: "专业高效",
      greetingHabit: "你好",
      signoffHabit: "祝好",
      keyTraits: ["要点清晰", "措辞得体"],
      mode: result.mode,
    };
  }
}

export async function taskAnalyzeAttachment(input: {
  filename: string;
  contentType?: string;
  textContent?: string;
  base64Data?: string;
  mode?: AiMode;
  requestId?: string;
}): Promise<AiResult> {
  const docName = input.filename || "附件文档";
  const contentSnippet = cleanContext(
    input.textContent ||
      `[附件文件名: ${docName}, 类型: ${input.contentType || "未知"}]`,
    6000,
  );
  return chatComplete(
    [
      { role: "system", content: systemForAttachmentAnalysis() },
      { role: "user", content: `请分析附件《${docName}》的内容并提取要点：\n\n${contentSnippet}` },
    ],
    { mode: input.mode, requestId: input.requestId },
  );
}




