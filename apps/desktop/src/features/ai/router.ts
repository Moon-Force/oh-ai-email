import {
  aiAbort,
  aiActionItems,
  aiAnalyzeAttachment,
  aiCompose,
  aiDraftReply,
  aiQuickReply,
  aiRewrite,
  aiSuggestSplit,
  aiSummarize,
  aiThreadSummary,
  aiTranslate,
  hasDesktopApi,
  type AiTaskResult,
} from "../../lib/ipc";
import { useAiSettings, type AiMode } from "./settingsStore";
import { useAiAuditStore } from "./auditStore";

export type { AiMode };

export type AiRunOptions = {
  mode?: AiMode;
  requestId?: string;
};

export type ActionItemsData = {
  tags: string[];
  actionItems: string[];
  deadline?: string;
  mode: AiMode;
};

export type ThreadTimelineItem = {
  sender: string;
  date?: string;
  point: string;
};

export type ThreadSummaryData = {
  summary: string;
  timeline: { sender: string; date?: string; point: string }[];
  mode: AiMode;
};

export type SuggestSplitData = {
  split: "important" | "other";
  reason: string;
  confidence?: "high" | "medium" | "low" | string;
  mode: AiMode;
};

export type CommitmentItem = {
  direction: "i_promised" | "they_promised";
  text: string;
  deadline?: string;
};

export type ExtractCommitmentsResult = {
  commitments: CommitmentItem[];
};

export function extractCommitments(subject = "", body = ""): ExtractCommitmentsResult {
  const fullText = `${subject}\n${body}`.trim();
  if (!fullText) {
    return { commitments: [] };
  }

  const rawSentences = fullText
    .split(/[。！？\n.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 4);

  const commitments: CommitmentItem[] = [];
  const seen = new Set<string>();

  const deadlineRegex =
    /(?:(?:(?:本周|下周|周|星期)[一二三四五六日天](?:前|下午\d*点?|上午\d*点?|晚上|中午)?)|(?:\d{1,2}月\d{1,2}[号日](?:前)?)|(?:\d{4}-\d{2}-\d{2})|明天(?:前|下午\d*点?|上午\d*点?|晚上|中午)?|后天|今晚|下周|月底|周五前|截止[：:]?\s*[^，。]+|by\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|next week|\d{1,2}(?:st|nd|rd|th)?\s+[a-zA-Z]+|\d{4}-\d{2}-\d{2}))/i;

  const iPromisedPatterns = [
    /我(?:会|将|稍后|承诺|打算|负责|去办|来安排|会在)/i,
    /我们(?:会|将|承诺|稍后|来)/i,
    /我方(?:会|将|承诺|确认)/i,
    /I\s+will|I'll|I\s+promise|We\s+will|We'll|I\s+am\s+going\s+to|I\s+shall/i,
  ];

  const theyPromisedPatterns = [
    /你(?:说|提到|承诺|会|将|答应|负责|需要在)/i,
    /您(?:提到|承诺|会|将|答应|负责|请在|需要在)/i,
    /对方(?:承诺|答应|会|将)/i,
    /贵方(?:承诺|会|将)/i,
    /请于|请在|务必在|请于.*前/i,
    /You\s+promised|You\s+mentioned|You\s+will|Please\s+provide|Please\s+send/i,
  ];

  for (const s of rawSentences) {
    const isIPromised = iPromisedPatterns.some((p) => p.test(s));
    const isTheyPromised = !isIPromised && theyPromisedPatterns.some((p) => p.test(s));

    if (isIPromised || isTheyPromised) {
      const deadlineMatch = s.match(deadlineRegex);
      const deadline = deadlineMatch ? deadlineMatch[0].trim() : undefined;
      const direction: "i_promised" | "they_promised" = isIPromised
        ? "i_promised"
        : "they_promised";
      const key = `${direction}_${s}`;
      if (!seen.has(key)) {
        seen.add(key);
        commitments.push({
          direction,
          text: s,
          deadline,
        });
      }
    }
  }

  return { commitments };
}

