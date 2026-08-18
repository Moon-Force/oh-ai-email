import fs from "node:fs";
import path from "node:path";
import { app } from "electron";
import { deleteSecret, loadSecret, saveSecret } from "../store";

export type AiMode = "cloud" | "local";
export type ReasoningEffort = "low" | "medium" | "high";

export type AiCloudProfile = {
  id: string;
  name: string;
  baseUrl: string;
  model: string;
  reasoningEffort?: ReasoningEffort;
  maxTokens?: number;
  timeoutSeconds?: number;
  createdAt: number;
  updatedAt: number;
};

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

  /** 多配置：已保存的云端 profiles */
  cloudProfiles: AiCloudProfile[];
  activeCloudProfileId: string | null;
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

  cloudProfiles: [],
  activeCloudProfileId: null,
};

function settingsPath(): string {
  return path.join(app.getPath("userData"), "ai-settings.json");
}

function normalizeProfile(p: Partial<AiCloudProfile>): AiCloudProfile | null {
  const id = String(p.id || "").trim();
  const name = String(p.name || "").trim();
  const baseUrl = String(p.baseUrl || "").trim().replace(/\/+$/, "");
  const model = String(p.model || "").trim();
  if (!id || !name || !baseUrl || !model) return null;
  return {
    id,
    name,
    baseUrl,
    model,
    reasoningEffort:
      p.reasoningEffort === "low" || p.reasoningEffort === "high" ? p.reasoningEffort : undefined,
    maxTokens: typeof p.maxTokens === "number" ? p.maxTokens : undefined,
    timeoutSeconds: typeof p.timeoutSeconds === "number" ? p.timeoutSeconds : undefined,
    createdAt: typeof p.createdAt === "number" ? p.createdAt : Date.now(),
    updatedAt: typeof p.updatedAt === "number" ? p.updatedAt : Date.now(),
  };
}

