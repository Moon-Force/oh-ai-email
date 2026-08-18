import { getCloudApiKey, getEffectiveCloudApiKey, getSttApiKey, getTtsApiKey, type AiSettingsRecord } from "../settings";

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
  const key = getEffectiveCloudApiKey() || getCloudApiKey();
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
        return { ok: true, models: ["mimo-v2.5", "mimo-v2.5-pro", "mimo-v2.5-pro-ultraspeed", "mimo-v2.5-asr", "mimo-v2.5-tts"] };
      }
    }

    return { ok: true, models };
  } catch (e) {
    // If endpoint failed, provide fallback known models for DeepSeek/MiMo
    if (base.includes("deepseek")) {
      return { ok: true, models: ["deepseek-chat", "deepseek-reasoner"] };
    }
    if (base.includes("mimo") || base.includes("xiaomi")) {
      return { ok: true, models: ["mimo-v2.5", "mimo-v2.5-pro", "mimo-v2.5-pro-ultraspeed"] };
    }
    return {
      ok: false,
      error: e instanceof Error ? e.message : "获取远程模型列表超时或网络错误",
    };
  }
}

async function fetchVoiceModels(
  baseUrl: string,
  apiKey: string | null,
  kind: "stt" | "tts"
): Promise<RemoteModelsResult> {
  const base = baseUrl.replace(/\/+$/, "");
  if (!base) {
    return { ok: false, error: "请先填写服务地址 Base URL" };
  }
  if (!apiKey) {
    return { ok: false, error: "未配置 API Key，无法拉取语音模型列表" };
  }
  const url = `${base}/models`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: withTimeout(12_000),
    });
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        return { ok: false, error: "API Key 无效或鉴权失败" };
      }
      return { ok: false, error: `语音模型列表获取失败 (HTTP ${res.status})` };
    }
    const data = (await res.json()) as {
      data?: Array<{ id?: string; name?: string }>;
      models?: Array<{ id?: string; name?: string }>;
    };
    const rawList = data.data || data.models || [];
    let models = rawList
      .map((item) => item.id || item.name || "")
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
    if (models.length === 0) {
      if (base.includes("mimo") || base.includes("xiaomi")) {
        models =
          kind === "stt"
            ? ["mimo-v2.5-asr"]
            : ["mimo-v2.5-tts", "mimo-v2.5-tts-voiceclone", "mimo-v2.5-tts-voicedesign"];
      } else if (kind === "stt") {
        models = ["whisper-1", "gpt-4o-transcribe", "gpt-4o-mini-transcribe"];
      } else {
        models = ["tts-1", "tts-1-hd", "gpt-4o-mini-tts"];
      }
      return { ok: true, models };
    }
    const keywords =
      kind === "stt"
        ? ["whisper", "asr", "transcribe", "sensevoice"]
        : ["tts", "speech", "voice", "voicedesign", "voiceclone", "cosyvoice"];
    const filtered = models.filter((m) => keywords.some((k) => m.toLowerCase().includes(k)));
    return { ok: true, models: filtered.length > 0 ? filtered : models };
  } catch (e) {
    if (base.includes("mimo") || base.includes("xiaomi")) {
      return {
        ok: true,
        models:
          kind === "stt"
            ? ["mimo-v2.5-asr"]
            : ["mimo-v2.5-tts", "mimo-v2.5-tts-voiceclone", "mimo-v2.5-tts-voicedesign"],
      };
    }
    if (kind === "stt") {
      return { ok: true, models: ["whisper-1", "gpt-4o-transcribe", "gpt-4o-mini-transcribe"] };
    }
    return { ok: true, models: ["tts-1", "tts-1-hd", "gpt-4o-mini-tts"] };
  }
}

export async function fetchSttModels(settings: AiSettingsRecord): Promise<RemoteModelsResult> {
  const key = getSttApiKey() || getEffectiveCloudApiKey() || getCloudApiKey();
  return fetchVoiceModels(settings.sttBaseUrl || settings.baseUrl, key, "stt");
}

