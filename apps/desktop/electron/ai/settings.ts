import fs from "node:fs";
import path from "node:path";
import { app } from "electron";
import { deleteSecret, loadSecret, saveSecret } from "../store";

export type AiMode = "cloud" | "local";

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
};

const CLOUD_KEY = "ai:cloudApiKey";

const DEFAULTS: AiSettingsRecord = {
  mode: "cloud",
  baseUrl: "https://api.openai.com/v1",
  model: "gpt-4o-mini",
  ollamaHost: "http://127.0.0.1:11434",
  ollamaModel: "llama3.2",
  cloudPrivacyAck: false,
  preferLocalWhenAvailable: false,
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

export function publicAiSettings(): AiSettingsRecord & { hasCloudApiKey: boolean } {
  return { ...loadAiSettings(), hasCloudApiKey: hasCloudApiKey() };
}
