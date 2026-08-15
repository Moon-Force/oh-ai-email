/** Typed wrappers around window.api (Electron preload). Safe no-ops in browser tests. */

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
  | {
      ok: true;
      account: AccountDto;
      sync: { accountId: string; folders: number; messages: number; error?: string };
    }
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

type Api = {
  ping: () => Promise<string>;
  prefsGet: () => Promise<AppPrefsDto>;
  prefsSave: (partial: Partial<AppPrefsDto>) => Promise<AppPrefsDto>;
  secretSave: (k: string, v: string) => Promise<boolean>;
  secretLoad: (k: string) => Promise<string | null>;
  secretDelete: (k: string) => Promise<boolean>;
  accountList: () => Promise<AccountDto[]>;
  accountTest: (payload: AddAccountPayload) => Promise<TestResult>;
  accountAdd: (payload: AddAccountPayload) => Promise<AddResult>;
  accountRemove: (id: string) => Promise<boolean>;
  mailSync: (accountId?: string) => Promise<SyncResultDto[]>;
  mailSnapshot: (accountId?: string) => Promise<MailSnapshot>;
  mailGet: (id: string) => Promise<MessageDto | null>;
  mailMarkRead: (id: string) => Promise<MessageDto | null>;
  mailSetSplit: (id: string, split: "important" | "other") => Promise<MessageDto | null>;
  mailSaveAttachment: (
    attachmentId: string,
  ) => Promise<{ ok: true; path: string } | { ok: false; error: string }>;
  mailOpenAttachment: (
    attachmentId: string,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  mailSend: (payload: SendMailPayload) => Promise<SendMailResult>;
  mailSaveDraft: (payload: SaveDraftPayload) => Promise<SaveDraftResult>;
  aiGetSettings: () => Promise<AiSettingsDto>;
  aiSaveSettings: (payload: AiSaveSettingsPayload) => Promise<AiSettingsDto>;
  aiProbeOllama: () => Promise<AiProbeOllamaResult>;
  aiProbeCloud: () => Promise<AiProbeCloudResult>;
  aiAbort: (requestId: string) => Promise<boolean>;
  aiSummarize: (payload: AiMailPayload) => Promise<AiTaskResult>;
  aiDraftReply: (payload: AiMailPayload) => Promise<AiTaskResult>;
  aiQuickReply: (payload: AiQuickReplyPayload) => Promise<AiTaskResult>;
  aiActionItems: (payload: AiMailPayload) => Promise<AiActionItemsResult>;
  aiRewrite: (payload: AiRewritePayload) => Promise<AiTaskResult>;
  aiCompose: (payload: AiComposePayload) => Promise<AiTaskResult>;
  aiThreadSummary: (payload: AiThreadSummaryPayload) => Promise<AiThreadSummaryResult>;
  aiSuggestSplit: (payload: AiSuggestSplitPayload) => Promise<AiSuggestSplitResult>;
  aiTranslate: (payload: {
    text: string;
    targetLang?: "zh" | "en";
    mode?: AiModeDto;
    requestId?: string;
  }) => Promise<AiTaskResult>;
  aiListModels: () => Promise<AiListModelsResult>;
  aiQueryBalance: () => Promise<AiBalanceResult>;
  aiSynthesizeSpeech: (payload: {
    text: string;
    voice?: string;
  }) => Promise<AiSynthesizeSpeechResult>;
  agentRun: (
    params: AgentRunParams,
    onEvent?: (evt: AgentStreamEvent) => void,
  ) => Promise<AgentProposalData>;
  agentAbort: (requestId: string) => Promise<boolean>;
};

export type AiModeDto = "cloud" | "local";

export type AiSettingsDto = {
  mode: AiModeDto;
  baseUrl: string;
  model: string;
  ollamaHost: string;
  ollamaModel: string;
  cloudPrivacyAck: boolean;
  preferLocalWhenAvailable: boolean;
  redactSensitiveData: boolean;
  hasCloudApiKey: boolean;
};

export type AiSaveSettingsPayload = Partial<
  Omit<AiSettingsDto, "hasCloudApiKey">
> & { apiKey?: string };

export type AiTaskResult =
  | { ok: true; text: string; reasoningContent?: string; mode: AiModeDto }
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

export type AiListModelsResult =
  | { ok: true; models: string[] }
  | { ok: false; error: string };

export type AiSynthesizeSpeechResult =
  | { ok: true; audioData: string }
  | { ok: false; error: string };

export type AiActionItemsResult =
  | {
      ok: true;
      tags: string[];
      actionItems: string[];
      deadline?: string;
      mode: AiModeDto;
    }
  | { ok: false; code: string; error: string };

export type AiThreadMessageDto = {
  sender: string;
  date?: string;
  body: string;
};

export type AiThreadSummaryItemDto = {
  sender: string;
  date?: string;
  point: string;
};

export type AiThreadSummaryResult =
  | {
      ok: true;
      summary: string;
      timeline: AiThreadSummaryItemDto[];
      mode: AiModeDto;
    }
  | { ok: false; code: string; error: string };

export type AiThreadSummaryPayload = {
  subject?: string;
  messages: AiThreadMessageDto[];
  mode?: AiModeDto;
  requestId?: string;
};

export type AiSuggestSplitResult =
  | {
      ok: true;
      split: "important" | "other";
      reason: string;
      confidence?: "high" | "medium" | "low" | string;
      mode: AiModeDto;
    }
  | { ok: false; code: string; error: string };

export type AiSuggestSplitPayload = {
  subject?: string;
  sender?: string;
  from?: string;
  body: string;
  mode?: AiModeDto;
  requestId?: string;
};


export type AiMailPayload = {
  subject?: string;
  from?: string;
  body: string;
  mode?: AiModeDto;
  requestId?: string;
};

export type AiQuickReplyPayload = {
  subject?: string;
  from?: string;
  body: string;
  replyType: string;
  customNote?: string;
  mode?: AiModeDto;
  requestId?: string;
};

export type AiRewritePayload = {
  text: string;
  tone: "shorter" | "formal" | "expand";
  mode?: AiModeDto;
  requestId?: string;
};

export type AiComposePayload = {
  prompt: string;
  existingBody?: string;
  mode?: AiModeDto;
  requestId?: string;
};

export type AiProbeOllamaResult =
  | { ok: true; models: string[] }
  | { ok: false; error: string };

export type AiProbeCloudResult =
  | { ok: true }
  | { ok: false; error: string; code?: string };

export type SendMailAttachment = {
  filename: string;
  contentType?: string;
  contentBase64: string;
  size?: number;
};

export type SendMailPayload = {
  accountId?: string;
  to: string;
  cc?: string;
  subject: string;
  body: string;
  html?: string;
  attachments?: SendMailAttachment[];
};

export type SendMailResult =
  | {
      ok: true;
      messageId?: string;
      localMessageId?: string;
      folderId?: string;
      appendedToServer?: boolean;
    }
  | { ok: false; error: string };

export type SaveDraftPayload = {
  accountId?: string;
  to: string;
  cc?: string;
  subject: string;
  body: string;
  html?: string;
};

export type SaveDraftResult =
  | {
      ok: true;
      localMessageId: string;
      folderId: string;
      appendedToServer?: boolean;
    }
  | { ok: false; error: string };

function getApi(): Api | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { api?: Api }).api ?? null;
}