export async function fetchTtsModels(settings: AiSettingsRecord): Promise<RemoteModelsResult> {
  const key = getTtsApiKey() || getEffectiveCloudApiKey() || getCloudApiKey();
  return fetchVoiceModels(settings.ttsBaseUrl || settings.baseUrl, key, "tts");
}

/**
 * Queries account balance info (DeepSeek / standard cloud balance endpoints).
 */
export async function fetchAccountBalance(
  settings: AiSettingsRecord
): Promise<AccountBalanceResult> {
  const key = getEffectiveCloudApiKey() || getCloudApiKey();
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
 * MiMo TTS does NOT use /audio/speech — it uses POST /v1/chat/completions
 * with messages + audio:{format,voice} (see mimo.mi.com docs).
 */
export async function synthesizeSpeechMiMo(
  text: string,
  voice?: string,
  settings?: AiSettingsRecord
): Promise<SpeechSynthesisResult> {
  const key = getTtsApiKey() || getEffectiveCloudApiKey() || getCloudApiKey();
  if (!key) {
    return { ok: false, error: "未配置 API Key，无法使用云端语音合成" };
  }

  const base = (settings?.ttsBaseUrl || settings?.baseUrl || "https://api.openai.com/v1").replace(
    /\/+$/,
    ""
  );
  const isMimo = base.includes("mimo") || base.includes("xiaomi");
  const model =
    settings?.ttsModel ||
    (settings?.model && settings.model.includes("mimo") ? "mimo-v2.5-tts" : "tts-1");
  const rawVoice = voice || settings?.ttsVoice || "alloy";

  if (isMimo) {
    const mimoVoiceMap: Record<string, string> = {
      alloy: "mimo_default",
      echo: "Milo",
      fable: "Dean",
      onyx: "苏打",
      nova: "茉莉",
      shimmer: "Mia",
      mimo_default: "mimo_default",
      Chloe: "Chloe",
      Mia: "Mia",
      Milo: "Milo",
      Dean: "Dean",
      冰糖: "冰糖",
      茉莉: "茉莉",
      苏打: "苏打",
      白桦: "白桦",
    };
    const finalVoice = mimoVoiceMap[rawVoice] ?? "Chloe";
    const url = `${base}/chat/completions`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: model.startsWith("mimo-") ? model : "mimo-v2.5-tts",
          messages: [
            {
              role: "user",
              content: "Warm, friendly, natural speaking style, clear and steady pace.",
            },
            { role: "assistant", content: text.slice(0, 4000) },
          ],
          audio: { format: "wav", voice: finalVoice },
        }),
        signal: withTimeout(30_000),
      });
      if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        return {
          ok: false,
          error: `MiMo 语音合成失败 (HTTP ${res.status})${errBody ? `: ${errBody.slice(0, 300)}` : ""}`,
        };
      }
      const data = (await res.json()) as {
        choices?: Array<{ message?: { audio?: { data?: string } } }>;
      };
      const b64 = data.choices?.[0]?.message?.audio?.data;
      if (!b64) {
        return { ok: false, error: "MiMo TTS 返回为空，未获取到音频数据" };
      }
      const buf = Buffer.from(b64, "base64");
      const isWav = buf.slice(0, 4).toString() === "RIFF";
      const mime = isWav ? "audio/wav" : "audio/mp3";
      return { ok: true, audioData: `data:${mime};base64,${b64}` };
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : "MiMo 语音合成网络错误或超时",
      };
    }
  }

  const url = `${base}/audio/speech`;
  const finalVoice = rawVoice;
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
 * MiMo ASR does NOT use /audio/transcriptions — it uses POST /v1/chat/completions
 * with messages[].content[].input_audio.data = data:audio/wav;base64,... (see docs).
 * OpenAI-compatible STT still uses /audio/transcriptions.
 */
