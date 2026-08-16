import { create } from "zustand";
import {
  agentAbort,
  agentListSkills,
  agentRun,
  mailSaveDraft,
  type AgentProposalCalendarItem,
  type AgentProposalData,
  type AgentProposalDraftItem,
  type AgentProposalInvoiceItem,
  type AgentProposalSplitItem,
  type AgentSkillDefinition,
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
  thinkingText: string;
  streamText: string;
  proposal: AgentProposalData | null;
  activeReqId: string | null;
  error: string | null;
  prompt: string;
  context: Record<string, unknown>;

  // Skills
  skills: AgentSkillDefinition[];
  selectedSkillId: string | null;

  // Actions
  openDrawer: (agentType?: AgentType, context?: Record<string, unknown>, prompt?: string) => void;
  closeDrawer: () => void;
  setAgentType: (type: AgentType) => void;
  setPrompt: (p: string) => void;
  loadSkills: () => Promise<void>;
  selectSkill: (skillId: string) => void;
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
    invoices: AgentProposalInvoiceItem[];
  }>;
  acceptAll: () => Promise<{
    acceptedCount: number;
    drafts: AgentProposalDraftItem[];
    calendarEvents: AgentProposalCalendarItem[];
    splitChanges: AgentProposalSplitItem[];
    invoices: AgentProposalInvoiceItem[];
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
  thinkingText: "",
  streamText: "",
  proposal: null,
  activeReqId: null,
  error: null,
  prompt: "",
  context: {},
  skills: [],
  selectedSkillId: "meeting_extractor",

  openDrawer: (agentType, context, prompt) => {
    set((s) => ({
      open: true,
      agentType: agentType ?? s.agentType,
      selectedSkillId: agentType ?? s.selectedSkillId,
      context: context ?? s.context,
      prompt: prompt !== undefined ? prompt : s.prompt,
    }));
    get().loadSkills();
  },

  closeDrawer: () => {
    set({ open: false });
  },

  setAgentType: (agentType) => {
    set({ agentType, selectedSkillId: agentType });
  },

  setPrompt: (prompt) => {
    set({ prompt });
  },

  loadSkills: async () => {
    try {
      const skills = await agentListSkills();
      if (skills && skills.length > 0) {
        set({ skills });
      }
    } catch {
      // ignore
    }
  },

  selectSkill: (skillId) => {
    set({
      selectedSkillId: skillId,
      agentType: (skillId as AgentType) || "custom",
    });
  },

  runWorkflow: async (agentType, prompt, context) => {
    const targetType = agentType ?? get().agentType;
    const targetPrompt = prompt !== undefined ? prompt : get().prompt;
    const targetContext = context ?? get().context;
    const requestId = `agent_run_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const startTime = Date.now();

    set({
      status: "planning",
      error: null,
      steps: [],
      currentStepIndex: 0,
      thinkingText: "",
      streamText: "",
      proposal: null,
      activeReqId: requestId,
      agentType: targetType,
      prompt: targetPrompt,
      context: targetContext,
    });

    try {
      const proposal = await agentRun(
        {
          agentType: targetType,
          skillId: get().selectedSkillId || undefined,
          prompt: targetPrompt,
          context: targetContext,
          requestId,
        },
        (evt: AgentStreamEvent) => {
          if (get().activeReqId !== requestId) return;

          switch (evt.type) {
            case "step":
              set((s) => ({
                steps: [...s.steps.filter((st) => st.stepIndex !== evt.stepIndex), evt],
                currentStepIndex: evt.stepIndex,
                status: evt.stepIndex === 2 ? "executing_tools" : "planning",
              }));
              break;
            case "thinking_token":
              set((s) => ({
                thinkingText: s.thinkingText + evt.textChunk,
                status: "thinking",
              }));
              break;
            case "token":
              set((s) => ({
                streamText: s.streamText + evt.textChunk,
              }));
              break;
            case "compaction":
              set((s) => ({
                streamText: s.streamText + `\n[系统] 已自动压缩前序历史对话 (${evt.compactedTokens} tokens)\n`,
              }));
              break;
            case "proposal":
              set({
                proposal: evt.data,
                status: "review_pending",
              });
              break;
            case "done":
              set((s) => ({
                status: s.proposal ? "review_pending" : "completed",
              }));
              break;
            case "error":
              set({
                status: evt.code === "ABORTED" ? "cancelled" : "error",
                error: evt.message,
              });
              break;
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
        charCount: proposal.summary.length,
        durationMs: Date.now() - startTime,
        status: "success",
      });
    } catch (err: unknown) {
      if (get().activeReqId === requestId) {
        const isAbort = err instanceof Error && err.name === "AbortError";
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
    }
  },

  abortWorkflow: async () => {
    const { activeReqId } = get();
    if (activeReqId) {
      await agentAbort(activeReqId);
      set({ status: "cancelled", activeReqId: null });
    }
  },

  toggleItemSelection: (id: string) => {
    set((s) => {
      if (!s.proposal) return s;
      return {
        proposal: {
          ...s.proposal,
          items: s.proposal.items.map((it) =>
            it.id === id ? { ...it, selected: !it.selected } : it
          ),
        },
      };
    });
  },

  selectAllItems: (selected: boolean) => {
    set((s) => {
      if (!s.proposal) return s;
      return {
        proposal: {
          ...s.proposal,
          items: s.proposal.items.map((it) => ({ ...it, selected })),
        },
      };
    });
  },

  acceptSelected: async () => {
    const { proposal } = get();
    if (!proposal) {
      return { acceptedCount: 0, drafts: [], calendarEvents: [], splitChanges: [], invoices: [] };
    }

    const selectedItems = proposal.items.filter((it) => it.selected);
    const drafts: AgentProposalDraftItem[] = [];
    const calendarEvents: AgentProposalCalendarItem[] = [];
    const splitChanges: AgentProposalSplitItem[] = [];
    const invoices: AgentProposalInvoiceItem[] = [];

    const mailStore = useMailStore.getState();

    for (const item of selectedItems) {
      if (item.kind === "draft_reply") {
        drafts.push(item);
        try {
          await mailSaveDraft({
            to: item.targetTo,
            subject: item.subject,
            body: item.body,
          });
        } catch {
          // ignore draft saving error
        }
      } else if (item.kind === "calendar_event") {
        calendarEvents.push(item);
      } else if (item.kind === "split_change") {
        splitChanges.push(item);
        mailStore.setMessageSplit(item.messageId, item.targetSplit);
      } else if (item.kind === "invoice_entry") {
        invoices.push(item);
      }
    }

    set({
      status: "completed",
    });

    return {
      acceptedCount: selectedItems.length,
      drafts,
      calendarEvents,
      splitChanges,
      invoices,
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
      steps: [],
      currentStepIndex: 0,
      thinkingText: "",
      streamText: "",
      error: null,
    });
  },

  reset: () => {
    set({
      open: false,
      agentType: "daily_briefing",
      status: "idle",
      steps: [],
      currentStepIndex: 0,
      thinkingText: "",
      streamText: "",
      proposal: null,
      activeReqId: null,
      error: null,
      prompt: "",
      context: {},
    });
  },
}));