export function hasDesktopApi(): boolean {
  return getApi() != null;
}

export async function ping(): Promise<string> {
  return getApi()?.ping() ?? "pong";
}

export type AppPrefsDto = {
  /** 0 = manual only */
  syncIntervalMin: number;
};

export async function prefsGet(): Promise<AppPrefsDto> {
  const api = getApi();
  if (!api?.prefsGet) return { syncIntervalMin: 5 };
  return api.prefsGet();
}

export async function prefsSave(partial: Partial<AppPrefsDto>): Promise<AppPrefsDto> {
  const api = getApi();
  if (!api?.prefsSave) {
    return { syncIntervalMin: partial.syncIntervalMin ?? 5 };
  }
  return api.prefsSave(partial);
}

export async function accountTest(payload: AddAccountPayload): Promise<TestResult> {
  const api = getApi();
  if (!api) return { ok: false, error: "仅桌面端可测试 IMAP 连接" };
  return api.accountTest(payload);
}

export async function accountAdd(payload: AddAccountPayload): Promise<AddResult> {
  const api = getApi();
  if (!api) return { ok: false, error: "仅桌面端可添加账号" };
  return api.accountAdd(payload);
}

export async function accountRemove(id: string): Promise<boolean> {
  return getApi()?.accountRemove(id) ?? false;
}

export async function mailSnapshot(accountId?: string): Promise<MailSnapshot> {
  const api = getApi();
  if (!api) {
    return { accounts: [], activeAccountId: null, folders: [], messages: [] };
  }
  return api.mailSnapshot(accountId);
}

export async function mailSync(accountId?: string): Promise<SyncResultDto[]> {
  return getApi()?.mailSync(accountId) ?? [];
}

