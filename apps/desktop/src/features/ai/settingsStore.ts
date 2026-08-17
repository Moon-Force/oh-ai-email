import { create } from "zustand";
import {
  aiDeleteProfile,
  aiGetSettings,
  aiLearnUserTone,
  aiSaveProfile,
  aiSaveSettings,
  aiSetActiveProfile,
  aiSetProfileApiKey,
  type AiCloudProfileDto,
  type AiModeDto,
  type AiSettingsDto,
} from "../../lib/ipc";

export type AiMode = AiModeDto;
export type AiCloudProfile = AiCloudProfileDto;

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
  hasEffectiveCloudApiKey: boolean;
  apiKeyDraft: string;
  cloudProfiles: AiCloudProfileDto[];
  activeCloudProfileId: string | null;

  reasoningEffort: "low" | "medium" | "high";
  maxTokens: number;
  timeoutSeconds: number;

  sttService: "browser" | "custom";
  sttBaseUrl: string;
  sttModel: string;
  sttApiKeyDraft: string;
  hasSttApiKey: boolean;

  ttsService: "browser" | "custom";
  ttsBaseUrl: string;
  ttsModel: string;
  ttsVoice: string;
  ttsApiKeyDraft: string;
  hasTtsApiKey: boolean;

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
  setReasoningEffort: (effort: "low" | "medium" | "high") => void;
  setMaxTokens: (tokens: number) => void;
  setTimeoutSeconds: (sec: number) => void;

  setSttService: (v: "browser" | "custom") => void;
  setSttBaseUrl: (v: string) => void;
  setSttModel: (v: string) => void;
  setSttApiKeyDraft: (v: string) => void;

  setTtsService: (v: "browser" | "custom") => void;
  setTtsBaseUrl: (v: string) => void;
  setTtsModel: (v: string) => void;
  setTtsVoice: (v: string) => void;
  setTtsApiKeyDraft: (v: string) => void;

  setUserPersona: (persona: string, traits?: string[]) => void;
  learnUserTone: (accountId?: string) => Promise<{ ok: boolean; error?: string }>;
  applyDto: (dto: AiSettingsDto) => void;
  hydrate: () => Promise<void>;
  save: () => Promise<AiSettingsDto>;
  saveProfile: (input: {
    id?: string;
    name: string;
    baseUrl: string;
    model: string;
    apiKey?: string;
    reasoningEffort?: "low" | "medium" | "high";
    maxTokens?: number;
    timeoutSeconds?: number;
  }) => Promise<AiSettingsDto>;
  deleteProfile: (id: string) => Promise<AiSettingsDto>;
  setActiveProfile: (id: string | null) => Promise<AiSettingsDto>;
  setProfileApiKey: (id: string, apiKey: string) => Promise<AiSettingsDto>;
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
  hasEffectiveCloudApiKey: false,
  apiKeyDraft: "",
  cloudProfiles: [],
  activeCloudProfileId: null,

  reasoningEffort: "medium",
  maxTokens: 32768,
  timeoutSeconds: 300,

  sttService: "custom",
  sttBaseUrl: "https://api.openai.com/v1",
  sttModel: "whisper-1",
  sttApiKeyDraft: "",
  hasSttApiKey: false,

  ttsService: "custom",
  ttsBaseUrl: "https://api.openai.com/v1",
  ttsModel: "tts-1",
  ttsVoice: "alloy",
  ttsApiKeyDraft: "",
  hasTtsApiKey: false,

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
  setReasoningEffort: (reasoningEffort) => set({ reasoningEffort }),
  setMaxTokens: (maxTokens) => set({ maxTokens }),
  setTimeoutSeconds: (timeoutSeconds) => set({ timeoutSeconds }),

  setSttService: (sttService) => set({ sttService }),
  setSttBaseUrl: (sttBaseUrl) => set({ sttBaseUrl }),
  setSttModel: (sttModel) => set({ sttModel }),
  setSttApiKeyDraft: (sttApiKeyDraft) => set({ sttApiKeyDraft }),

  setTtsService: (ttsService) => set({ ttsService }),
  setTtsBaseUrl: (ttsBaseUrl) => set({ ttsBaseUrl }),
  setTtsModel: (ttsModel) => set({ ttsModel }),
  setTtsVoice: (ttsVoice) => set({ ttsVoice }),
  setTtsApiKeyDraft: (ttsApiKeyDraft) => set({ ttsApiKeyDraft }),

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
      hasEffectiveCloudApiKey: dto.hasEffectiveCloudApiKey ?? dto.hasCloudApiKey,
      cloudProfiles: dto.cloudProfiles ?? dto.cloudProfilesWithKey ?? [],
      activeCloudProfileId: dto.activeCloudProfileId ?? null,
      reasoningEffort: dto.reasoningEffort ?? "medium",
      maxTokens: dto.maxTokens ?? 32768,
      timeoutSeconds: dto.timeoutSeconds ?? 300,
      sttService: dto.sttService ?? "custom",
      sttBaseUrl: dto.sttBaseUrl ?? "https://api.openai.com/v1",
      sttModel: dto.sttModel ?? "whisper-1",
      ttsService: dto.ttsService ?? "custom",
      ttsBaseUrl: dto.ttsBaseUrl ?? "https://api.openai.com/v1",
      ttsModel: dto.ttsModel ?? "tts-1",
      ttsVoice: dto.ttsVoice ?? "alloy",
      hasSttApiKey: dto.hasSttApiKey ?? false,
      hasTtsApiKey: dto.hasTtsApiKey ?? false,
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
      reasoningEffort: s.reasoningEffort,
      maxTokens: s.maxTokens,
      timeoutSeconds: s.timeoutSeconds,
      sttService: s.sttService,
      sttBaseUrl: s.sttBaseUrl,
      sttModel: s.sttModel,
      ttsService: s.ttsService,
      ttsBaseUrl: s.ttsBaseUrl,
      ttsModel: s.ttsModel,
      ttsVoice: s.ttsVoice,
    };
    if (s.apiKeyDraft.trim()) {
      payload.apiKey = s.apiKeyDraft.trim();
    }
    if (s.sttApiKeyDraft.trim()) {
      payload.sttApiKey = s.sttApiKeyDraft.trim();
    }
    if (s.ttsApiKeyDraft.trim()) {
      payload.ttsApiKey = s.ttsApiKeyDraft.trim();
    }
    const dto = await aiSaveSettings(payload);
    set({
      apiKeyDraft: "",
      sttApiKeyDraft: "",
      ttsApiKeyDraft: "",
      hasCloudApiKey: dto.hasCloudApiKey,
      hasEffectiveCloudApiKey: dto.hasEffectiveCloudApiKey ?? dto.hasCloudApiKey,
      hasSttApiKey: dto.hasSttApiKey,
      hasTtsApiKey: dto.hasTtsApiKey,
    });
    get().applyDto(dto);
    return dto;
  },
  saveProfile: async (input) => {
    const dto = await aiSaveProfile(input);
    get().applyDto(dto);
    return dto;
  },
  deleteProfile: async (id) => {
    const dto = await aiDeleteProfile(id);
    get().applyDto(dto);
    return dto;
  },
  setActiveProfile: async (id) => {
    const dto = await aiSetActiveProfile(id);
    get().applyDto(dto);
    return dto;
  },
  setProfileApiKey: async (id, apiKey) => {
    const dto = await aiSetProfileApiKey(id, apiKey);
    get().applyDto(dto);
    return dto;
  },
}));
