import { contextBridge, ipcRenderer } from "electron";

export type TlsMode = "ssl" | "starttls" | "none";

export type AccountDto = {
  id: string;
  email: string;
  displayName?: string;
  providerId?: string;
  imapHost: string;
  imapPort: number;
  imapTls: TlsMode;
  smtpHost: string;
  smtpPort: number;
  smtpTls: TlsMode;
  createdAt: number;
};

export type FolderDto = {
  id: string;
  accountId: string;
  remotePath: string;
  role: string;
  name: string;
  unread: number;
};

export type AttachmentDto = {
  id: string;
  filename: string;
  contentType: string;
  size: number;
};

export type MessageDto = {
  id: string;
  accountId: string;
  folderId: string;
  uid: number;
  from: string;
  fromName: string;
  subject: string;
  snippet: string;
  dateMs: number;
  dateLabel: string;
  unread: boolean;
  split: "important" | "other";
  html?: string;
  attachments?: AttachmentDto[];
};

export type AddAccountPayload = {
  email: string;
  password: string;
  displayName?: string;
  providerId?: string;
  imapHost: string;
  imapPort: number;
  imapTls: TlsMode;
  smtpHost: string;
  smtpPort: number;
  smtpTls: TlsMode;
};

export type TestResult = { ok: true; greeting?: string } | { ok: false; error: string };

export type AddResult =
  | { ok: true; account: AccountDto; sync: { accountId: string; folders: number; messages: number; error?: string } }
  | { ok: false; error: string };

export type MailSnapshot = {
  accounts: AccountDto[];
  activeAccountId: string | null;
  folders: FolderDto[];
  messages: MessageDto[];
};

export type SyncResultDto = {
  accountId: string;
  folders: number;
  messages: number;
  error?: string;
};