export async function mailMarkRead(id: string): Promise<MessageDto | null> {
  return getApi()?.mailMarkRead(id) ?? null;
}

export async function mailSetSplit(
  id: string,
  split: "important" | "other",
): Promise<MessageDto | null> {
  return getApi()?.mailSetSplit(id, split) ?? null;
}

export async function mailSaveAttachment(
  attachmentId: string,
): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  const api = getApi();
  if (!api) return { ok: false, error: "仅桌面端可下载附件" };
  return api.mailSaveAttachment(attachmentId);
}

export async function mailOpenAttachment(
  attachmentId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const api = getApi();
  if (!api) return { ok: false, error: "仅桌面端可打开附件" };
  return api.mailOpenAttachment(attachmentId);
}

export async function mailGet(id: string): Promise<MessageDto | null> {
  return getApi()?.mailGet(id) ?? null;
}

export async function mailSend(payload: SendMailPayload): Promise<SendMailResult> {
  const api = getApi();
  if (!api) {
    return { ok: false, error: "仅桌面端可发送邮件（当前为浏览器/测试环境）" };
  }
  return api.mailSend(payload);
}

export async function mailSaveDraft(payload: SaveDraftPayload): Promise<SaveDraftResult> {
  const api = getApi();
  if (!api) {
    return { ok: false, error: "仅桌面端可存草稿（当前为浏览器/测试环境）" };
  }
  return api.mailSaveDraft(payload);
}

const AI_BROWSER_ERR =
  "仅桌面端可调用 AI。请在 Electron 中运行，并到设置 → AI 配置密钥或 Ollama。";

export async function aiGetSettings(): Promise<AiSettingsDto> {
  const api = getApi();
  if (!api) {
    return {
      mode: "cloud",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-4o-mini",
      ollamaHost: "http://127.0.0.1:11434",
      ollamaModel: "llama3.2",
      cloudPrivacyAck: false,
      preferLocalWhenAvailable: false,
      redactSensitiveData: false,
      hasCloudApiKey: false,
    };
  }
  return api.aiGetSettings();
}

export async function aiSaveSettings(payload: AiSaveSettingsPayload): Promise<AiSettingsDto> {
  const api = getApi();
  if (!api) {
    return {
      mode: payload.mode ?? "cloud",
      baseUrl: payload.baseUrl ?? "https://api.openai.com/v1",
      model: payload.model ?? "gpt-4o-mini",
      ollamaHost: payload.ollamaHost ?? "http://127.0.0.1:11434",
      ollamaModel: payload.ollamaModel ?? "llama3.2",
      cloudPrivacyAck: payload.cloudPrivacyAck ?? false,
      preferLocalWhenAvailable: payload.preferLocalWhenAvailable ?? false,
      redactSensitiveData: payload.redactSensitiveData ?? false,
      hasCloudApiKey: Boolean(payload.apiKey?.trim()),
    };
  }
  return api.aiSaveSettings(payload);
}

export async function aiProbeOllama(): Promise<AiProbeOllamaResult> {
  return getApi()?.aiProbeOllama() ?? { ok: false, error: "仅桌面端可探测 Ollama" };
}

export async function aiProbeCloud(): Promise<AiProbeCloudResult> {
  return getApi()?.aiProbeCloud() ?? { ok: false, error: "仅桌面端可探测云端", code: "CONFIG" };
}

export async function aiAbort(requestId: string): Promise<boolean> {
  return getApi()?.aiAbort(requestId) ?? false;
}

export async function aiListModels(): Promise<AiListModelsResult> {
  const api = getApi();
  if (!api?.aiListModels) {
    return { ok: true, models: ["deepseek-chat", "deepseek-reasoner", "mimo-v2.5", "gpt-4o-mini", "llama3.2"] };
  }
  return api.aiListModels();
}

export async function aiQueryBalance(): Promise<AiBalanceResult> {
  const api = getApi();
  if (!api?.aiQueryBalance) {
    return {
      ok: true,
      isAvailable: true,
      balanceInfos: [
        {
          currency: "CNY",
          total_balance: "50.00",
          granted_balance: "10.00",
          topped_up_balance: "40.00",
        },
      ],
    };
  }
  return api.aiQueryBalance();
}

export async function aiSynthesizeSpeech(payload: {
  text: string;
  voice?: string;
}): Promise<AiSynthesizeSpeechResult> {
  const api = getApi();
  if (!api?.aiSynthesizeSpeech) {
    return { ok: false, error: "仅桌面端可调用云端语音合成" };
  }
  return api.aiSynthesizeSpeech(payload);
}

