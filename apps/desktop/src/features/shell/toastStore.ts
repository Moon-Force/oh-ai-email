import { create } from "zustand";

export type ToastSeverity = "success" | "error" | "info" | "warning";

export type Toast = {
  id: number;
  message: string;
  severity: ToastSeverity;
  /** ms; default 4500 */
  duration?: number;
};

type State = {
  toast: Toast | null;
  showToast: (message: string, severity?: ToastSeverity, duration?: number) => void;
  clearToast: () => void;
};

let seq = 1;

export const useToastStore = create<State>((set) => ({
  toast: null,
  showToast: (message, severity = "info", duration = 4500) =>
    set({
      toast: { id: seq++, message, severity, duration },
    }),
  clearToast: () => set({ toast: null }),
}));
