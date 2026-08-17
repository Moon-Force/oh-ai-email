import { getCloudApiKey, getSttApiKey, getTtsApiKey, type AiSettingsRecord } from "../settings";

export type BalanceInfo = {
  currency: string;
  total_balance: string;
  granted_balance: string;
  topped_up_balance: string;
};

export type AccountBalanceResult =
  | {
      ok: true;
      isAvailable: boolean;
      balanceInfos: BalanceInfo[];
    }
  | {
      ok: false;
      error: string;
    };

export type RemoteModelsResult =
  | {
      ok: true;
      models: string[];
    }
  | {
      ok: false;
      error: string;
    };

export type SpeechSynthesisResult =
  | {
      ok: true;
      audioData: string; // base64 data url
    }
  | {
      ok: false;
      error: string;
    };

export type AudioTranscriptionResult =
  | {
      ok: true;
      text: string;
    }
  | {
      ok: false;
      error: string;
    };

function withTimeout(ms: number): AbortSignal {
  return AbortSignal.timeout(ms);
}

/**
 * Fetches the list of available models from Ollama (local) or OpenAI/DeepSeek/MiMo (cloud).
 */
export async function fetchRemoteModels(settings: AiSettingsRecord): Promise<RemoteModelsResult> {
  if (settings.mode === "local") {
    const base = settings.ollamaHost.replace(/\/+$/, "");
    try {
      const res = await fetch(`${base}/api/tags`, { signal: withTimeout(8_000) });
      if (!res.ok) {
        return { ok: false, error: `Ollama 服务响应 HTTP ${res.status}` };
      }
      const data = (await res.json()) as { models?: { name?: string }[] };
      const models = (data.models ?? []).map((m) => m.name || "").filter(Boolean);
      return { ok: true, models };
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : "无法连接本地 Ollama 服务",
      };
    }
  }

  // Cloud mode
  const key = getCloudApiKey();
  if (!key) {
    return { ok: false, error: "未配置云端 API Key" };
  }

  const base = settings.baseUrl.replace(/\/+$/, "");
  const url = `${base}/models`;

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${key}`,
      },
      signal: withTimeout(12_000),
    });

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        return { ok: false, error: "API Key 无效或鉴权失败" };
      }
      return { ok: false, error: `模型列表获取失败 (HTTP ${res.status})` };
    }

    const data = (await res.json()) as {
      data?: Array<{ id?: string; name?: string }>;
      models?: Array<{ id?: string; name?: string }>;
    };

    const rawList = data.data || data.models || [];
    const models = rawList
      .map((item) => item.id || item.name || "")
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));

    if (models.length === 0) {
      // Fallback presets if empty list returned
      if (base.includes("deepseek")) {
        return { ok: true, models: ["deepseek-chat", "deepseek-reasoner"] };
      }
      if (base.includes("mimo") || base.includes("xiaomi")) {
        return { ok: true, models: ["mimo-v2.5", "mimo-v2", "mimo-tts"] };
      }
    }

    return { ok: true, models };
  } catch (e) {
    // If endpoint failed, provide fallback known models for DeepSeek/MiMo
    if (base.includes("deepseek")) {
      return { ok: true, models: ["deepseek-chat", "deepseek-reasoner"] };
    }
    if (base.includes("mimo") || base.includes("xiaomi")) {
      return { ok: true, models: ["mimo-v2.5", "mimo-v2"] };
    }
    return {
      ok: false,
      error: e instanceof Error ? e.message : "获取远程模型列表超时或网络错误",
    };
  }
}

/**
 * Queries account balance info (DeepSeek / standard cloud balance endpoints).
 */
export async function fetchAccountBalance(
  settings: AiSettingsRecord
): Promise<AccountBalanceResult> {
  const key = getCloudApiKey();
  if (!key) {
    return { ok: false, error: "未配置云端 API Key，无法查询余额" };
  }

  const base = settings.baseUrl.replace(/\/+$/, "");
  // Standard DeepSeek balance endpoint: /user/balance
  const url = `${base}/user/balance`;

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      signal: withTimeout(10_000),
    });

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        return { ok: false, error: "API Key 无效或无余额查询权限" };
      }
      if (res.status === 404) {
        return {
          ok: false,
          error: "当前 Provider 不支持 /user/balance 余额查询接口",
        };
      }
      return { ok: false, error: `查询余额失败 HTTP ${res.status}` };
    }

    const data = (await res.json()) as {
      is_available?: boolean;
      balance_infos?: Array<{
        currency?: string;
        total_balance?: string | number;
        granted_balance?: string | number;
        topped_up_balance?: string | number;
      }>;
      // Fallback format
      total_balance?: string | number;
      currency?: string;
    };

    if (Array.isArray(data.balance_infos)) {
      const balanceInfos: BalanceInfo[] = data.balance_infos.map((item) => ({
        currency: String(item.currency || "CNY"),
        total_balance: String(item.total_balance ?? "0.00"),
        granted_balance: String(item.granted_balance ?? "0.00"),
        topped_up_balance: String(item.topped_up_balance ?? "0.00"),
      }));

      return {
        ok: true,
        isAvailable: data.is_available ?? true,
        balanceInfos,
      };
    }

    if (data.total_balance !== undefined) {
      return {
        ok: true,
        isAvailable: true,
        balanceInfos: [
          {
            currency: String(data.currency || "CNY"),
            total_balance: String(data.total_balance),
            granted_balance: "0.00",
            topped_up_balance: String(data.total_balance),
          },
        ],
      };
    }

    return {
      ok: false,
      error: "未能解析余额返回数据格式",
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "连接余额查询接口超时或失败",
    };
  }
}

/**
 * Synthesize speech via OpenAI / Xiaomi MiMo speech endpoint.
 */
export async function synthesizeSpeechMiMo(
  text: string,
  voice?: string,
  settings?: AiSettingsRecord
): Promise<SpeechSynthesisResult> {
  const key = getTtsApiKey() || getCloudApiKey();
  if (!key) {
    return { ok: false, error: "未配置 API Key，无法使用云端语音合成" };
  }

  const base = (settings?.ttsBaseUrl || settings?.baseUrl || "https://api.openai.com/v1").replace(/\/+$/, "");
  const url = `${base}/audio/speech`;
  const model =
    settings?.ttsModel ||
    (settings?.model && settings.model.includes("mimo") ? "mimo-tts" : "tts-1");
  const finalVoice = voice || settings?.ttsVoice || "alloy";

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: text.slice(0, 4000),
        voice: finalVoice,
      }),
      signal: withTimeout(30_000),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      return {
        ok: false,
        error: `语音合成请求失败 (HTTP ${res.status})${errBody ? `: ${errBody.slice(0, 150)}` : ""}`,
      };
    }

    const arrayBuffer = await res.arrayBuffer();
    const base64Audio = Buffer.from(arrayBuffer).toString("base64");
    const audioData = `data:audio/mp3;base64,${base64Audio}`;

    return {
      ok: true,
      audioData,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "语音合成网络错误或超时",
    };
  }
}

/**
 * Transcribe audio speech via OpenAI / Whisper / MiMo transcription endpoint.
 */
export async function transcribeAudioOpenAi(
  audioBase64OrBuffer: Buffer | string,
  mimeType = "audio/webm",
  settings?: AiSettingsRecord
): Promise<AudioTranscriptionResult> {
  const key = getSttApiKey() || getCloudApiKey();
  if (!key) {
    return { ok: false, error: "未配置 API Key，无法使用云端语音识别" };
  }

  const base = (settings?.sttBaseUrl || settings?.baseUrl || "https://api.openai.com/v1").replace(/\/+$/, "");
  const url = `${base}/audio/transcriptions`;
  const model = settings?.sttModel || "whisper-1";

  try {
    let buffer: Buffer;
    if (typeof audioBase64OrBuffer === "string") {
      const cleanBase64 = audioBase64OrBuffer.replace(/^data:audio\/[^;]+;base64,/, "");
      buffer = Buffer.from(cleanBase64, "base64");
    } else {
      buffer = audioBase64OrBuffer;
    }

    const ext = mimeType.includes("mp3") ? "mp3" : mimeType.includes("wav") ? "wav" : "webm";
    const filename = `audio.${ext}`;

    const blob = new Blob([new Uint8Array(buffer)], { type: mimeType });
    const formData = new FormData();
    formData.append("file", blob, filename);
    formData.append("model", model);
    formData.append("language", "zh");

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
      },
      body: formData,
      signal: withTimeout(30_000),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      return {
        ok: false,
        error: `语音转写请求失败 (HTTP ${res.status})${errBody ? `: ${errBody.slice(0, 150)}` : ""}`,
      };
    }

    const data = (await res.json()) as { text?: string };
    return {
      ok: true,
      text: data.text?.trim() || "",
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "语音识别网络错误或超时",
    };
  }
}
