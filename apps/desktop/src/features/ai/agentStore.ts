import { create } from "zustand";
import {
  agentAbort,
  agentRun,
  mailSaveDraft,
  type AgentProposalCalendarItem,
  type AgentProposalData,
  type AgentProposalDraftItem,
  type AgentProposalItem,
  type AgentProposalSplitItem,
  type AgentStatus,
  type AgentStepEvent,
  type AgentStreamEvent,
  type AgentType,
} from "../../lib/ipc";
import { useMailStore } from "../mail/store";
import { useAiAuditStore } from "./auditStore";

export interface AgentStoreState {
  open: boolean;
  agentType: AgentType;
  status: AgentStatus;
  steps: AgentStepEvent[];
  currentStepIndex: number;
  streamText: string;
  proposal: AgentProposalData | null;
  activeReqId: string | null;
  error: string | null;
  prompt: string;
  context: Record<string, unknown>;

  // Actions
  openDrawer: (agentType?: AgentType, context?: Record<string, unknown>, prompt?: string) => void;
  closeDrawer: () => void;
  setAgentType: (type: AgentType) => void;
  setPrompt: (p: string) => void;
  runWorkflow: (
    agentType?: AgentType,
    prompt?: string,
    context?: Record<string, unknown>
  ) => Promise<void>;
  abortWorkflow: () => Promise<void>;
  toggleItemSelection: (id: string) => void;
  selectAllItems: (selected: boolean) => void;
  acceptSelected: () => Promise<{
    acceptedCount: number;
    drafts: AgentProposalDraftItem[];
    calendarEvents: AgentProposalCalendarItem[];
    splitChanges: AgentProposalSplitItem[];
  }>;
  acceptAll: () => Promise<{
    acceptedCount: number;
    drafts: AgentProposalDraftItem[];
    calendarEvents: AgentProposalCalendarItem[];
    splitChanges: AgentProposalSplitItem[];
  }>;
  dismiss: () => void;
  reset: () => void;
}

