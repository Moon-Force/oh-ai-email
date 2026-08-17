import { getCloudApiKey, getEffectiveCloudApiKey, loadAiSettings, type AiMode } from "./settings";
import { redactSensitiveData, restoreRedactedData } from "./clean";

export type ToolDefinition = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
};

export type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
};

export type AiErrorCode =
  "NO_KEY" | "OLLAMA_DOWN" | "TIMEOUT" | "ABORTED" | "HTTP" | "EMPTY" | "NETWORK" | "CONFIG";

export type AiResult =
  | {
      ok: true;
      text: string;
      reasoningContent?: string;
      toolCalls?: ToolCall[];
      finishReason?: string;
      mode: AiMode;
    }
  | { ok: false; code: AiErrorCode; error: string };

const DEFAULT_TIMEOUT_MS = 120_000;

function withTimeout(ms: number): AbortSignal {
  return AbortSignal.timeout(ms);
}

const activeControllers = new Map<string, AbortController>();

export function abortAiRequest(requestId: string): boolean {
  const controller = activeControllers.get(requestId);
  if (controller) {
    controller.abort();
    activeControllers.delete(requestId);
    return true;
  }
  return false;
}

export type StreamChunkCallback = (chunk: {
  reasoningChunk?: string;
  contentChunk?: string;
}) => void;

export async function chatComplete(
  messages: ChatMessage[],
  opts?: {
    mode?: AiMode;
    timeoutMs?: number;
    requestId?: string;
    onChunk?: StreamChunkCallback;
    tools?: ToolDefinition[];
    autoContinue?: boolean;
    maxAutoContinues?: number;
  }
): Promise<AiResult> {
  const settings = loadAiSettings();
  const mode = opts?.mode ?? settings.mode;
  const timeoutMs =
    opts?.timeoutMs ??
    (settings.timeoutSeconds ? settings.timeoutSeconds * 1000 : DEFAULT_TIMEOUT_MS);
  const requestId = opts?.requestId;
  const onChunk = opts?.onChunk;
  const tools = opts?.tools;
  const autoContinue = opts?.autoContinue ?? true;
  const maxAutoContinues = opts?.maxAutoContinues ?? 3;

  const controller = new AbortController();
  if (requestId) {
    activeControllers.set(requestId, controller);
  }

  const timeoutSignal = withTimeout(timeoutMs);
  let combinedSignal = controller.signal;
  if (typeof AbortSignal.any === "function") {
    combinedSignal = AbortSignal.any([controller.signal, timeoutSignal]);
  } else {
    const comb = new AbortController();
    const abortHandler = () => comb.abort();
    controller.signal.addEventListener("abort", abortHandler, { once: true });
    timeoutSignal.addEventListener("abort", abortHandler, { once: true });
    combinedSignal = comb.signal;
  }

  try {
    if (mode === "local") {
      return await callOllama(
        messages,
        settings.ollamaHost,
        settings.ollamaModel,
        combinedSignal,
        controller.signal,
        onChunk,
        tools
      );
    }
    const key = getEffectiveCloudApiKey() || getCloudApiKey();
    if (!key) {
      return {
        ok: false,
        code: "NO_KEY",
        error: "未配置云端 API Key，请到设置 → AI 中新建或选择一个云端配置并填写密钥",
      };
    }

    let outgoingMessages = messages;
    const combinedReplacements: Record<string, string> = {};
    if (settings.redactSensitiveData) {
      outgoingMessages = messages.map((m) => {
        if (!m.content) return m;
        const { text, replacements } = redactSensitiveData(m.content);
        Object.assign(combinedReplacements, replacements);
        return { ...m, content: text };
      });
    }

    let res = await callOpenAiCompatible(
      outgoingMessages,
      settings.baseUrl,
      key,
      settings.model,
      combinedSignal,
      controller.signal,
      onChunk,
      settings.reasoningEffort,
      tools,
      settings.maxTokens
    );

    // Auto-Continue loop for length-truncated completions
    let continueCount = 0;
    let accumulatedText = res.ok ? res.text : "";
    while (
      res.ok &&
      autoContinue &&
      res.finishReason === "length" &&
      (!res.toolCalls || res.toolCalls.length === 0) &&
      continueCount < maxAutoContinues &&
      !controller.signal.aborted
    ) {
      continueCount++;
      const continueMessages: ChatMessage[] = [
        ...outgoingMessages,
        { role: "assistant", content: accumulatedText },
        {
          role: "user",
          content:
            "请直接紧接着上面未完成的内容继续输出，严禁重复前面的任何内容，保持内容格式与上下文连贯。",
        },
      ];

      const continueRes = await callOpenAiCompatible(
        continueMessages,
        settings.baseUrl,
        key,
        settings.model,
        combinedSignal,
        controller.signal,
        onChunk,
        settings.reasoningEffort,
        tools,
        settings.maxTokens
      );

      if (!continueRes.ok) break;

      accumulatedText += continueRes.text;
      res = {
        ...continueRes,
        text: accumulatedText,
      };
    }

    if (res.ok && settings.redactSensitiveData && Object.keys(combinedReplacements).length > 0) {
      return {
        ...res,
        text: restoreRedactedData(res.text, combinedReplacements),
      };
    }
    return res;
  } catch (e) {
    if (controller.signal.aborted) {
      return { ok: false, code: "ABORTED", error: "已取消 AI 请求" };
    }
    if (timeoutSignal.aborted || isTimeoutError(e)) {
      const timeoutSec = Math.round(timeoutMs / 1000);
      return { ok: false, code: "TIMEOUT", error: `AI 请求超时（${timeoutSec}s），请稍后重试` };
    }
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, code: "NETWORK", error: msg };
  } finally {
    if (requestId) {
      activeControllers.delete(requestId);
    }
  }
}

