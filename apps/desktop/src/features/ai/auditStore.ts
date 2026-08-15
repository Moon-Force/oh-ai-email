import { create } from "zustand";
import type { AiModeDto } from "../../lib/ipc";

export type AiAuditEntry = {
  id: string;
  timestamp: number;
  mode: AiModeDto;
  task: string;
  charCount: number;
  durationMs: number;
  status: "success" | "error" | "aborted";
};

type AiAuditState = {
  records: AiAuditEntry[];
  recordCall: (entry: Omit<AiAuditEntry, "id" | "timestamp">) => void;
  clearRecords: () => void;
};

const MAX_AUDIT_RECORDS = 30;

export const useAiAuditStore = create<AiAuditState>((set) => ({
  records: [],
  recordCall: (entry) =>
    set((state) => ({
      records: [
        {
          ...entry,
          id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          timestamp: Date.now(),
        },
        ...state.records,
      ].slice(0, MAX_AUDIT_RECORDS),
    })),
  clearRecords: () => set({ records: [] }),
}));
