import { create } from "zustand";
import { prefsGet, prefsSave } from "../../lib/ipc";

export const SYNC_INTERVAL_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: "仅手动" },
  { value: 1, label: "每 1 分钟" },
  { value: 5, label: "每 5 分钟" },
  { value: 10, label: "每 10 分钟" },
  { value: 15, label: "每 15 分钟" },
  { value: 30, label: "每 30 分钟" },
  { value: 60, label: "每 1 小时" },
];

type PrefsState = {
  syncIntervalMin: number;
  hydrated: boolean;
  setSyncIntervalMin: (n: number) => void;
  hydrate: () => Promise<void>;
  save: () => Promise<void>;
};

export const usePrefsStore = create<PrefsState>((set, get) => ({
  syncIntervalMin: 5,
  hydrated: false,
  setSyncIntervalMin: (syncIntervalMin) => set({ syncIntervalMin }),
  hydrate: async () => {
    const p = await prefsGet();
    set({ syncIntervalMin: p.syncIntervalMin, hydrated: true });
  },
  save: async () => {
    const p = await prefsSave({ syncIntervalMin: get().syncIntervalMin });
    set({ syncIntervalMin: p.syncIntervalMin, hydrated: true });
  },
}));