const api = {
  ping: (): Promise<string> => ipcRenderer.invoke("ping"),
  prefsGet: (): Promise<{ syncIntervalMin: number }> => ipcRenderer.invoke("prefs:get"),
  prefsSave: (partial: { syncIntervalMin?: number }): Promise<{ syncIntervalMin: number }> =>
    ipcRenderer.invoke("prefs:save", partial),
  secretSave: (k: string, v: string): Promise<boolean> => ipcRenderer.invoke("secret:save", k, v),
  secretLoad: (k: string): Promise<string | null> => ipcRenderer.invoke("secret:load", k),
  secretDelete: (k: string): Promise<boolean> => ipcRenderer.invoke("secret:delete", k),

  accountList: (): Promise<AccountDto[]> => ipcRenderer.invoke("account:list"),
  accountTest: (payload: AddAccountPayload): Promise<TestResult> => ipcRenderer.invoke("account:test", payload),
  accountAdd: (payload: AddAccountPayload): Promise<AddResult> => ipcRenderer.invoke("account:add", payload),
  accountRemove: (id: string): Promise<boolean> => ipcRenderer.invoke("account:remove", id),

  mailSync: (accountId?: string): Promise<SyncResultDto[]> => ipcRenderer.invoke("mail:sync", accountId),
  mailSnapshot: (accountId?: string): Promise<MailSnapshot> => ipcRenderer.invoke("mail:snapshot", accountId),
  mailGet: (id: string): Promise<MessageDto | null> => ipcRenderer.invoke("mail:get", id),
  mailMarkRead: (id: string): Promise<MessageDto | null> => ipcRenderer.invoke("mail:markRead", id),
  mailSetSplit: (
    id: string,
    split: "important" | "other",
  ): Promise<MessageDto | null> => ipcRenderer.invoke("mail:setSplit", id, split),
  mailSaveAttachment: (
    attachmentId: string,
  ): Promise<{ ok: true; path: string } | { ok: false; error: string }> =>
    ipcRenderer.invoke("mail:saveAttachment", attachmentId),
  mailOpenAttachment: (
    attachmentId: string,
  ): Promise<{ ok: true } | { ok: false; error: string }> =>
    ipcRenderer.invoke("mail:openAttachment", attachmentId),
  mailSend: (payload: {
    accountId?: string;
    to: string;
    cc?: string;
    subject: string;
    body: string;
    html?: string;
    attachments?: {
      filename: string;
      contentType?: string;
      contentBase64: string;
      size?: number;
    }[];
  }): Promise<
    | {
        ok: true;
        messageId?: string;
        localMessageId?: string;
        folderId?: string;
        appendedToServer?: boolean;
      }
    | { ok: false; error: string }
  > => ipcRenderer.invoke("mail:send", payload),

  mailSaveDraft: (payload: {
    accountId?: string;
    to: string;
    cc?: string;
    subject: string;
    body: string;
    html?: string;
  }): Promise<
    | {
        ok: true;
        localMessageId: string;
        folderId: string;
        appendedToServer?: boolean;
      }
    | { ok: false; error: string }
  > => ipcRenderer.invoke("mail:saveDraft", payload),

  aiGetSettings: (): Promise<{
    mode: "cloud" | "local";
    baseUrl: string;
    model: string;
    ollamaHost: string;
    ollamaModel: string;
    cloudPrivacyAck: boolean;
    preferLocalWhenAvailable: boolean;
    hasCloudApiKey: boolean;
  }> => ipcRenderer.invoke("ai:getSettings"),

  aiSaveSettings: (
    payload: {
      mode?: "cloud" | "local";
      baseUrl?: string;
      model?: string;
      ollamaHost?: string;
      ollamaModel?: string;
      cloudPrivacyAck?: boolean;
      preferLocalWhenAvailable?: boolean;
      apiKey?: string;
    },
  ): Promise<{
    mode: "cloud" | "local";
    baseUrl: string;
    model: string;
    ollamaHost: string;
    ollamaModel: string;
    cloudPrivacyAck: boolean;
    preferLocalWhenAvailable: boolean;
    hasCloudApiKey: boolean;
  }> => ipcRenderer.invoke("ai:saveSettings", payload),

  aiProbeOllama: (): Promise<{ ok: true; models: string[] } | { ok: false; error: string }> =>
    ipcRenderer.invoke("ai:probeOllama"),

  aiProbeCloud: (): Promise<
    { ok: true } | { ok: false; error: string; code?: string }
  > => ipcRenderer.invoke("ai:probeCloud"),

  aiListModels: (): Promise<{ ok: boolean; models: string[]; error?: string }> =>
    ipcRenderer.invoke("ai:listModels"),

  aiQueryBalance: (): Promise<AiBalanceResult> =>
    ipcRenderer.invoke("ai:queryBalance"),

  aiSynthesizeSpeech: (payload: {
    text: string;
    voice?: string;
  }): Promise<{ ok: boolean; audioData?: string; error?: string }> =>
    ipcRenderer.invoke("ai:synthesizeSpeech", payload),

  aiAbort: (requestId: string): Promise<boolean> => ipcRenderer.invoke("ai:abort", requestId),

  aiSummarize: (payload: {
    subject?: string;
    from?: string;
    body: string;
    mode?: "cloud" | "local";
    requestId?: string;
  }): Promise<AiTaskResult> => ipcRenderer.invoke("ai:summarize", payload),

  aiDraftReply: (payload: {
    subject?: string;
    from?: string;
    body: string;
    userPersona?: string;
    mode?: "cloud" | "local";
    requestId?: string;
  }): Promise<AiTaskResult> => ipcRenderer.invoke("ai:draftReply", payload),

  aiQuickReply: (payload: {
    subject?: string;
    from?: string;
    body: string;
    replyType: string;
    customNote?: string;
    mode?: "cloud" | "local";
    requestId?: string;
  }): Promise<AiTaskResult> => ipcRenderer.invoke("ai:quickReply", payload),

  aiActionItems: (payload: {
    subject?: string;
    from?: string;
    body: string;
    mode?: "cloud" | "local";
    requestId?: string;
  }): Promise<AiActionItemsResult> => ipcRenderer.invoke("ai:actionItems", payload),

  aiRewrite: (payload: {
    text: string;
    tone: "shorter" | "formal" | "expand" | "persona";
    userPersona?: string;
    mode?: "cloud" | "local";
    requestId?: string;
  }): Promise<AiTaskResult> => ipcRenderer.invoke("ai:rewrite", payload),

  aiCompose: (payload: {
    prompt: string;
    existingBody?: string;
    mode?: "cloud" | "local";
    requestId?: string;
  }): Promise<AiTaskResult> => ipcRenderer.invoke("ai:compose", payload),

  aiThreadSummary: (payload: {
    subject?: string;
    messages: { sender: string; date?: string; body: string }[];
    mode?: "cloud" | "local";
    requestId?: string;
  }): Promise<AiThreadSummaryResult> => ipcRenderer.invoke("ai:threadSummary", payload),

  aiSuggestSplit: (payload: {
    subject?: string;
    sender?: string;
    from?: string;
    body: string;
    mode?: "cloud" | "local";
    requestId?: string;
  }): Promise<AiSuggestSplitResult> => ipcRenderer.invoke("ai:suggestSplit", payload),

  aiTranslate: (payload: {
    text: string;
    targetLang?: "zh" | "en";
    mode?: "cloud" | "local";
    requestId?: string;
  }): Promise<AiTaskResult> => ipcRenderer.invoke("ai:translate", payload),

  aiLearnUserTone: (payload: {
    accountId?: string;
    mode?: "cloud" | "local";
    requestId?: string;
  }): Promise<AiUserPersonaResult> => ipcRenderer.invoke("ai:learnUserTone", payload),

  aiAnalyzeAttachment: (payload: {
    filename: string;
    contentType?: string;
    textContent?: string;
    base64Data?: string;
    mode?: "cloud" | "local";
    requestId?: string;
  }): Promise<AiTaskResult> => ipcRenderer.invoke("ai:analyzeAttachment", payload),

  mailIdleStatus: () => ipcRenderer.invoke("mail:idleStatus"),

  onMailEvent: (
    channel: "mail:open-message" | "mail:trigger-sync" | "mail:open-compose" | "mail:pushed",
    callback: (data: unknown) => void,
  ): (() => void) => {
    const listener = (_e: Electron.IpcRendererEvent, data: unknown) => callback(data);
    ipcRenderer.on(channel, listener);
    return () => {
      ipcRenderer.removeListener(channel, listener);
    };
  },

  agentRun: (
    params: AgentRunParams,
    onEvent?: (evt: AgentStreamEvent) => void,
  ): Promise<AgentProposalData> => {
    const listener = (
      _e: Electron.IpcRendererEvent,
      data: AgentStreamEvent & { requestId?: string },
    ) => {
      if (!params.requestId || data.requestId === params.requestId) {
        onEvent?.(data);
      }
    };
    ipcRenderer.on("agent:stream-event", listener);
    return ipcRenderer.invoke("agent:run", params).finally(() => {
      ipcRenderer.removeListener("agent:stream-event", listener);
    });
  },

  agentAbort: (requestId: string): Promise<boolean> =>
    ipcRenderer.invoke("agent:abort", requestId),
};

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

