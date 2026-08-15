import {
  aiAbort,
  aiActionItems,
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
  extraRequestId?: string,
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
    "仅桌面端可调用 AI。请在 Electron 中运行，并到设置 → AI 配置密钥或 Ollama。",
  );
}

async function runWithAudit<T>(
  task: string,
  charCount: number,
  mode: AiMode,
  fn: () => Promise<T>,
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

export async function summarize(
  input: { subject?: string; from?: string; body: string } | string,
  modeOrOpts?: AiMode | AiRunOptions,
  requestId?: string,
): Promise<string> {
  if (!hasDesktopApi()) browserBlocked();
  const { mode, requestId: reqId } = parseOptions(modeOrOpts, requestId);
  const payload =
    typeof input === "string"
      ? { body: input, mode, requestId: reqId }
      : { ...input, mode, requestId: reqId };
  const charCount = typeof input === "string" ? input.length : (input.body?.length ?? 0) + (input.subject?.length ?? 0);
  return runWithAudit("summarize", charCount, mode, async () => {
    return unwrap(await aiSummarize(payload));
  });
}

export async function draftReply(
  input: { subject?: string; from?: string; body: string } | string,
  modeOrOpts?: AiMode | AiRunOptions,
  requestId?: string,
): Promise<string> {
  if (!hasDesktopApi()) browserBlocked();
  const { mode, requestId: reqId } = parseOptions(modeOrOpts, requestId);
  const payload =
    typeof input === "string"
      ? { body: input, mode, requestId: reqId }
      : { ...input, mode, requestId: reqId };
  const charCount = typeof input === "string" ? input.length : (input.body?.length ?? 0) + (input.subject?.length ?? 0);
  return runWithAudit("draftReply", charCount, mode, async () => {
    return unwrap(await aiDraftReply(payload));
  });
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
  requestId?: string,
): Promise<string> {
  if (!hasDesktopApi()) browserBlocked();
  const { mode, requestId: reqId } = parseOptions(modeOrOpts, requestId);
  const charCount = (input.body?.length ?? 0) + (input.subject?.length ?? 0) + (input.customNote?.length ?? 0);
  return runWithAudit(`quickReply:${input.replyType}`, charCount, mode, async () => {
    return unwrap(
      await aiQuickReply({
        ...input,
        mode,
        requestId: reqId,
      }),
    );
  });
}

export async function extractActionItems(
  input: { subject?: string; from?: string; body: string } | string,
  modeOrOpts?: AiMode | AiRunOptions,
  requestId?: string,
): Promise<ActionItemsData> {
  if (!hasDesktopApi()) browserBlocked();
  const { mode, requestId: reqId } = parseOptions(modeOrOpts, requestId);
  const payload =
    typeof input === "string"
      ? { body: input, mode, requestId: reqId }
      : { ...input, mode, requestId: reqId };
  const charCount = typeof input === "string" ? input.length : (input.body?.length ?? 0) + (input.subject?.length ?? 0);
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
  requestId?: string,
): Promise<ThreadSummaryData> {
  if (!hasDesktopApi()) browserBlocked();
  const { mode, requestId: reqId } = parseOptions(modeOrOpts, requestId);
  const charCount = messages.reduce((acc, m) => acc + (m.body?.length ?? 0), 0) + (subject?.length ?? 0);
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
  requestId?: string,
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
  tone: "shorter" | "formal" | "expand",
  modeOrOpts?: AiMode | AiRunOptions,
  requestId?: string,
): Promise<string> {
  if (!hasDesktopApi()) browserBlocked();
  const { mode, requestId: reqId } = parseOptions(modeOrOpts, requestId);
  return runWithAudit(`rewrite:${tone}`, text.length, mode, async () => {
    return unwrap(await aiRewrite({ text, tone, mode, requestId: reqId }));
  });
}

export async function composeFromPrompt(
  prompt: string,
  existingBody?: string,
  modeOrOpts?: AiMode | AiRunOptions,
  requestId?: string,
): Promise<string> {
  if (!hasDesktopApi()) browserBlocked();
  const { mode, requestId: reqId } = parseOptions(modeOrOpts, requestId);
  const charCount = prompt.length + (existingBody?.length ?? 0);
  return runWithAudit("compose", charCount, mode, async () => {
    return unwrap(
      await aiCompose({ prompt, existingBody, mode, requestId: reqId }),
    );
  });
}

export async function translateText(
  text: string,
  targetLang: "zh" | "en" = "zh",
  modeOrOpts?: AiMode | AiRunOptions,
  requestId?: string,
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
