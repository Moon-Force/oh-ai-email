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
  snoozedUntil?: number | null;
  isPinned?: boolean;
  isMuted?: boolean;
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
    attachmentId: string
  ) => Promise<{ ok: true; path: string } | { ok: false; error: string }>;
  mailOpenAttachment: (
    attachmentId: string
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
  aiLearnUserTone: (payload: {
    accountId?: string;
    mode?: AiModeDto;
    requestId?: string;
  }) => Promise<AiUserPersonaResult>;
  aiAnalyzeAttachment: (payload: {
    filename: string;
    contentType?: string;
    textContent?: string;
    base64Data?: string;
    mode?: AiModeDto;
    requestId?: string;
  }) => Promise<AiTaskResult>;
  mailIdleStatus?: () => Promise<IdleWorkerStateDto[]>;
  onAiStreamChunk?: (
    callback: (chunk: { requestId: string; reasoningChunk?: string; contentChunk?: string }) => void
  ) => () => void;
  onMailSyncProgress?: (
    callback: (progress: { accountId: string; folder: string; current: number; total: number }) => void
  ) => () => void;
  onMailEvent?: (
    channel: "mail:open-message" | "mail:trigger-sync" | "mail:open-compose" | "mail:pushed",
    callback: (data: unknown) => void
  ) => () => void;
  aiListModels: () => Promise<AiListModelsResult>;
  aiQueryBalance: () => Promise<AiBalanceResult>;
  aiSynthesizeSpeech: (payload: {
    text: string;
    voice?: string;
  }) => Promise<AiSynthesizeSpeechResult>;
  aiTranscribeAudio?: (payload: {
    audioData: string;
    mimeType?: string;
  }) => Promise<{ ok: boolean; text?: string; error?: string }>;
  agentRun: (
    params: AgentRunParams,
    onEvent?: (evt: AgentStreamEvent) => void
  ) => Promise<AgentProposalData>;
  agentAbort: (requestId: string) => Promise<boolean>;
  agentListSkills?: () => Promise<AgentSkillDefinition[]>;
  agentSaveSkill?: (skill: Omit<AgentSkillDefinition, "isCustom">) => Promise<AgentSkillDefinition>;
  agentDeleteSkill?: (id: string) => Promise<{ ok: boolean }>;
  agentExportSkill?: (id: string) => Promise<string>;
  agentGetMcpConfig?: () => Promise<{ mcpServers: Record<string, unknown> }>;
  agentListSessions?: () => Promise<AgentSession[]>;
  agentListMessages?: (sessionId: string) => Promise<AgentMessageRecord[]>;
  agentDeleteSession?: (sessionId: string) => Promise<{ ok: boolean }>;
  mailSnooze: (id: string, until: number | null) => Promise<MessageDto | null>;
  mailPin: (id: string, isPinned: boolean) => Promise<MessageDto | null>;
  mailMute: (id: string, isMuted: boolean) => Promise<MessageDto | null>;
  prefsGetAutolaunch: () => Promise<boolean>;
  prefsSetAutolaunch: (enabled: boolean) => Promise<boolean>;
  updaterCheck: () => Promise<UpdateCheckResultDto>;
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
  sttService: "browser" | "custom";
  sttBaseUrl: string;
  sttModel: string;
  ttsService: "browser" | "custom";
  ttsBaseUrl: string;
  ttsModel: string;
  ttsVoice: string;
  hasSttApiKey?: boolean;
  hasTtsApiKey?: boolean;
};

export type AiSaveSettingsPayload = Partial<Omit<AiSettingsDto, "hasCloudApiKey" | "hasSttApiKey" | "hasTtsApiKey">> & {
  apiKey?: string;
  sttApiKey?: string;
  ttsApiKey?: string;
};

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
  { ok: true; isAvailable: boolean; balanceInfos: AiBalanceInfo[] } | { ok: false; error: string };

export type AiListModelsResult = { ok: true; models: string[] } | { ok: false; error: string };

