import { create } from "zustand";
import {
  aiGetSettings,
  aiLearnUserTone,
  aiSaveSettings,
  type AiModeDto,
  type AiSettingsDto,
} from "../../lib/ipc";

export type AiMode = AiModeDto;

type AiSettingsState = {
  mode: AiMode;
  baseUrl: string;
  model: string;
  ollamaHost: string;
  ollamaModel: string;
  cloudPrivacyAck: boolean;
  preferLocalWhenAvailable: boolean;
  redactSensitiveData: boolean;
  hasCloudApiKey: boolean;
  /** Local draft of api key (never reloaded from disk as plaintext). */
  apiKeyDraft: string;
  userPersona: string;
  userPersonaTraits: string[];
  learningTone: boolean;
  hydrated: boolean;
  setMode: (m: AiMode) => void;
  setBaseUrl: (v: string) => void;
  setModel: (m: string) => void;
  setOllamaHost: (v: string) => void;
  setOllamaModel: (v: string) => void;
  setPreferLocal: (v: boolean) => void;
  setRedactSensitiveData: (v: boolean) => void;
  setApiKeyDraft: (v: string) => void;
  setCloudPrivacyAck: (v: boolean) => void;
  setUserPersona: (persona: string, traits?: string[]) => void;
  learnUserTone: (accountId?: string) => Promise<{ ok: boolean; error?: string }>;
  applyDto: (dto: AiSettingsDto) => void;
  hydrate: () => Promise<void>;
  save: () => Promise<AiSettingsDto>;
};

const PERSONA_STORAGE_KEY = "oh-ai-email:user-persona";
const PERSONA_TRAITS_KEY = "oh-ai-email:user-persona-traits";

export const useAiSettings = create<AiSettingsState>((set, get) => ({
  mode: "cloud",
  baseUrl: "https://api.openai.com/v1",
  model: "gpt-4o-mini",
  ollamaHost: "http://127.0.0.1:11434",
  ollamaModel: "llama3.2",
  cloudPrivacyAck: false,
  preferLocalWhenAvailable: false,
  redactSensitiveData: false,
  hasCloudApiKey: false,
  apiKeyDraft: "",
  userPersona: "",
  userPersonaTraits: [],
  learningTone: false,
  hydrated: false,
  setMode: (mode) => set({ mode }),
  setBaseUrl: (baseUrl) => set({ baseUrl }),
  setModel: (model) => set({ model }),
  setOllamaHost: (ollamaHost) => set({ ollamaHost }),
  setOllamaModel: (ollamaModel) => set({ ollamaModel }),
  setPreferLocal: (preferLocalWhenAvailable) => set({ preferLocalWhenAvailable }),
  setRedactSensitiveData: (redactSensitiveData) => set({ redactSensitiveData }),
  setApiKeyDraft: (apiKeyDraft) => set({ apiKeyDraft }),
  setCloudPrivacyAck: (cloudPrivacyAck) => set({ cloudPrivacyAck }),
  setUserPersona: (userPersona, traits) => {
    const userPersonaTraits = traits ?? get().userPersonaTraits;
    try {
      localStorage.setItem(PERSONA_STORAGE_KEY, userPersona);
      localStorage.setItem(PERSONA_TRAITS_KEY, JSON.stringify(userPersonaTraits));
    } catch {
      // ignore in test/ssr
    }
    set({ userPersona, userPersonaTraits });
  },
  learnUserTone: async (accountId?: string) => {
    set({ learningTone: true });
    try {
      const res = await aiLearnUserTone({ accountId, mode: get().mode });
      if (res.ok) {
        get().setUserPersona(res.personaSummary, res.keyTraits);
        set({ learningTone: false });
        return { ok: true };
      }
      set({ learningTone: false });
      return { ok: false, error: res.error };
    } catch (err) {
      set({ learningTone: false });
      return { ok: false, error: err instanceof Error ? err.message : "学习用户语气失败" };
    }
  },
  applyDto: (dto) =>
    set({
      mode: dto.mode,
      baseUrl: dto.baseUrl,
      model: dto.model,
      ollamaHost: dto.ollamaHost,
      ollamaModel: dto.ollamaModel,
      cloudPrivacyAck: dto.cloudPrivacyAck,
      preferLocalWhenAvailable: dto.preferLocalWhenAvailable,
      redactSensitiveData: dto.redactSensitiveData,
      hasCloudApiKey: dto.hasCloudApiKey,
      hydrated: true,
    }),
  hydrate: async () => {
    let savedPersona = "";
    let savedTraits: string[] = [];
    try {
      savedPersona = localStorage.getItem(PERSONA_STORAGE_KEY) || "";
      const rawTraits = localStorage.getItem(PERSONA_TRAITS_KEY);
      if (rawTraits) savedTraits = JSON.parse(rawTraits);
    } catch {
      // ignore
    }
    if (savedPersona) {
      set({ userPersona: savedPersona, userPersonaTraits: savedTraits });
    }
    const dto = await aiGetSettings();
    get().applyDto(dto);
  },
  save: async () => {
    const s = get();
    const payload: Parameters<typeof aiSaveSettings>[0] = {
      mode: s.mode,
      baseUrl: s.baseUrl,
      model: s.model,
      ollamaHost: s.ollamaHost,
      ollamaModel: s.ollamaModel,
      cloudPrivacyAck: s.cloudPrivacyAck,
      preferLocalWhenAvailable: s.preferLocalWhenAvailable,
      redactSensitiveData: s.redactSensitiveData,
    };
    if (s.apiKeyDraft.trim()) {
      payload.apiKey = s.apiKeyDraft.trim();
    }
    const dto = await aiSaveSettings(payload);
    set({ apiKeyDraft: "", hasCloudApiKey: dto.hasCloudApiKey });
    get().applyDto(dto);
    return dto;
  },
}));

