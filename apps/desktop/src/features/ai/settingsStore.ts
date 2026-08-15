import { create } from "zustand";
import {
  aiGetSettings,
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
  hasCloudApiKey: boolean;
  /** Local draft of api key (never reloaded from disk as plaintext). */
  apiKeyDraft: string;
  hydrated: boolean;
  setMode: (m: AiMode) => void;
  setBaseUrl: (v: string) => void;
  setModel: (m: string) => void;
  setOllamaHost: (v: string) => void;
  setOllamaModel: (v: string) => void;
  setPreferLocal: (v: boolean) => void;
  setApiKeyDraft: (v: string) => void;
  setCloudPrivacyAck: (v: boolean) => void;
  applyDto: (dto: AiSettingsDto) => void;
  hydrate: () => Promise<void>;
  save: () => Promise<AiSettingsDto>;
};

export const useAiSettings = create<AiSettingsState>((set, get) => ({
  mode: "cloud",
  baseUrl: "https://api.openai.com/v1",
  model: "gpt-4o-mini",
  ollamaHost: "http://127.0.0.1:11434",
  ollamaModel: "llama3.2",
  cloudPrivacyAck: false,
  preferLocalWhenAvailable: false,
  hasCloudApiKey: false,
  apiKeyDraft: "",
  hydrated: false,
  setMode: (mode) => set({ mode }),
  setBaseUrl: (baseUrl) => set({ baseUrl }),
  setModel: (model) => set({ model }),
  setOllamaHost: (ollamaHost) => set({ ollamaHost }),
  setOllamaModel: (ollamaModel) => set({ ollamaModel }),
  setPreferLocal: (preferLocalWhenAvailable) => set({ preferLocalWhenAvailable }),
  setApiKeyDraft: (apiKeyDraft) => set({ apiKeyDraft }),
  setCloudPrivacyAck: (cloudPrivacyAck) => set({ cloudPrivacyAck }),
  applyDto: (dto) =>
    set({
      mode: dto.mode,
      baseUrl: dto.baseUrl,
      model: dto.model,
      ollamaHost: dto.ollamaHost,
      ollamaModel: dto.ollamaModel,
      cloudPrivacyAck: dto.cloudPrivacyAck,
      preferLocalWhenAvailable: dto.preferLocalWhenAvailable,
      hasCloudApiKey: dto.hasCloudApiKey,
      hydrated: true,
    }),
  hydrate: async () => {
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