export function loadAiSettings(): AiSettingsRecord {
  const p = settingsPath();
  if (!fs.existsSync(p)) return { ...DEFAULTS };
  try {
    const raw = JSON.parse(fs.readFileSync(p, "utf-8")) as Partial<AiSettingsRecord> & {
      cloudProfiles?: unknown;
    };
    const profilesRaw = Array.isArray(raw.cloudProfiles) ? raw.cloudProfiles : [];
    const cloudProfiles = profilesRaw
      .map((x) => normalizeProfile(x as Partial<AiCloudProfile>))
      .filter((x): x is AiCloudProfile => x != null);
    const activeCloudProfileId =
      typeof raw.activeCloudProfileId === "string" && raw.activeCloudProfileId.trim()
        ? raw.activeCloudProfileId.trim()
        : null;
    const validActive =
      activeCloudProfileId && cloudProfiles.some((pr) => pr.id === activeCloudProfileId)
        ? activeCloudProfileId
        : null;
    return {
      ...DEFAULTS,
      ...raw,
      cloudProfiles,
      activeCloudProfileId: validActive,
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

function profileSecretKey(profileId: string): string {
  return `ai:cloudProfile:${profileId}:apiKey`;
}

export function hasProfileApiKey(profileId: string): boolean {
  const k = loadSecret(profileSecretKey(profileId));
  return Boolean(k && k.trim());
}

export function getProfileApiKey(profileId: string): string | null {
  const k = loadSecret(profileSecretKey(profileId));
  return k?.trim() ? k : null;
}

export function setProfileApiKey(profileId: string, apiKey: string): void {
  if (!apiKey.trim()) {
    deleteSecret(profileSecretKey(profileId));
    return;
  }
  saveSecret(profileSecretKey(profileId), apiKey.trim());
}

export function getEffectiveCloudApiKey(): string | null {
  const s = loadAiSettings();
  if (s.activeCloudProfileId) {
    const pk = getProfileApiKey(s.activeCloudProfileId);
    if (pk) return pk;
  }
  return getCloudApiKey();
}

export function hasEffectiveCloudApiKey(): boolean {
  return Boolean(getEffectiveCloudApiKey());
}

export function saveCloudProfile(input: {
  id?: string;
  name: string;
  baseUrl: string;
  model: string;
  apiKey?: string;
  reasoningEffort?: ReasoningEffort;
  maxTokens?: number;
  timeoutSeconds?: number;
}): AiCloudProfile {
  const settings = loadAiSettings();
  const now = Date.now();
  const id = (input.id?.trim() || `ai_prof_${now.toString(36)}_${Math.random().toString(36).slice(2, 6)}`);
  const existingIdx = settings.cloudProfiles.findIndex((p) => p.id === id);
  const profile: AiCloudProfile = {
    id,
    name: input.name.trim(),
    baseUrl: input.baseUrl.trim().replace(/\/+$/, ""),
    model: input.model.trim(),
    reasoningEffort: input.reasoningEffort,
    maxTokens: input.maxTokens,
    timeoutSeconds: input.timeoutSeconds,
    createdAt: existingIdx >= 0 ? settings.cloudProfiles[existingIdx].createdAt : now,
    updatedAt: now,
  };
  if (!profile.name || !profile.baseUrl || !profile.model) {
    throw new Error("配置名称、Base URL 和模型均不能为空");
  }
  const nextProfiles = [...settings.cloudProfiles];
  if (existingIdx >= 0) nextProfiles[existingIdx] = profile;
  else nextProfiles.push(profile);
  saveAiSettings({ cloudProfiles: nextProfiles } as Partial<AiSettingsRecord>);
  if (input.apiKey !== undefined) {
    setProfileApiKey(id, input.apiKey);
  }
  return profile;
}

export function deleteCloudProfile(id: string): boolean {
  const settings = loadAiSettings();
  const idx = settings.cloudProfiles.findIndex((p) => p.id === id);
  if (idx === -1) return false;
  const nextProfiles = settings.cloudProfiles.filter((p) => p.id !== id);
  const nextActive = settings.activeCloudProfileId === id ? null : settings.activeCloudProfileId;
  saveAiSettings({ cloudProfiles: nextProfiles, activeCloudProfileId: nextActive } as Partial<AiSettingsRecord>);
  deleteSecret(profileSecretKey(id));
  return true;
}

export function setActiveCloudProfileId(id: string | null): AiSettingsRecord {
  if (id != null) {
    const s = loadAiSettings();
    if (!s.cloudProfiles.some((p) => p.id === id)) throw new Error("配置不存在");
  }
  const saved = saveAiSettings({ activeCloudProfileId: id } as Partial<AiSettingsRecord>);
  if (id) {
    const prof = saved.cloudProfiles.find((p) => p.id === id);
    if (prof) {
      saveAiSettings({
        baseUrl: prof.baseUrl,
        model: prof.model,
        reasoningEffort: prof.reasoningEffort ?? saved.reasoningEffort,
        maxTokens: prof.maxTokens ?? saved.maxTokens,
        timeoutSeconds: prof.timeoutSeconds ?? saved.timeoutSeconds,
      } as Partial<AiSettingsRecord>);
    }
  }
  return loadAiSettings();
}

export function publicAiSettings(): AiSettingsRecord & {
  hasCloudApiKey: boolean;
  hasSttApiKey: boolean;
  hasTtsApiKey: boolean;
  hasEffectiveCloudApiKey: boolean;
  cloudProfilesWithKey: Array<AiCloudProfile & { hasApiKey: boolean }>;
} {
  const sttKey = loadSecret(STT_KEY);
  const ttsKey = loadSecret(TTS_KEY);
  const s = loadAiSettings();
  return {
    ...s,
    hasCloudApiKey: hasCloudApiKey(),
    hasEffectiveCloudApiKey: hasEffectiveCloudApiKey(),
    hasSttApiKey: Boolean(sttKey && sttKey.trim()),
    hasTtsApiKey: Boolean(ttsKey && ttsKey.trim()),
    cloudProfilesWithKey: s.cloudProfiles.map((p) => ({
      ...p,
      hasApiKey: hasProfileApiKey(p.id),
    })),
  };
}
