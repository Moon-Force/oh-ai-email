import {
  aiAbort,
  aiCompose,
  aiDraftReply,
  aiRewrite,
  aiSummarize,
  hasDesktopApi,
  type AiTaskResult,
} from "../../lib/ipc";
import { useAiSettings, type AiMode } from "./settingsStore";

export type { AiMode };

export type AiRunOptions = {
  mode?: AiMode;
  requestId?: string;
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
  return unwrap(await aiSummarize(payload));
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
  return unwrap(await aiDraftReply(payload));
}

export async function rewriteTone(
  text: string,
  tone: "shorter" | "formal" | "expand",
  modeOrOpts?: AiMode | AiRunOptions,
  requestId?: string,
): Promise<string> {
  if (!hasDesktopApi()) browserBlocked();
  const { mode, requestId: reqId } = parseOptions(modeOrOpts, requestId);
  return unwrap(await aiRewrite({ text, tone, mode, requestId: reqId }));
}

export async function composeFromPrompt(
  prompt: string,
  existingBody?: string,
  modeOrOpts?: AiMode | AiRunOptions,
  requestId?: string,
): Promise<string> {
  if (!hasDesktopApi()) browserBlocked();
  const { mode, requestId: reqId } = parseOptions(modeOrOpts, requestId);
  return unwrap(
    await aiCompose({ prompt, existingBody, mode, requestId: reqId }),
  );
}

export function ensureCloudPrivacyAck(): boolean {
  return useAiSettings.getState().cloudPrivacyAck;
}

export async function ackCloudPrivacy(): Promise<void> {
  useAiSettings.getState().setCloudPrivacyAck(true);
  await useAiSettings.getState().save();
}
