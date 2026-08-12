import { create } from "zustand";
import type { AiMode } from "./router";

type AiSettings = {
  mode: AiMode;
  provider: string;
  model: string;
  preferLocalWhenAvailable: boolean;
  setMode: (m: AiMode) => void;
  setProvider: (p: string) => void;
  setModel: (m: string) => void;
  setPreferLocal: (v: boolean) => void;
};

export const useAiSettings = create<AiSettings>((set) => ({
  mode: "cloud",
  provider: "OpenAI 兼容",
  model: "gpt-4o-mini",
  preferLocalWhenAvailable: false,
  setMode: (mode) => set({ mode }),
  setProvider: (provider) => set({ provider }),
  setModel: (model) => set({ model }),
  setPreferLocal: (preferLocalWhenAvailable) => set({ preferLocalWhenAvailable }),
}));