export const useAgentStore = create<AgentStoreState>((set, get) => ({
  open: false,
  agentType: "daily_briefing",
  status: "idle",
  steps: [],
  currentStepIndex: 0,
  streamText: "",
  proposal: null,
  activeReqId: null,
  error: null,
  prompt: "",
  context: {},

  openDrawer: (agentType, context, prompt) => {
    set((s) => ({
      open: true,
      agentType: agentType ?? s.agentType,
      context: context ?? s.context,
      prompt: prompt !== undefined ? prompt : s.prompt,
    }));
  },

  closeDrawer: () => {
    set({ open: false });
  },

  setAgentType: (agentType) => {
    set({ agentType });
  },

  setPrompt: (prompt) => {
    set({ prompt });
  },

  runWorkflow: async (agentType, prompt, context) => {
    const targetType = agentType ?? get().agentType;
    const targetPrompt = prompt !== undefined ? prompt : get().prompt;
    const targetContext = context ?? get().context;
    const requestId = `agent_run_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const startTime = Date.now();

    set({
      agentType: targetType,
      prompt: targetPrompt,
      context: targetContext,
      status: "planning",
      steps: [],
      currentStepIndex: 0,
      streamText: "",
      proposal: null,
      activeReqId: requestId,
      error: null,
    });

    try {
      const proposal = await agentRun(
        {
          agentType: targetType,
          prompt: targetPrompt,
          context: targetContext,
          requestId,
        },
        (evt: AgentStreamEvent) => {
          if (evt.type === "step") {
            set((s) => ({
              steps: [...s.steps.filter((st) => st.stepIndex !== evt.stepIndex), evt],
              currentStepIndex: evt.stepIndex,
              status:
                evt.stepIndex === 1
                  ? "planning"
                  : evt.stepIndex === 2
                    ? "executing_tools"
                    : "review_pending",
            }));
          } else if (evt.type === "token") {
            set((s) => ({ streamText: s.streamText + evt.textChunk }));
          } else if (evt.type === "proposal") {
            set({ proposal: evt.data, status: "review_pending" });
          } else if (evt.type === "done") {
            set((s) => ({
              status: s.proposal ? "review_pending" : "completed",
            }));
          } else if (evt.type === "error") {
            set({
              status: evt.code === "ABORTED" ? "cancelled" : "error",
              error: evt.message,
            });
          }
        }
      );

      set({
        proposal,
        status: "review_pending",
        activeReqId: null,
      });

      useAiAuditStore.getState().recordCall({
        mode: "cloud",
        task: `agent:${targetType}`,
        charCount: targetPrompt.length + (proposal?.summary?.length ?? 0),
        durationMs: Date.now() - startTime,
        status: "success",
      });
    } catch (err) {
      const isAbort =
        err instanceof Error && (err.name === "AbortError" || err.message.includes("已取消"));

      set({
        status: isAbort ? "cancelled" : "error",
        error: err instanceof Error ? err.message : String(err),
        activeReqId: null,
      });

      useAiAuditStore.getState().recordCall({
        mode: "cloud",
        task: `agent:${targetType}`,
        charCount: targetPrompt.length,
        durationMs: Date.now() - startTime,
        status: isAbort ? "aborted" : "error",
      });
    }
  },

  abortWorkflow: async () => {
    const reqId = get().activeReqId;
    if (reqId) {
      await agentAbort(reqId);
    }
    set({
      status: "cancelled",
      error: "任务已手动取消",
      activeReqId: null,
    });
  },

  toggleItemSelection: (id: string) => {
    const proposal = get().proposal;
    if (!proposal) return;

    const nextItems = proposal.items.map((item) =>
      item.id === id ? { ...item, selected: !item.selected } : item
    );

    set({
      proposal: {
        ...proposal,
        items: nextItems,
      },
    });
  },

  selectAllItems: (selected: boolean) => {
    const proposal = get().proposal;
    if (!proposal) return;

    const nextItems = proposal.items.map((item) => ({ ...item, selected }));

    set({
      proposal: {
        ...proposal,
        items: nextItems,
      },
    });
  },

  acceptSelected: async () => {
    const proposal = get().proposal;
    if (!proposal) {
      return { acceptedCount: 0, drafts: [], calendarEvents: [], splitChanges: [] };
    }

    const selectedItems = proposal.items.filter((i) => i.selected);
    const drafts: AgentProposalDraftItem[] = [];
    const calendarEvents: AgentProposalCalendarItem[] = [];
    const splitChanges: AgentProposalSplitItem[] = [];

    for (const item of selectedItems) {
      if (item.kind === "split_change") {
        splitChanges.push(item);
        if (item.messageId && (item.targetSplit === "important" || item.targetSplit === "other")) {
          useMailStore.getState().setMessageSplit(item.messageId, item.targetSplit);
        }
      } else if (item.kind === "draft_reply") {
        drafts.push(item);
        void mailSaveDraft({
          to: item.targetTo,
          subject: item.subject,
          body: item.body,
        });
      } else if (item.kind === "calendar_event") {
        calendarEvents.push(item);
        if (item.icsContent && typeof window !== "undefined") {
          try {
            const blob = new Blob([item.icsContent], { type: "text/calendar;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${item.title.replace(/[^\w\u4e00-\u9fa5-_]+/g, "_")}.ics`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          } catch {
            // Ignore download error in non-browser context
          }
        }
      }
    }

    set({
      status: "completed",
      proposal: {
        ...proposal,
        summary: `已成功采纳 ${selectedItems.length} 项操作（草稿 ${drafts.length} 封，日程 ${calendarEvents.length} 项，分箱 ${splitChanges.length} 条）。`,
      },
    });

    return {
      acceptedCount: selectedItems.length,
      drafts,
      calendarEvents,
      splitChanges,
    };
  },

  acceptAll: async () => {
    get().selectAllItems(true);
    return get().acceptSelected();
  },

  dismiss: () => {
    set({
      proposal: null,
      status: "idle",
      streamText: "",
      steps: [],
      error: null,
    });
  },

  reset: () => {
    set({
      status: "idle",
      steps: [],
      currentStepIndex: 0,
      streamText: "",
      proposal: null,
      activeReqId: null,
      error: null,
      prompt: "",
    });
  },
}));
