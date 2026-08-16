export type AgentType =
  | "summarize"
  | "draft_reply"
  | "quick_reply"
  | "action_items"
  | "commitments"
  | "thread_summary"
  | "suggest_split"
  | "translate"
  | "compose"
  | "rewrite"
  | "analyze_attachment"
  | "learn_user_tone"
  | "daily_briefing"
  | "meeting_extractor"
  | "batch_triage"
  | "followup_sequence"
  | "invoice_scanner"
  | "outreach_translator"
  | "smart_sorter"
  | "custom";

export type AgentStatus =
  | "idle"
  | "thinking"
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

export type AgentThinkingTokenEvent = {
  type: "thinking_token";
  textChunk: string;
};

export type AgentTokenEvent = {
  type: "token";
  textChunk: string;
};

export type AgentToolStartEvent = {
  type: "tool_start";
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
};

export type AgentToolUpdateEvent = {
  type: "tool_update";
  toolCallId: string;
  toolName: string;
  progressMessage: string;
};

export type AgentToolEndEvent = {
  type: "tool_end";
  toolCallId: string;
  toolName: string;
  success: boolean;
  result?: unknown;
  error?: string;
  durationMs: number;
};

export type AgentCompactionEvent = {
  type: "compaction";
  compactedTokens: number;
  summary: string;
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

export type AgentProposalInvoiceItem = {
  id: string;
  kind: "invoice_entry";
  invoiceNumber?: string;
  vendorName: string;
  amount: number;
  currency: string;
  category: string;
  date?: string;
  selected: boolean;
};

export type AgentProposalItem =
  | AgentProposalCalendarItem
  | AgentProposalDraftItem
  | AgentProposalSplitItem
  | AgentProposalInvoiceItem;

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
  thinking?: string;
};

export type AgentErrorEvent = {
  type: "error";
  code: string;
  message: string;
};

export type AgentStreamEvent =
  | AgentStepEvent
  | AgentThinkingTokenEvent
  | AgentTokenEvent
  | AgentToolStartEvent
  | AgentToolUpdateEvent
  | AgentToolEndEvent
  | AgentCompactionEvent
  | AgentProposalEvent
  | AgentDoneEvent
  | AgentErrorEvent;

export type AgentRunParams = {
  agentType: AgentType;
  prompt?: string;
  context?: Record<string, unknown>;
  requestId?: string;
  sessionId?: string;
  skillId?: string;
};

export type AgentSkillDefinition = {
  id: string;
  name: string;
  description: string;
  icon?: string;
  version: string;
  author?: string;
  tags?: string[];
  systemPrompt: string;
  allowedTools: string[];
  defaultParameters?: Record<string, unknown>;
  isCustom?: boolean;
  createdAt?: number;
  updatedAt?: number;
};

export type AgentSession = {
  id: string;
  title: string;
  skillId?: string;
  createdAt: number;
  updatedAt: number;
  compactedSummary?: string;
};

export type AgentMessageRecord = {
  id: string;
  sessionId: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  thinkingContent?: string;
  toolCalls?: string;
  proposals?: string;
  createdAt: number;
};

export interface BeforeToolCallResult {
  block?: boolean;
  reason?: string;
  terminate?: boolean;
}

export interface AfterToolCallResult {
  content?: string;
  details?: unknown;
  isError?: boolean;
  terminate?: boolean;
}