export type AiSynthesizeSpeechResult =
  { ok: true; audioData: string } | { ok: false; error: string };

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
  userPersona?: string;
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
  tone: "shorter" | "formal" | "expand" | "persona";
  userPersona?: string;
  mode?: AiModeDto;
  requestId?: string;
};

export type AiUserPersonaResult =
  | {
      ok: true;
      personaSummary: string;
      toneStyle: string;
      greetingHabit: string;
      signoffHabit: string;
      keyTraits: string[];
      mode: AiModeDto;
    }
  | { ok: false; code: string; error: string };

export type AiComposePayload = {
  prompt: string;
  existingBody?: string;
  mode?: AiModeDto;
  requestId?: string;
};

export type AiProbeOllamaResult = { ok: true; models: string[] } | { ok: false; error: string };

export type AiProbeCloudResult = { ok: true } | { ok: false; error: string; code?: string };

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
  split: "important" | "other"
): Promise<MessageDto | null> {
  return getApi()?.mailSetSplit(id, split) ?? null;
}

export async function mailSnooze(id: string, untilMs: number | null): Promise<MessageDto | null> {
  return getApi()?.mailSnooze(id, untilMs) ?? null;
}

export async function mailPin(id: string, isPinned: boolean): Promise<MessageDto | null> {
  return getApi()?.mailPin(id, isPinned) ?? null;
}

export async function mailMute(id: string, isMuted: boolean): Promise<MessageDto | null> {
  return getApi()?.mailMute(id, isMuted) ?? null;
}

export async function prefsGetAutolaunch(): Promise<boolean> {
  return getApi()?.prefsGetAutolaunch?.() ?? false;
}

export async function prefsSetAutolaunch(enabled: boolean): Promise<boolean> {
  return getApi()?.prefsSetAutolaunch?.(enabled) ?? false;
}

export type UpdateCheckResultDto = {
  updateAvailable: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseName?: string;
  releaseNotes?: string;
  releaseUrl?: string;
  publishedAt?: string;
};

export async function updaterCheck(): Promise<UpdateCheckResultDto> {
  const api = getApi();
  if (!api?.updaterCheck) {
    return {
      updateAvailable: false,
      currentVersion: "0.1.0",
      latestVersion: "0.1.0",
      releaseNotes: "当前为测试/开发环境",
    };
  }
  return api.updaterCheck();
}

export async function mailSaveAttachment(
  attachmentId: string
): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  const api = getApi();
  if (!api) return { ok: false, error: "仅桌面端可下载附件" };
  return api.mailSaveAttachment(attachmentId);
}

