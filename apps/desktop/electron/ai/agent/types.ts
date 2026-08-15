export type AgentType =
  | "daily_briefing"
  | "meeting_extractor"
  | "batch_triage"
  | "followup_sequence"
  | "custom";

export type AgentStatus =
  | "idle"
  | "planning"
  | "executing_tools"
  | "review_pending"
  | "completed"
  | "cancelled"
  | "error";

export type AgentStepEvent = {
  type: "step";
  stepIndex: number;
  totalSteps: number;
  message: string;
};

export type AgentTokenEvent = {
  type: "token";
  textChunk: string;
};

export type AgentProposalCalendarItem = {
  id: string;
  kind: "calendar_event";
  title: string;
  startTime: string;
  endTime?: string;
  location?: string;
  attendees?: string[];
  icsContent?: string;
  selected: boolean;
};

export type AgentProposalDraftItem = {
  id: string;
  kind: "draft_reply";
  targetTo: string;
  subject: string;
  body: string;
  selected: boolean;
};

export type AgentProposalSplitItem = {
  id: string;
  kind: "split_change";
  messageId: string;
  subject: string;
  targetSplit: "important" | "other";
  reason: string;
  selected: boolean;
};

export type AgentProposalItem =
  | AgentProposalCalendarItem
  | AgentProposalDraftItem
  | AgentProposalSplitItem;

export type AgentProposalData = {
  title: string;
  summary: string;
  items: AgentProposalItem[];
  rawResult?: string;
};

export type AgentProposalEvent = {
  type: "proposal";
  data: AgentProposalData;
};

export type AgentDoneEvent = {
  type: "done";
  summary: string;
};

export type AgentErrorEvent = {
  type: "error";
  code: string;
  message: string;
};

export type AgentStreamEvent =
  | AgentStepEvent
  | AgentTokenEvent
  | AgentProposalEvent
  | AgentDoneEvent
  | AgentErrorEvent;

export type AgentRunParams = {
  agentType: AgentType;
  prompt?: string;
  context?: Record<string, unknown>;
  requestId?: string;
};