export function createAiRequestId(): string {
  return `airq_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function cancelRequest(requestId: string): Promise<boolean> {
  if (!hasDesktopApi()) return true;
  return aiAbort(requestId);
}

export function cleanContext(text: string, maxLen = 6000): string {
  const withoutQuote = text
    .replace(/^>.*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return withoutQuote.slice(0, maxLen);
}

export function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export class AiRequestError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "AiRequestError";
  }
}

function unwrap(result: AiTaskResult): string {
  if (result.ok) return result.text;
  throw new AiRequestError(result.code, result.error);
}

function currentMode(override?: AiMode): AiMode {
  return override ?? useAiSettings.getState().mode;
}

function parseOptions(
  modeOrOpts?: AiMode | AiRunOptions,
  extraRequestId?: string
): { mode: AiMode; requestId?: string } {
  if (typeof modeOrOpts === "object" && modeOrOpts !== null) {
    return {
      mode: currentMode(modeOrOpts.mode),
      requestId: modeOrOpts.requestId ?? extraRequestId,
    };
  }
  return {
    mode: currentMode(modeOrOpts),
    requestId: extraRequestId,
  };
}

/** Browser/unit-test fallback only when not in Electron — clearly labeled, not silent fake success. */
function browserBlocked(): never {
  throw new AiRequestError(
    "CONFIG",
    "仅桌面端可调用 AI。请在 Electron 中运行，并到设置 → AI 配置密钥或 Ollama。"
  );
}

async function runWithAudit<T>(
  task: string,
  charCount: number,
  mode: AiMode,
  fn: () => Promise<T>
): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    useAiAuditStore.getState().recordCall({
      task,
      charCount,
      mode,
      durationMs: Date.now() - start,
      status: "success",
    });
    return result;
  } catch (err) {
    const isAborted = err instanceof AiRequestError && err.code === "ABORTED";
    useAiAuditStore.getState().recordCall({
      task,
      charCount,
      mode,
      durationMs: Date.now() - start,
      status: isAborted ? "aborted" : "error",
    });
    throw err;
  }
}

export type AiTextResponse = {
  text: string;
  reasoningContent?: string;
  mode: AiMode;
};

export async function summarizeDetailed(
  input: { subject?: string; from?: string; body: string } | string,
  modeOrOpts?: AiMode | AiRunOptions,
  requestId?: string
): Promise<AiTextResponse> {
  if (!hasDesktopApi()) browserBlocked();
  const { mode, requestId: reqId } = parseOptions(modeOrOpts, requestId);
  const payload =
    typeof input === "string"
      ? { body: input, mode, requestId: reqId }
      : { ...input, mode, requestId: reqId };
  const charCount =
    typeof input === "string"
      ? input.length
      : (input.body?.length ?? 0) + (input.subject?.length ?? 0);
  return runWithAudit("summarize", charCount, mode, async () => {
    const res = await aiSummarize(payload);
    if (res.ok) {
      return { text: res.text, reasoningContent: res.reasoningContent, mode: res.mode };
    }
    throw new AiRequestError(res.code, res.error);
  });
}

export async function summarize(
  input: { subject?: string; from?: string; body: string } | string,
  modeOrOpts?: AiMode | AiRunOptions,
  requestId?: string
): Promise<string> {
  const res = await summarizeDetailed(input, modeOrOpts, requestId);
  return res.text;
}

export async function draftReplyDetailed(
  input: { subject?: string; from?: string; body: string } | string,
  modeOrOpts?: AiMode | AiRunOptions,
  requestId?: string
): Promise<AiTextResponse> {
  if (!hasDesktopApi()) browserBlocked();
  const { mode, requestId: reqId } = parseOptions(modeOrOpts, requestId);
  const payload =
    typeof input === "string"
      ? { body: input, mode, requestId: reqId }
      : { ...input, mode, requestId: reqId };
  const charCount =
    typeof input === "string"
      ? input.length
      : (input.body?.length ?? 0) + (input.subject?.length ?? 0);
  return runWithAudit("draftReply", charCount, mode, async () => {
    const res = await aiDraftReply(payload);
    if (res.ok) {
      return { text: res.text, reasoningContent: res.reasoningContent, mode: res.mode };
    }
    throw new AiRequestError(res.code, res.error);
  });
}

export async function draftReply(
  input: { subject?: string; from?: string; body: string } | string,
  modeOrOpts?: AiMode | AiRunOptions,
  requestId?: string
): Promise<string> {
  const res = await draftReplyDetailed(input, modeOrOpts, requestId);
  return res.text;
}

export async function quickReplyDraft(
  input: {
    subject?: string;
    from?: string;
    body: string;
    replyType: string;
    customNote?: string;
  },
  modeOrOpts?: AiMode | AiRunOptions,
  requestId?: string
): Promise<string> {
  if (!hasDesktopApi()) browserBlocked();
  const { mode, requestId: reqId } = parseOptions(modeOrOpts, requestId);
  const charCount =
    (input.body?.length ?? 0) + (input.subject?.length ?? 0) + (input.customNote?.length ?? 0);
  return runWithAudit(`quickReply:${input.replyType}`, charCount, mode, async () => {
    return unwrap(
      await aiQuickReply({
        ...input,
        mode,
        requestId: reqId,
      })
    );
  });
}

export async function extractActionItems(
  input: { subject?: string; from?: string; body: string } | string,
  modeOrOpts?: AiMode | AiRunOptions,
  requestId?: string
): Promise<ActionItemsData> {
  if (!hasDesktopApi()) browserBlocked();
  const { mode, requestId: reqId } = parseOptions(modeOrOpts, requestId);
  const payload =
    typeof input === "string"
      ? { body: input, mode, requestId: reqId }
      : { ...input, mode, requestId: reqId };
  const charCount =
    typeof input === "string"
      ? input.length
      : (input.body?.length ?? 0) + (input.subject?.length ?? 0);
  return runWithAudit("actionItems", charCount, mode, async () => {
    const res = await aiActionItems(payload);
    if (res.ok) {
      return {
        tags: res.tags,
        actionItems: res.actionItems,
        deadline: res.deadline,
        mode: res.mode,
      };
    }
    throw new AiRequestError(res.code, res.error);
  });
}

export async function summarizeThread(
  messages: { sender: string; date?: string; body: string }[],
  subject?: string,
  modeOrOpts?: AiMode | AiRunOptions,
  requestId?: string
): Promise<ThreadSummaryData> {
  if (!hasDesktopApi()) browserBlocked();
  const { mode, requestId: reqId } = parseOptions(modeOrOpts, requestId);
  const charCount =
    messages.reduce((acc, m) => acc + (m.body?.length ?? 0), 0) + (subject?.length ?? 0);
  return runWithAudit("threadSummary", charCount, mode, async () => {
    const res = await aiThreadSummary({
      messages,
      subject,
      mode,
      requestId: reqId,
    });
    if (res.ok) {
      return {
        summary: res.summary,
        timeline: res.timeline,
        mode: res.mode,
      };
    }
    throw new AiRequestError(res.code, res.error);
  });
}

export async function suggestSplit(
  mail: { subject?: string; sender?: string; from?: string; body: string },
  modeOrOpts?: AiMode | AiRunOptions,
  requestId?: string
): Promise<SuggestSplitData> {
  if (!hasDesktopApi()) browserBlocked();
  const { mode, requestId: reqId } = parseOptions(modeOrOpts, requestId);
  const charCount = (mail.body?.length ?? 0) + (mail.subject?.length ?? 0);
  return runWithAudit("suggestSplit", charCount, mode, async () => {
    const res = await aiSuggestSplit({
      ...mail,
      mode,
      requestId: reqId,
    });
    if (res.ok) {
      return {
        split: res.split,
        reason: res.reason,
        confidence: res.confidence,
        mode: res.mode,
      };
    }
    throw new AiRequestError(res.code, res.error);
  });
}

export async function rewriteTone(
  text: string,
  tone: "shorter" | "formal" | "expand" | "persona",
  modeOrOpts?: AiMode | AiRunOptions,
  requestId?: string,
  userPersona?: string
): Promise<string> {
  if (!hasDesktopApi()) browserBlocked();
  const { mode, requestId: reqId } = parseOptions(modeOrOpts, requestId);
  const persona = userPersona || useAiSettings.getState().userPersona;
  return runWithAudit(`rewrite:${tone}`, text.length, mode, async () => {
    return unwrap(await aiRewrite({ text, tone, userPersona: persona, mode, requestId: reqId }));
  });
}

export async function analyzeAttachment(
  payload: {
    filename: string;
    contentType?: string;
    textContent?: string;
    base64Data?: string;
  },
  modeOrOpts?: AiMode | AiRunOptions,
  requestId?: string
): Promise<string> {
  if (!hasDesktopApi()) browserBlocked();
  const { mode, requestId: reqId } = parseOptions(modeOrOpts, requestId);
  const charCount = payload.textContent?.length ?? 100;
  return runWithAudit(`analyzeAttachment:${payload.filename}`, charCount, mode, async () => {
    return unwrap(
      await aiAnalyzeAttachment({
        ...payload,
        mode,
        requestId: reqId,
      })
    );
  });
}

export async function composeFromPrompt(
  prompt: string,
  existingBody?: string,
  modeOrOpts?: AiMode | AiRunOptions,
  requestId?: string
): Promise<string> {
  if (!hasDesktopApi()) browserBlocked();
  const { mode, requestId: reqId } = parseOptions(modeOrOpts, requestId);
  const charCount = prompt.length + (existingBody?.length ?? 0);
  return runWithAudit("compose", charCount, mode, async () => {
    return unwrap(await aiCompose({ prompt, existingBody, mode, requestId: reqId }));
  });
}

export async function translateText(
  text: string,
  targetLang: "zh" | "en" = "zh",
  modeOrOpts?: AiMode | AiRunOptions,
  requestId?: string
): Promise<string> {
  if (!hasDesktopApi()) browserBlocked();
  const { mode, requestId: reqId } = parseOptions(modeOrOpts, requestId);
  return runWithAudit(`translate:${targetLang}`, text.length, mode, async () => {
    return unwrap(await aiTranslate({ text, targetLang, mode, requestId: reqId }));
  });
}

export function ensureCloudPrivacyAck(): boolean {
  return useAiSettings.getState().cloudPrivacyAck;
}

export async function ackCloudPrivacy(): Promise<void> {
  useAiSettings.getState().setCloudPrivacyAck(true);
  await useAiSettings.getState().save();
}