export async function transcribeAudioOpenAi(
  audioBase64OrBuffer: Buffer | string,
  mimeType = "audio/webm",
  settings?: AiSettingsRecord
): Promise<AudioTranscriptionResult> {
  const key = getSttApiKey() || getEffectiveCloudApiKey() || getCloudApiKey();
  if (!key) {
    return { ok: false, error: "未配置 API Key，无法使用云端语音识别" };
  }

  const base = (settings?.sttBaseUrl || settings?.baseUrl || "https://api.openai.com/v1").replace(
    /\/+$/,
    ""
  );
  const isMimo = base.includes("mimo") || base.includes("xiaomi");
  const model = settings?.sttModel || (isMimo ? "mimo-v2.5-asr" : "whisper-1");

  if (isMimo) {
    try {
      let b64: string;
      let buf: Buffer;
      if (typeof audioBase64OrBuffer === "string") {
        const raw = audioBase64OrBuffer.trim();
        b64 = raw.includes(",") ? (raw.split(",").pop() ?? "") : raw;
        b64 = b64.replace(/\s+/g, "");
        buf = Buffer.from(b64, "base64");
      } else {
        buf = audioBase64OrBuffer;
        b64 = buf.toString("base64");
      }
      if (buf.length < 200) {
        return { ok: false, error: `录音过短（${buf.length}字节），请长按录 1-2 秒再试` };
      }
      const isWebm = mimeType.includes("webm");
      let dataUrl: string;
      let fmtForField = mimeType;
      if (isWebm) {
        const wavBuf = webmToWavFallback(buf);
        if (!wavBuf) {
          return {
            ok: false,
            error: "MiMo ASR 仅支持 wav/mp3，当前录音为 webm 且无法本地转码，请在设置中将 STT 切换为系统内置或 OpenAI 兼容",
          };
        }
        dataUrl = `data:audio/wav;base64,${wavBuf.toString("base64")}`;
        fmtForField = "audio/wav";
      } else if (mimeType.includes("wav")) {
        dataUrl = `data:audio/wav;base64,${b64}`;
      } else {
        dataUrl = `data:audio/mpeg;base64,${b64}`;
        fmtForField = "audio/mpeg";
      }
      void fmtForField;

      const url = `${base}/chat/completions`;
      const mimoModel = model.startsWith("mimo-") ? model : "mimo-v2.5-asr";
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: mimoModel,
          messages: [
            {
              role: "user",
              content: [{ type: "input_audio", input_audio: { data: dataUrl } }],
            },
          ],
          asr_options: { language: "zh" },
        }),
        signal: withTimeout(30_000),
      });
      if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        return {
          ok: false,
          error: `MiMo 语音识别失败 (HTTP ${res.status})${errBody ? `: ${errBody.slice(0, 300)}` : ""}`,
        };
      }
      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = String(data.choices?.[0]?.message?.content ?? "").trim();
      if (!text) {
        return {
          ok: false,
          error: "MiMo 语音识别返回为空（可能静音/过短），请重试",
        };
      }
      return { ok: true, text };
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : "MiMo 语音识别网络错误或超时",
      };
    }
  }

  const url = `${base}/audio/transcriptions`;
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

    const data = (await res.json().catch(() => ({}))) as {
      text?: string;
      result?: string;
      transcript?: string;
      data?: { text?: string };
    };
    const rawText =
      data.text ??
      data.result ??
      data.transcript ??
      data.data?.text ??
      "";
    const text = String(rawText).trim();
    if (!text) {
      return { ok: false, error: "语音识别返回为空（可能录音过短/静音或模型不支持该音频），请重试或检查 STT 模型是否正确" };
    }
    return { ok: true, text };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "语音识别网络错误或超时",
    };
  }
}

function webmToWavFallback(buf: Buffer): Buffer | null {
  if (!buf || buf.length < 44) return null;
  const head = buf.slice(0, 4).toString();
  if (head === "RIFF") return buf;
  return null;
}