export async function mailOpenAttachment(
  attachmentId: string
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

const AI_BROWSER_ERR = "仅桌面端可调用 AI。请在 Electron 中运行，并到设置 → AI 配置密钥或 Ollama。";

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
      sttService: "custom",
      sttBaseUrl: "https://api.openai.com/v1",
      sttModel: "whisper-1",
      ttsService: "custom",
      ttsBaseUrl: "https://api.openai.com/v1",
      ttsModel: "tts-1",
      ttsVoice: "alloy",
      hasSttApiKey: false,
      hasTtsApiKey: false,
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
      sttService: payload.sttService ?? "custom",
      sttBaseUrl: payload.sttBaseUrl ?? "https://api.openai.com/v1",
      sttModel: payload.sttModel ?? "whisper-1",
      ttsService: payload.ttsService ?? "custom",
      ttsBaseUrl: payload.ttsBaseUrl ?? "https://api.openai.com/v1",
      ttsModel: payload.ttsModel ?? "tts-1",
      ttsVoice: payload.ttsVoice ?? "alloy",
      hasSttApiKey: Boolean(payload.sttApiKey?.trim()),
      hasTtsApiKey: Boolean(payload.ttsApiKey?.trim()),
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
    return {
      ok: true,
      models: ["deepseek-chat", "deepseek-reasoner", "mimo-v2.5", "gpt-4o-mini", "llama3.2"],
    };
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

export async function aiTranscribeAudio(payload: {
  audioData: string;
  mimeType?: string;
}): Promise<{ ok: boolean; text?: string; error?: string }> {
  const api = getApi();
  if (!api?.aiTranscribeAudio) {
    return { ok: false, error: "仅桌面端可调用云端语音识别" };
  }
  return api.aiTranscribeAudio(payload);
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
  payload: AiThreadSummaryPayload
): Promise<AiThreadSummaryResult> {
  const api = getApi();
  if (!api) return { ok: false, code: "CONFIG", error: AI_BROWSER_ERR };
  return api.aiThreadSummary(payload);
}

export async function aiSuggestSplit(
  payload: AiSuggestSplitPayload
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

export async function aiLearnUserTone(payload: {
  accountId?: string;
  mode?: AiModeDto;
  requestId?: string;
}): Promise<AiUserPersonaResult> {
  const api = getApi();
  if (!api) {
    return {
      ok: true,
      personaSummary: "高效专业，注重结论先行与条理清晰",
      toneStyle: "专业高效",
      greetingHabit: "您好",
      signoffHabit: "祝好",
      keyTraits: ["要点清晰", "措辞得体", "回复迅速"],
      mode: "cloud",
    };
  }
  return api.aiLearnUserTone(payload);
}

export async function aiAnalyzeAttachment(payload: {
  filename: string;
  contentType?: string;
  textContent?: string;
  base64Data?: string;
  mode?: AiModeDto;
  requestId?: string;
}): Promise<AiTaskResult> {
  const api = getApi();
  if (!api) {
    return {
      ok: true,
      text: `【附件要点提取：${payload.filename}】\n1. 核心概述：该文档包含了相关业务方案与关键条款。\n2. 关键数据与亮点：涉及交付时间节点与配置清单。\n3. 后续待办：请团队成员在截止日期前确认并归档。`,
      mode: "cloud",
    };
  }
  return api.aiAnalyzeAttachment(payload);
}

export interface IdleWorkerStateDto {
  accountId: string;
  email: string;
  status: "idle" | "connecting" | "syncing" | "error" | "stopped";
  lastEventAt?: number;
  error?: string;
}

export async function mailIdleStatus(): Promise<IdleWorkerStateDto[]> {
  const api = getApi();
  if (!api?.mailIdleStatus) return [];
  return api.mailIdleStatus();
}

export function onMailEvent(
  channel: "mail:open-message" | "mail:trigger-sync" | "mail:open-compose" | "mail:pushed",
  callback: (data: unknown) => void
): () => void {
  const api = getApi();
  if (!api?.onMailEvent) return () => {};
  return api.onMailEvent(channel, callback);
}

// ── Agent Stream & Workflow Foundation ──────────────────────────

export type AgentType =
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

export type AgentSession = {
  id: string;
  title: string;
  agentType: string;
  createdAt: number;
  updatedAt: number;
};

export type AgentMessageRecord = {
  id: string;
  sessionId: string;
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  toolCalls?: string;
  toolCallId?: string;
  thought?: string;
  tokens?: number;
  createdAt: number;
};

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

export type AgentProposalInvoiceItem = {
  id: string;
  kind: "invoice_entry";
  vendorName: string;
  amount: number;
  currency: string;
  category?: string;
  date?: string;
  invoiceNo?: string;
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

export type AgentStreamEvent =
  | AgentStepEvent
  | AgentTokenEvent
  | { type: "thinking_token"; textChunk: string }
  | { type: "compaction"; compactedTokens: number; summary: string }
  | { type: "proposal"; data: AgentProposalData }
  | { type: "done"; summary: string }
  | { type: "error"; code: string; message: string };

export type AgentRunParams = {
  agentType: AgentType;
  skillId?: string;
  prompt?: string;
  context?: Record<string, unknown>;
  requestId?: string;
};

export async function agentRun(
  params: AgentRunParams,
  onEvent?: (evt: AgentStreamEvent) => void
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
          targetTo:
            typeof params.context?.from === "string" ? params.context.from : "contact@example.com",
          subject:
            typeof params.context?.subject === "string"
              ? `Re: ${params.context.subject}`
              : "关于跟进事项的回复",
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

export async function agentListSkills(): Promise<AgentSkillDefinition[]> {
  const api = getApi();
  if (!api?.agentListSkills) {
    return [
      {
        id: "meeting_extractor",
        name: "会议日程提取助手",
        description: "自动识别邮件中的会议时间、地点、参会人及议程要点，并生成标准日历日程提案",
        icon: "EventAvailable",
        version: "1.0.0",
        tags: ["日程", "会议", "日历"],
        allowedTools: ["calendar_proposal"],
        systemPrompt: "",
      },
      {
        id: "invoice_scanner",
        name: "财务发票与报销整理",
        description: "精准抽取发票与账单邮件中的开票方、发票号、金额、税率及报销类别",
        icon: "ReceiptLong",
        version: "1.0.0",
        tags: ["财务", "报销", "发票"],
        allowedTools: ["invoice_proposal"],
        systemPrompt: "",
      },
      {
        id: "outreach_translator",
        name: "跨语种商务邮件外联",
        description: "支持中/英/日/德等跨语种商务邮件互译与得体商务语气润色",
        icon: "Translate",
        version: "1.0.0",
        tags: ["翻译", "商务外联", "润色"],
        allowedTools: ["draft_proposal"],
        systemPrompt: "",
      },
      {
        id: "smart_sorter",
        name: "智能分箱与批量归档",
        description: "基于发件人画像与内容紧急度，智能划分「重要/其他」分箱并推荐归档策略",
        icon: "FolderSpecial",
        version: "1.0.0",
        tags: ["分箱", "归档", "整理"],
        allowedTools: ["split_proposal"],
        systemPrompt: "",
      },
    ];
  }
  return api.agentListSkills();
}

export async function agentSaveSkill(
  skill: Omit<AgentSkillDefinition, "isCustom">
): Promise<AgentSkillDefinition> {
  const api = getApi();
  if (!api?.agentSaveSkill) {
    return { ...skill, isCustom: true };
  }
  return api.agentSaveSkill(skill);
}

export async function agentDeleteSkill(id: string): Promise<{ ok: boolean }> {
  const api = getApi();
  if (!api?.agentDeleteSkill) return { ok: true };
  return api.agentDeleteSkill(id);
}

export async function agentExportSkill(id: string): Promise<string> {
  const api = getApi();
  if (!api?.agentExportSkill) {
    return `---
id: ${id}
---
`;
  }
  return api.agentExportSkill(id);
}

export async function agentGetMcpConfig(): Promise<{ mcpServers: Record<string, unknown> }> {
  const api = getApi();
  if (!api?.agentGetMcpConfig) {
    return {
      mcpServers: {
        "oh-ai-email": {
          command: "node",
          args: ["./dist-electron/mcp.js"],
          description: "Local email search and draft creation MCP server",
        },
      },
    };
  }
  return api.agentGetMcpConfig();
}

export async function agentListSessions(): Promise<AgentSession[]> {
  const api = getApi();
  if (!api?.agentListSessions) return [];
  return api.agentListSessions();
}

export async function agentListMessages(sessionId: string): Promise<AgentMessageRecord[]> {
  const api = getApi();
  if (!api?.agentListMessages) return [];
  return api.agentListMessages(sessionId);
}

export async function agentDeleteSession(sessionId: string): Promise<{ ok: boolean }> {
  const api = getApi();
  if (!api?.agentDeleteSession) return { ok: true };
  return api.agentDeleteSession(sessionId);
}

export function onAiStreamChunk(
  callback: (chunk: { requestId: string; reasoningChunk?: string; contentChunk?: string }) => void
): () => void {
  const api = getApi();
  if (!api?.onAiStreamChunk) return () => {};
  return api.onAiStreamChunk(callback);
}
