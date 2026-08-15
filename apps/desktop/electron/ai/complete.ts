import { getCloudApiKey, loadAiSettings, type AiMode } from "./settings";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type AiErrorCode =
  | "NO_KEY"
  | "OLLAMA_DOWN"
  | "TIMEOUT"
  | "HTTP"
  | "EMPTY"
  | "NETWORK"
  | "CONFIG";

export type AiResult =
  | { ok: true; text: string; mode: AiMode }
  | { ok: false; code: AiErrorCode; error: string };

const DEFAULT_TIMEOUT_MS = 60_000;

function withTimeout(ms: number): AbortSignal {
  return AbortSignal.timeout(ms);
}

export async function chatComplete(
  messages: ChatMessage[],
  opts?: { mode?: AiMode; timeoutMs?: number },
): Promise<AiResult> {
  const settings = loadAiSettings();
  const mode = opts?.mode ?? settings.mode;
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  try {
    if (mode === "local") {
      return await callOllama(messages, settings.ollamaHost, settings.ollamaModel, timeoutMs);
    }
    const key = getCloudApiKey();
    if (!key) {
      return {
        ok: false,
        code: "NO_KEY",
        error: "未配置云端 API Key，请到设置 → AI 中填写 OpenAI 兼容密钥",
      };
    }
    return await callOpenAiCompatible(
      messages,
      settings.baseUrl,
      key,
      settings.model,
      timeoutMs,
    );
  } catch (e) {
    if (isTimeoutError(e)) {
      return { ok: false, code: "TIMEOUT", error: "AI 请求超时（60s），请稍后重试" };
    }
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, code: "NETWORK", error: msg };
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
  timeoutMs: number,
): Promise<AiResult> {
  const url = `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.4,
    }),
    signal: withTimeout(timeoutMs),
  });

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

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = data.choices?.[0]?.message?.content?.trim() ?? "";
  if (!text) return { ok: false, code: "EMPTY", error: "模型返回为空" };
  return { ok: true, text, mode: "cloud" };
}

async function callOllama(
  messages: ChatMessage[],
  host: string,
  model: string,
  timeoutMs: number,
): Promise<AiResult> {
  const base = host.replace(/\/+$/, "");
  const url = `${base}/api/chat`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        options: { temperature: 0.4 },
      }),
      signal: withTimeout(timeoutMs),
    });
  } catch (e) {
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

  const data = (await res.json()) as { message?: { content?: string } };
  const text = data.message?.content?.trim() ?? "";
  if (!text) return { ok: false, code: "EMPTY", error: "Ollama 返回为空（请检查模型名是否已 pull）" };
  return { ok: true, text, mode: "local" };
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

export async function probeCloud(): Promise<{ ok: true } | { ok: false; error: string; code: AiErrorCode }> {
  const settings = loadAiSettings();
  const key = getCloudApiKey();
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
        { mode: "cloud", timeoutMs: 20_000 },
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