function isTimeoutError(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;
  const name = (e as { name?: string }).name;
  return name === "TimeoutError" || name === "AbortError";
}

async function callOpenAiCompatible(
  messages: ChatMessage[],
  baseUrl: string,
  apiKey: string,
  model: string,
  signal: AbortSignal,
  userAbortSignal?: AbortSignal,
  onChunk?: StreamChunkCallback,
  reasoningEffort: "low" | "medium" | "high" = "medium",
  tools?: ToolDefinition[],
  maxTokens = 32768
): Promise<AiResult> {
  const url = `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
  const isStreaming = Boolean(onChunk);
  let res: Response;
  try {
    const payloadBody: Record<string, unknown> = {
      model,
      messages,
      temperature: 0.4,
      max_tokens: maxTokens,
      max_completion_tokens: maxTokens,
      stream: isStreaming,
    };
    if (reasoningEffort) {
      payloadBody.reasoning_effort = reasoningEffort;
    }
    if (tools && tools.length > 0) {
      payloadBody.tools = tools;
      payloadBody.tool_choice = "auto";
    }

    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payloadBody),
      signal,
    });
  } catch (e) {
    if (userAbortSignal?.aborted) {
      return { ok: false, code: "ABORTED", error: "已取消 AI 请求" };
    }
    throw e;
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const snippet = body.slice(0, 200);
    if (res.status === 401 || res.status === 403) {
      return { ok: false, code: "NO_KEY", error: `云端鉴权失败（${res.status}），请检查 API Key` };
    }
    return {
      ok: false,
      code: "HTTP",
      error: `云端请求失败 HTTP ${res.status}${snippet ? `：${snippet}` : ""}`,
    };
  }

  if (isStreaming && res.body) {
    let fullText = "";
    let fullReasoning = "";
    let finishReason: string | undefined;
    const toolCallsAccumulator = new Map<number, { id: string; name: string; arguments: string }>();
    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data:")) continue;
          const jsonStr = trimmed.slice(5).trim();
          if (jsonStr === "[DONE]") continue;

          try {
            const parsed = JSON.parse(jsonStr) as {
              choices?: Array<{
                finish_reason?: string;
                delta?: {
                  content?: string;
                  reasoning_content?: string;
                  reasoning?: string;
                  tool_calls?: Array<{
                    index?: number;
                    id?: string;
                    function?: {
                      name?: string;
                      arguments?: string;
                    };
                  }>;
                };
              }>;
            };
            if (parsed.choices?.[0]?.finish_reason) {
              finishReason = parsed.choices[0].finish_reason;
            }
            const delta = parsed.choices?.[0]?.delta;
            if (!delta) continue;

            const reasoningChunk = delta.reasoning_content || delta.reasoning;
            const contentChunk = delta.content;

            if (reasoningChunk) {
              fullReasoning += reasoningChunk;
              onChunk?.({ reasoningChunk });
            }
            if (contentChunk) {
              fullText += contentChunk;
              onChunk?.({ contentChunk });
            }
            if (delta.tool_calls) {
              for (const tc of delta.tool_calls) {
                const idx = tc.index ?? 0;
                let existing = toolCallsAccumulator.get(idx);
                if (!existing) {
                  existing = {
                    id: tc.id || `call_${idx}_${Date.now()}`,
                    name: "",
                    arguments: "",
                  };
                  toolCallsAccumulator.set(idx, existing);
                }
                if (tc.id) existing.id = tc.id;
                if (tc.function?.name) {
                  if (!existing.name) {
                    existing.name = tc.function.name;
                  } else if (existing.name === tc.function.name) {
                    // Repeated full name chunk, do nothing
                  } else if (tc.function.name.startsWith(existing.name)) {
                    existing.name = tc.function.name;
                  } else if (!existing.name.endsWith(tc.function.name)) {
                    existing.name += tc.function.name;
                  }
                }
                if (tc.function?.arguments) existing.arguments += tc.function.arguments;
              }
            }
          } catch {
            // ignore partial json
          }
        }
      }
    } catch (e) {
      if (userAbortSignal?.aborted) {
        return { ok: false, code: "ABORTED", error: "已取消 AI 请求" };
      }
    }

    const text = fullText.trim();
    const reasoningContent = fullReasoning.trim() || undefined;
    const streamedToolCalls: ToolCall[] = Array.from(toolCallsAccumulator.values())
      .filter((tc) => Boolean(tc.name))
      .map((tc) => ({
        id: tc.id,
        type: "function",
        function: {
          name: tc.name,
          arguments: tc.arguments,
        },
      }));

    if (!text && !reasoningContent && streamedToolCalls.length === 0) {
      return { ok: false, code: "EMPTY", error: "模型返回为空" };
    }
    return {
      ok: true,
      text:
        text || (streamedToolCalls.length > 0 ? "" : reasoningContent ? "已完成思考分析。" : ""),
      reasoningContent,
      toolCalls: streamedToolCalls.length > 0 ? streamedToolCalls : undefined,
      finishReason,
      mode: "cloud",
    };
  }

  const data = (await res.json()) as {
    choices?: {
      finish_reason?: string;
      message?: {
        content?: string;
        reasoning_content?: string;
        reasoning?: string;
        tool_calls?: Array<{
          id?: string;
          type?: string;
          function?: {
            name?: string;
            arguments?: string | Record<string, unknown>;
          };
        }>;
      };
    }[];
  };
  const msgObj = data.choices?.[0]?.message;
  const finishReason = data.choices?.[0]?.finish_reason;
  const text = msgObj?.content?.trim() ?? "";
  const reasoningContent = (msgObj?.reasoning_content || msgObj?.reasoning)?.trim() || undefined;
  const rawToolCalls = msgObj?.tool_calls;
  const parsedToolCalls: ToolCall[] = Array.isArray(rawToolCalls)
    ? rawToolCalls
        .filter((tc) => Boolean(tc.function?.name))
        .map((tc) => ({
          id: tc.id || `call_${Math.random().toString(36).slice(2, 7)}`,
          type: "function",
          function: {
            name: tc.function?.name || "",
            arguments:
              typeof tc.function?.arguments === "string"
                ? tc.function.arguments
                : JSON.stringify(tc.function?.arguments || {}),
          },
        }))
    : [];

  if (!text && !reasoningContent && parsedToolCalls.length === 0) {
    return { ok: false, code: "EMPTY", error: "模型返回为空" };
  }
  return {
    ok: true,
    text: text || (parsedToolCalls.length > 0 ? "" : reasoningContent ? "已完成思考分析。" : ""),
    reasoningContent,
    toolCalls: parsedToolCalls.length > 0 ? parsedToolCalls : undefined,
    finishReason,
    mode: "cloud",
  };
}

async function callOllama(
  messages: ChatMessage[],
  host: string,
  model: string,
  signal: AbortSignal,
  userAbortSignal?: AbortSignal,
  onChunk?: StreamChunkCallback,
  tools?: ToolDefinition[]
): Promise<AiResult> {
  const base = host.replace(/\/+$/, "");
  const url = `${base}/api/chat`;
  const isStreaming = Boolean(onChunk);
  let res: Response;
  try {
    const bodyPayload: Record<string, unknown> = {
      model,
      messages,
      stream: isStreaming,
      options: { temperature: 0.4 },
    };
    if (tools && tools.length > 0) {
      bodyPayload.tools = tools;
    }

    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bodyPayload),
      signal,
    });
  } catch (e) {
    if (userAbortSignal?.aborted) {
      return { ok: false, code: "ABORTED", error: "已取消 AI 请求" };
    }
    if (isTimeoutError(e)) {
      return { ok: false, code: "TIMEOUT", error: "本机 Ollama 请求超时（60s）" };
    }
    return {
      ok: false,
      code: "OLLAMA_DOWN",
      error: "无法连接本机 Ollama。请确认已安装并运行（默认 http://127.0.0.1:11434）",
    };
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return {
      ok: false,
      code: "OLLAMA_DOWN",
      error: `Ollama 返回 HTTP ${res.status}${body ? `：${body.slice(0, 160)}` : ""}`,
    };
  }

  if (isStreaming && res.body) {
    let fullText = "";
    let fullReasoning = "";
    const toolCallsAccumulator: ToolCall[] = [];
    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const parsed = JSON.parse(trimmed) as {
              message?: {
                content?: string;
                reasoning_content?: string;
                tool_calls?: Array<{
                  function?: {
                    name?: string;
                    arguments?: string | Record<string, unknown>;
                  };
                }>;
              };
            };
            const msg = parsed.message;
            if (!msg) continue;
            if (msg.reasoning_content) {
              fullReasoning += msg.reasoning_content;
              onChunk?.({ reasoningChunk: msg.reasoning_content });
            }
            if (msg.content) {
              fullText += msg.content;
              onChunk?.({ contentChunk: msg.content });
            }
            if (msg.tool_calls && Array.isArray(msg.tool_calls)) {
              for (const tc of msg.tool_calls) {
                if (tc.function?.name) {
                  toolCallsAccumulator.push({
                    id: `ollama_call_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                    type: "function",
                    function: {
                      name: tc.function.name,
                      arguments:
                        typeof tc.function.arguments === "string"
                          ? tc.function.arguments
                          : JSON.stringify(tc.function.arguments || {}),
                    },
                  });
                }
              }
            }
          } catch {
            // ignore
          }
        }
      }
    } catch (e) {
      if (userAbortSignal?.aborted) {
        return { ok: false, code: "ABORTED", error: "已取消 AI 请求" };
      }
    }

    const text = fullText.trim();
    const reasoningContent = fullReasoning.trim() || undefined;
    if (!text && !reasoningContent && toolCallsAccumulator.length === 0)
      return { ok: false, code: "EMPTY", error: "Ollama 返回为空（请检查模型名是否已 pull）" };
    return {
      ok: true,
      text,
      reasoningContent,
      toolCalls: toolCallsAccumulator.length > 0 ? toolCallsAccumulator : undefined,
      mode: "local",
    };
  }

  const data = (await res.json()) as {
    message?: {
      content?: string;
      tool_calls?: Array<{
        function?: {
          name?: string;
          arguments?: string | Record<string, unknown>;
        };
      }>;
    };
  };
  const text = data.message?.content?.trim() ?? "";
  const ollamaToolCalls: ToolCall[] = Array.isArray(data.message?.tool_calls)
    ? data.message.tool_calls
        .filter((tc) => Boolean(tc.function?.name))
        .map((tc) => ({
          id: `ollama_call_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          type: "function",
          function: {
            name: tc.function?.name || "",
            arguments:
              typeof tc.function?.arguments === "string"
                ? tc.function.arguments
                : JSON.stringify(tc.function?.arguments || {}),
          },
        }))
    : [];

  if (!text && ollamaToolCalls.length === 0)
    return { ok: false, code: "EMPTY", error: "Ollama 返回为空（请检查模型名是否已 pull）" };
  return {
    ok: true,
    text,
    toolCalls: ollamaToolCalls.length > 0 ? ollamaToolCalls : undefined,
    mode: "local",
  };
}

export async function probeOllama(): Promise<
  { ok: true; models: string[] } | { ok: false; error: string }
> {
  const { ollamaHost } = loadAiSettings();
  const base = ollamaHost.replace(/\/+$/, "");
  try {
    const res = await fetch(`${base}/api/tags`, { signal: withTimeout(5_000) });
    if (!res.ok) return { ok: false, error: `Ollama HTTP ${res.status}` };
    const data = (await res.json()) as { models?: { name?: string }[] };
    const models = (data.models ?? []).map((m) => m.name || "").filter(Boolean);
    return { ok: true, models };
  } catch {
    return { ok: false, error: "无法连接 Ollama" };
  }
}

export async function probeCloud(): Promise<
  { ok: true } | { ok: false; error: string; code: AiErrorCode }
> {
  const settings = loadAiSettings();
  const key = getEffectiveCloudApiKey() || getCloudApiKey();
  if (!key) return { ok: false, code: "NO_KEY", error: "未配置 API Key" };
  // Lightweight models list if available; otherwise a tiny chat is too expensive — just HEAD/models
  try {
    const url = `${settings.baseUrl.replace(/\/+$/, "")}/models`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${key}` },
      signal: withTimeout(15_000),
    });
    if (res.ok || res.status === 404) {
      // Some proxies don't implement /models; 404 still means we reached the host with auth
      if (res.status === 401 || res.status === 403) {
        return { ok: false, code: "NO_KEY", error: "API Key 无效" };
      }
      if (res.ok) return { ok: true };
    }
    if (res.status === 401 || res.status === 403) {
      return { ok: false, code: "NO_KEY", error: "API Key 无效" };
    }
    // Fallback: tiny completion probe only if models failed hard
    if (!res.ok && res.status !== 404) {
      const r = await chatComplete(
        [
          { role: "system", content: "Reply with OK only." },
          { role: "user", content: "ping" },
        ],
        { mode: "cloud", timeoutMs: 20_000 }
      );
      if (r.ok) return { ok: true };
      return { ok: false, code: r.code, error: r.error };
    }
    return { ok: true };
  } catch (e) {
    if (isTimeoutError(e)) return { ok: false, code: "TIMEOUT", error: "探测超时" };
    return { ok: false, code: "NETWORK", error: e instanceof Error ? e.message : String(e) };
  }
}

export {
  fetchRemoteModels,
  fetchSttModels,
  fetchTtsModels,
  fetchAccountBalance,
  synthesizeSpeechMiMo,
  transcribeAudioOpenAi,
} from "./providers/openai";
