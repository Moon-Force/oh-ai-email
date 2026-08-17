import fs from "node:fs";
import path from "node:path";
import { app } from "electron";
import { deleteSecret, loadSecret, saveSecret } from "../store";

export type AiMode = "cloud" | "local";
export type ReasoningEffort = "low" | "medium" | "high";

export type AiSettingsRecord = {
  mode: AiMode;
  /** OpenAI-compatible base, e.g. https://api.openai.com/v1 */
  baseUrl: string;
  /** Cloud model id */
  model: string;
  /** Ollama base host, e.g. http://127.0.0.1:11434 */
  ollamaHost: string;
  /** Ollama model name */
  ollamaModel: string;
  /** User acknowledged cloud privacy once */
  cloudPrivacyAck: boolean;
  preferLocalWhenAvailable: boolean;
  /** Redact emails, phones and ID numbers before sending to cloud */
  redactSensitiveData: boolean;

  /** Reasoning effort for deep thinking models */
  reasoningEffort: ReasoningEffort;

  /** Maximum output completion tokens */
  maxTokens: number;
  /** Request timeout in seconds */
  timeoutSeconds: number;

  /** Voice STT (Speech-to-Text) configuration */
  sttService: "browser" | "custom";
  sttBaseUrl: string;
  sttModel: string;

  /** Voice TTS (Text-to-Speech) configuration */
  ttsService: "browser" | "custom";
  ttsBaseUrl: string;
  ttsModel: string;
  ttsVoice: string;
};

const CLOUD_KEY = "ai:cloudApiKey";
const STT_KEY = "ai:sttApiKey";
const TTS_KEY = "ai:ttsApiKey";

const DEFAULTS: AiSettingsRecord = {
  mode: "cloud",
  baseUrl: "https://api.openai.com/v1",
  model: "gpt-4o-mini",
  ollamaHost: "http://127.0.0.1:11434",
  ollamaModel: "llama3.2",
  cloudPrivacyAck: false,
  preferLocalWhenAvailable: false,
  redactSensitiveData: false,

  reasoningEffort: "medium",
  maxTokens: 32768,
  timeoutSeconds: 300,

  sttService: "custom",
  sttBaseUrl: "https://api.openai.com/v1",
  sttModel: "whisper-1",

  ttsService: "custom",
  ttsBaseUrl: "https://api.openai.com/v1",
  ttsModel: "tts-1",
  ttsVoice: "alloy",
};

function settingsPath(): string {
  return path.join(app.getPath("userData"), "ai-settings.json");
}

export function loadAiSettings(): AiSettingsRecord {
  const p = settingsPath();
  if (!fs.existsSync(p)) return { ...DEFAULTS };
  try {
    const raw = JSON.parse(fs.readFileSync(p, "utf-8")) as Partial<AiSettingsRecord>;
    return {
      ...DEFAULTS,
      ...raw,
      mode: raw.mode === "local" ? "local" : "cloud",
      baseUrl: String(raw.baseUrl || DEFAULTS.baseUrl).replace(/\/+$/, ""),
      model: String(raw.model || DEFAULTS.model),
      ollamaHost: String(raw.ollamaHost || DEFAULTS.ollamaHost).replace(/\/+$/, ""),
      ollamaModel: String(raw.ollamaModel || DEFAULTS.ollamaModel),
      cloudPrivacyAck: Boolean(raw.cloudPrivacyAck),
      preferLocalWhenAvailable: Boolean(raw.preferLocalWhenAvailable),
      redactSensitiveData: Boolean(raw.redactSensitiveData),

      reasoningEffort:
        raw.reasoningEffort === "low" || raw.reasoningEffort === "high"
          ? raw.reasoningEffort
          : "medium",

      sttService: raw.sttService === "browser" ? "browser" : "custom",
      sttBaseUrl: String(raw.sttBaseUrl || DEFAULTS.sttBaseUrl).replace(/\/+$/, ""),
      sttModel: String(raw.sttModel || DEFAULTS.sttModel),

      ttsService: raw.ttsService === "browser" ? "browser" : "custom",
      ttsBaseUrl: String(raw.ttsBaseUrl || DEFAULTS.ttsBaseUrl).replace(/\/+$/, ""),
      ttsModel: String(raw.ttsModel || DEFAULTS.ttsModel),
      ttsVoice: String(raw.ttsVoice || DEFAULTS.ttsVoice),
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveAiSettings(partial: Partial<AiSettingsRecord>): AiSettingsRecord {
  const next: AiSettingsRecord = {
    ...loadAiSettings(),
    ...partial,
  };
  if (partial.baseUrl != null) next.baseUrl = String(partial.baseUrl).replace(/\/+$/, "");
  if (partial.ollamaHost != null) next.ollamaHost = String(partial.ollamaHost).replace(/\/+$/, "");
  if (partial.mode != null) next.mode = partial.mode === "local" ? "local" : "cloud";
  if (partial.sttBaseUrl != null) next.sttBaseUrl = String(partial.sttBaseUrl).replace(/\/+$/, "");
  if (partial.ttsBaseUrl != null) next.ttsBaseUrl = String(partial.ttsBaseUrl).replace(/\/+$/, "");
  fs.mkdirSync(path.dirname(settingsPath()), { recursive: true });
  fs.writeFileSync(settingsPath(), JSON.stringify(next, null, 2), "utf-8");
  return next;
}

export function hasCloudApiKey(): boolean {
  const k = loadSecret(CLOUD_KEY);
  return Boolean(k && k.trim());
}

export function getCloudApiKey(): string | null {
  const k = loadSecret(CLOUD_KEY);
  return k?.trim() ? k : null;
}

/** Empty string clears the key. */
export function setCloudApiKey(apiKey: string): void {
  if (!apiKey.trim()) {
    deleteSecret(CLOUD_KEY);
    return;
  }
  saveSecret(CLOUD_KEY, apiKey.trim());
}

export function getSttApiKey(): string | null {
  const k = loadSecret(STT_KEY);
  return k?.trim() ? k : getCloudApiKey();
}

export function setSttApiKey(apiKey: string): void {
  if (!apiKey.trim()) {
    deleteSecret(STT_KEY);
    return;
  }
  saveSecret(STT_KEY, apiKey.trim());
}

export function getTtsApiKey(): string | null {
  const k = loadSecret(TTS_KEY);
  return k?.trim() ? k : getCloudApiKey();
}

export function setTtsApiKey(apiKey: string): void {
  if (!apiKey.trim()) {
    deleteSecret(TTS_KEY);
    return;
  }
  saveSecret(TTS_KEY, apiKey.trim());
}

export function publicAiSettings(): AiSettingsRecord & {
  hasCloudApiKey: boolean;
  hasSttApiKey: boolean;
  hasTtsApiKey: boolean;
} {
  const sttKey = loadSecret(STT_KEY);
  const ttsKey = loadSecret(TTS_KEY);
  return {
    ...loadAiSettings(),
    hasCloudApiKey: hasCloudApiKey(),
    hasSttApiKey: Boolean(sttKey && sttKey.trim()),
    hasTtsApiKey: Boolean(ttsKey && ttsKey.trim()),
  };
}