export type AgentStreamEvent =
  | AgentStepEvent
  | AgentTokenEvent
  | { type: "proposal"; data: AgentProposalData }
  | { type: "done"; summary: string }
  | { type: "error"; code: string; message: string };

export type AgentRunParams = {
  agentType: AgentType;
  prompt?: string;
  context?: Record<string, unknown>;
  requestId?: string;
};

type AiTaskResult =
  | { ok: true; text: string; reasoningContent?: string; mode: "cloud" | "local" }
  | { ok: false; code: string; error: string };

export type AiBalanceInfo = {
  currency: string;
  total_balance: string;
  granted_balance: string;
  topped_up_balance: string;
};

export type AiBalanceResult =
  | { ok: true; isAvailable: boolean; balanceInfos: AiBalanceInfo[] }
  | { ok: false; error: string };

type AiActionItemsResult =
  | {
      ok: true;
      tags: string[];
      actionItems: string[];
      deadline?: string;
      mode: "cloud" | "local";
    }
  | { ok: false; code: string; error: string };

type AiThreadSummaryResult =
  | {
      ok: true;
      summary: string;
      timeline: { sender: string; date?: string; point: string }[];
      mode: "cloud" | "local";
    }
  | { ok: false; code: string; error: string };

type AiSuggestSplitResult =
  | {
      ok: true;
      split: "important" | "other";
      reason: string;
      confidence?: "high" | "medium" | "low" | string;
      mode: "cloud" | "local";
    }
  | { ok: false; code: string; error: string };

export type AiUserPersonaResult =
  | {
      ok: true;
      personaSummary: string;
      toneStyle: string;
      greetingHabit: string;
      signoffHabit: string;
      keyTraits: string[];
      mode: "cloud" | "local";
    }
  | { ok: false; code: string; error: string };

contextBridge.exposeInMainWorld("api", api);

declare global {
  interface Window {
    api: typeof api;
  }
}