export async function aiSummarize(payload: AiMailPayload): Promise<AiTaskResult> {
  const api = getApi();
  if (!api) return { ok: false, code: "CONFIG", error: AI_BROWSER_ERR };
  return api.aiSummarize(payload);
}

export async function aiDraftReply(payload: AiMailPayload): Promise<AiTaskResult> {
  const api = getApi();
  if (!api) return { ok: false, code: "CONFIG", error: AI_BROWSER_ERR };
  return api.aiDraftReply(payload);
}

export async function aiQuickReply(payload: AiQuickReplyPayload): Promise<AiTaskResult> {
  const api = getApi();
  if (!api) return { ok: false, code: "CONFIG", error: AI_BROWSER_ERR };
  return api.aiQuickReply(payload);
}

export async function aiActionItems(payload: AiMailPayload): Promise<AiActionItemsResult> {
  const api = getApi();
  if (!api) return { ok: false, code: "CONFIG", error: AI_BROWSER_ERR };
  return api.aiActionItems(payload);
}

export async function aiRewrite(payload: AiRewritePayload): Promise<AiTaskResult> {
  const api = getApi();
  if (!api) return { ok: false, code: "CONFIG", error: AI_BROWSER_ERR };
  return api.aiRewrite(payload);
}

export async function aiCompose(payload: AiComposePayload): Promise<AiTaskResult> {
  const api = getApi();
  if (!api) return { ok: false, code: "CONFIG", error: AI_BROWSER_ERR };
  return api.aiCompose(payload);
}

export async function aiThreadSummary(
  payload: AiThreadSummaryPayload,
): Promise<AiThreadSummaryResult> {
  const api = getApi();
  if (!api) return { ok: false, code: "CONFIG", error: AI_BROWSER_ERR };
  return api.aiThreadSummary(payload);
}

export async function aiSuggestSplit(
  payload: AiSuggestSplitPayload,
): Promise<AiSuggestSplitResult> {
  const api = getApi();
  if (!api) return { ok: false, code: "CONFIG", error: AI_BROWSER_ERR };
  return api.aiSuggestSplit(payload);
}

export async function aiTranslate(payload: {
  text: string;
  targetLang?: "zh" | "en";
  mode?: AiModeDto;
  requestId?: string;
}): Promise<AiTaskResult> {
  const api = getApi();
  if (!api) return { ok: false, code: "CONFIG", error: AI_BROWSER_ERR };
  return api.aiTranslate(payload);
}

// ── Agent Stream & Workflow Foundation ──────────────────────────

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

export async function agentRun(
  params: AgentRunParams,
  onEvent?: (evt: AgentStreamEvent) => void,
): Promise<AgentProposalData> {
  const api = getApi();
  if (!api?.agentRun) {
    // Browser fallback / mock simulation
    onEvent?.({
      type: "step",
      stepIndex: 1,
      totalSteps: 3,
      message: "正在规划 Agent 工作流...",
    });
    onEvent?.({
      type: "step",
      stepIndex: 2,
      totalSteps: 3,
      message: "正在提取并分析上下文...",
    });
    onEvent?.({
      type: "token",
      textChunk: "正在分析邮件上下文并生成操作提议...\n",
    });
    const fallbackProposal: AgentProposalData = {
      title: "Agent 工作流提议 (测试/演示模式)",
      summary: "已基于当前邮件上下文生成 1 项建议草稿与日程提议。",
      items: [
        {
          id: "demo_draft_1",
          kind: "draft_reply",
          targetTo: typeof params.context?.from === "string" ? params.context.from : "contact@example.com",
          subject: typeof params.context?.subject === "string" ? `Re: ${params.context.subject}` : "关于跟进事项的回复",
          body: "您好，\n\n已收到相关信息并已审阅，我们将尽快按计划推进。\n\n顺祝商祺！",
          selected: true,
        },
      ],
    };
    onEvent?.({
      type: "step",
      stepIndex: 3,
      totalSteps: 3,
      message: "生成待审阅提议完成",
    });
    onEvent?.({ type: "proposal", data: fallbackProposal });
    onEvent?.({ type: "done", summary: fallbackProposal.summary });
    return fallbackProposal;
  }
  return api.agentRun(params, onEvent);
}

export async function agentAbort(requestId: string): Promise<boolean> {
  const api = getApi();
  if (!api?.agentAbort) return true;
  return api.agentAbort(requestId);
}



