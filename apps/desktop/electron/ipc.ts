import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import fs from "node:fs";
import {
  checkAndWakeSnoozedMessages,
  deleteAccount,
  getAccount,
  getAttachment,
  getMessage,
  initDb,
  listAccounts,
  listAllMessages,
  listFolders,
  listMessages,
  persist,
  recomputeFolderUnread,
  setMessageMuted,
  setMessagePinned,
  setMessageSnooze,
  setMessageSplit,
  setMessageUnread,
  upsertAccount,
} from "./db";
import type { MessageRecord } from "./mail/types";
import { checkForAppUpdates } from "./updater";

function toMessageDto(m: MessageRecord) {
  return {
    id: m.id,
    accountId: m.accountId,
    folderId: m.folderId,
    uid: m.uid,
    from: m.from,
    fromName: m.fromName,
    subject: m.subject,
    snippet: m.snippet,
    dateMs: m.dateMs,
    dateLabel: m.dateLabel,
    unread: m.unread,
    split: m.split,
    html: m.html,
    snoozedUntil: m.snoozedUntil ?? null,
    isPinned: m.isPinned ?? false,
    isMuted: m.isMuted ?? false,
    attachments: (m.attachments ?? []).map((a) => ({
      id: a.id,
      filename: a.filename,
      contentType: a.contentType,
      size: a.size,
    })),
  };
}
import { passwordKey, testImapConnection } from "./mail/imap";
import { sendMailViaSmtp } from "./mail/smtp";
import {
  ensureAttachmentFile,
  markMessageReadRemote,
  recordDraft,
  recordSentAfterSend,
  sortFoldersForUi,
  syncAccount,
} from "./mail/sync";
import { getIdleStatuses, refreshIdleAccounts } from "./mail/idle";
import type { AccountRecord, TlsMode } from "./mail/types";
import { deleteSecret, loadSecret, saveSecret } from "./store";
import { loadAppPrefs, saveAppPrefs, type AppPrefs } from "./prefs";
import {
  fetchAccountBalance,
  fetchRemoteModels,
  probeCloud,
  probeOllama,
  synthesizeSpeechMiMo,
} from "./ai/complete";
import {
  loadAiSettings,
  publicAiSettings,
  saveAiSettings,
  setCloudApiKey,
  type AiMode,
  type AiSettingsRecord,
} from "./ai/settings";
import {
  abortAiRequest,
  taskAnalyzeAttachment,
  taskCompose,
  taskDraftReply,
  taskExtractActionItems,
  taskLearnUserTone,
  taskQuickReply,
  taskRewrite,
  taskSuggestSplit,
  taskSummarize,
  taskThreadSummary,
  taskTranslate,
} from "./ai/tasks";
import path from "node:path";
import { abortAgentWorkflow, defaultSkillsManager, runAgentWorkflow } from "./ai/agent/engine";
import { exportSkillMarkdown } from "./ai/agent/skills";
import type { AgentRunParams, AgentSkillDefinition, AgentStreamEvent } from "./ai/agent/types";

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

export async function registerIpc(): Promise<void> {
  await initDb();

  ipcMain.handle("ping", () => "pong");

  ipcMain.handle("prefs:get", () => loadAppPrefs());
  ipcMain.handle("prefs:save", (_e, partial: Partial<AppPrefs>) => saveAppPrefs(partial));

  ipcMain.handle("secret:save", (_e, key: string, value: string) => saveSecret(key, value));
  ipcMain.handle("secret:load", (_e, key: string) => loadSecret(key));
  ipcMain.handle("secret:delete", (_e, key: string) => deleteSecret(key));

  ipcMain.handle("account:list", () => listAccounts());

  ipcMain.handle("account:test", async (_e, payload: AddAccountPayload) => {
    return testImapConnection({
      email: payload.email,
      password: payload.password,
      imapHost: payload.imapHost,
      imapPort: payload.imapPort,
      imapTls: payload.imapTls,
    });
  });

  ipcMain.handle("account:add", async (_e, payload: AddAccountPayload) => {
    const test = await testImapConnection({
      email: payload.email,
      password: payload.password,
      imapHost: payload.imapHost,
      imapPort: payload.imapPort,
      imapTls: payload.imapTls,
    });
    if (!test.ok) {
      return { ok: false as const, error: test.error };
    }

    const id = `acc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const record: AccountRecord = {
      id,
      email: payload.email.trim(),
      displayName: payload.displayName?.trim() || payload.email.split("@")[0],
      providerId: payload.providerId,
      imapHost: payload.imapHost.trim(),
      imapPort: Number(payload.imapPort),
      imapTls: payload.imapTls,
      smtpHost: payload.smtpHost.trim(),
      smtpPort: Number(payload.smtpPort),
      smtpTls: payload.smtpTls,
      createdAt: Date.now(),
    };
    upsertAccount(record);
    saveSecret(passwordKey(id), payload.password);

    // Initial sync (best-effort)
    const sync = await syncAccount(id);
    void refreshIdleAccounts();
    return { ok: true as const, account: record, sync };
  });

  ipcMain.handle("account:remove", (_e, id: string) => {
    deleteAccount(id);
    deleteSecret(passwordKey(id));
    void refreshIdleAccounts();
    return true;
  });

  ipcMain.handle("mail:idleStatus", () => {
    return getIdleStatuses();
  });

  ipcMain.handle("mail:sync", async (_e, accountId?: string) => {
    const accounts = accountId ? [getAccount(accountId)].filter(Boolean) : listAccounts();
    const results = [];
    for (const a of accounts) {
      if (!a) continue;
      results.push(await syncAccount(a.id));
    }
    return results;
  });

  ipcMain.handle("mail:snapshot", (_e, accountId?: string) => {
    const accounts = listAccounts();
    const activeId =
      accountId && accounts.some((a) => a.id === accountId) ? accountId : accounts[0]?.id;
    if (!activeId) {
      return {
        accounts,
        activeAccountId: null as string | null,
        folders: [] as ReturnType<typeof listFolders>,
        messages: [] as ReturnType<typeof toMessageDto>[],
      };
    }
    return {
      accounts,
      activeAccountId: activeId,
      folders: sortFoldersForUi(listFolders(activeId)),
      messages: listAllMessages(activeId).map(toMessageDto),
    };
  });

  ipcMain.handle("mail:get", (_e, id: string) => {
    const m = getMessage(id);
    return m ? toMessageDto(m) : null;
  });

  ipcMain.handle("mail:markRead", async (_e, id: string) => {
    setMessageUnread(id, false);
    const msg = getMessage(id);
    if (msg) {
      recomputeFolderUnread(msg.accountId, msg.folderId);
      persist();
      // fire-and-forget remote flag
      void markMessageReadRemote(id);
    }
    const next = getMessage(id);
    return next ? toMessageDto(next) : null;
  });

  ipcMain.handle("mail:setSplit", (_e, id: string, split: "important" | "other") => {
    if (split !== "important" && split !== "other") {
      return null;
    }
    setMessageSplit(id, split);
    const next = getMessage(id);
    return next ? toMessageDto(next) : null;
  });

  ipcMain.handle("mail:snooze", (_e, id: string, untilMs: number | null) => {
    setMessageSnooze(id, untilMs);
    const next = getMessage(id);
    return next ? toMessageDto(next) : null;
  });

  ipcMain.handle("mail:pin", (_e, id: string, isPinned: boolean) => {
    setMessagePinned(id, isPinned);
    const next = getMessage(id);
    return next ? toMessageDto(next) : null;
  });

  ipcMain.handle("mail:mute", (_e, id: string, isMuted: boolean) => {
    setMessageMuted(id, isMuted);
    const next = getMessage(id);
    return next ? toMessageDto(next) : null;
  });

  ipcMain.handle("prefs:autolaunch:get", () => {
    try {
      return app.getLoginItemSettings().openAtLogin;
    } catch {
      return false;
    }
  });

  ipcMain.handle("prefs:autolaunch:set", (_e, enabled: boolean) => {
    try {
      app.setLoginItemSettings({
        openAtLogin: enabled,
        openAsHidden: true,
      });
      return app.getLoginItemSettings().openAtLogin;
    } catch {
      return false;
    }
  });

  ipcMain.handle("updater:check", async () => {
    return checkForAppUpdates();
  });

  ipcMain.handle(
    "mail:saveAttachment",
    async (
      _e,
      attachmentId: string
    ): Promise<{ ok: true; path: string } | { ok: false; error: string }> => {
      const ready = await ensureAttachmentFile(attachmentId);
      if (!ready.ok) return ready;

      const att = getAttachment(attachmentId);
      const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
      const result = await dialog.showSaveDialog(win ?? undefined, {
        title: "保存附件",
        defaultPath: att?.filename ?? "attachment",
        properties: ["createDirectory", "showOverwriteConfirmation"],
      });
      if (result.canceled || !result.filePath) {
        return { ok: false, error: "已取消" };
      }
      try {
        fs.copyFileSync(ready.path, result.filePath);
        return { ok: true, path: result.filePath };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { ok: false, error: msg };
      }
    }
  );

  ipcMain.handle(
    "mail:openAttachment",
    async (_e, attachmentId: string): Promise<{ ok: true } | { ok: false; error: string }> => {
      const ready = await ensureAttachmentFile(attachmentId);
      if (!ready.ok) return ready;
      const err = await shell.openPath(ready.path);
      if (err) return { ok: false, error: err };
      return { ok: true };
    }
  );

  ipcMain.handle(
    "mail:send",
    async (
      _e,
      payload: {
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
      }
    ) => {
      const accounts = listAccounts();
      const account =
        (payload.accountId && getAccount(payload.accountId)) ||
        (accounts[0] ? getAccount(accounts[0].id) : null);
      if (!account) {
        return { ok: false as const, error: "请先添加邮箱账号再发送" };
      }
      const password = loadSecret(passwordKey(account.id));
      if (!password) {
        return { ok: false as const, error: "未找到保存的密码/授权码，请重新添加账号" };
      }

      const attCount = payload.attachments?.length ?? 0;
      const totalBytes = (payload.attachments ?? []).reduce((s, a) => s + (a.size ?? 0), 0);
      if (attCount > 20) {
        return { ok: false as const, error: "附件数量过多（最多 20 个）" };
      }
      if (totalBytes > 25 * 1024 * 1024) {
        return { ok: false as const, error: "附件合计不能超过 25 MB" };
      }

      const sent = await sendMailViaSmtp({
        account,
        password,
        to: payload.to,
        cc: payload.cc,
        subject: payload.subject,
        body: payload.body,
        html: payload.html,
        attachments: payload.attachments?.map((a) => ({
          filename: a.filename,
          contentType: a.contentType,
          contentBase64: a.contentBase64,
        })),
      });
      if (!sent.ok) return sent;

      // Local Sent + optional IMAP APPEND so "已发送" updates without manual sync
      const bodyForStore =
        payload.body ||
        (payload.html
          ? payload.html
              .replace(/<[^>]+>/g, " ")
              .replace(/\s+/g, " ")
              .trim()
          : "");
      const attachNote =
        attCount > 0
          ? `\n\n[附件 ${attCount} 个${totalBytes ? ` · ${Math.round(totalBytes / 1024)} KB` : ""}]`
          : "";
      const recorded = await recordSentAfterSend({
        account,
        password,
        to: payload.to,
        cc: payload.cc,
        subject: payload.subject,
        body: bodyForStore + attachNote,
      });

      return {
        ok: true as const,
        messageId: sent.messageId,
        localMessageId: recorded.localMessageId,
        folderId: recorded.folderId,
        appendedToServer: recorded.appended,
      };
    }
  );

  ipcMain.handle(
    "mail:saveDraft",
    async (
      _e,
      payload: {
        accountId?: string;
        to: string;
        cc?: string;
        subject: string;
        body: string;
        html?: string;
      }
    ) => {
      const accounts = listAccounts();
      const account =
        (payload.accountId && getAccount(payload.accountId)) ||
        (accounts[0] ? getAccount(accounts[0].id) : null);
      if (!account) {
        return { ok: false as const, error: "请先添加邮箱账号再存草稿" };
      }
      const password = loadSecret(passwordKey(account.id));
      if (!password) {
        return { ok: false as const, error: "未找到保存的密码/授权码，请重新添加账号" };
      }

      const bodyForStore =
        payload.body ||
        (payload.html
          ? payload.html
              .replace(/<[^>]+>/g, " ")
              .replace(/\s+/g, " ")
              .trim()
          : "");

      try {
        const recorded = await recordDraft({
          account,
          password,
          to: payload.to ?? "",
          cc: payload.cc,
          subject: payload.subject ?? "",
          body: bodyForStore,
          html: payload.html,
        });
        return {
          ok: true as const,
          localMessageId: recorded.localMessageId,
          folderId: recorded.folderId,
          appendedToServer: recorded.appended,
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { ok: false as const, error: msg };
      }
    }
  );

  // ── AI ──────────────────────────────────────────────────────────
  ipcMain.handle("ai:getSettings", () => publicAiSettings());

  ipcMain.handle(
    "ai:saveSettings",
    (_e, payload: Partial<AiSettingsRecord> & { apiKey?: string }) => {
      const { apiKey, ...rest } = payload;
      if (apiKey !== undefined) setCloudApiKey(apiKey);
      const saved = saveAiSettings(rest);
      return { ...saved, hasCloudApiKey: publicAiSettings().hasCloudApiKey };
    }
  );

  ipcMain.handle("ai:probeOllama", () => probeOllama());
  ipcMain.handle("ai:probeCloud", () => probeCloud());
  ipcMain.handle("ai:listModels", () => fetchRemoteModels(loadAiSettings()));
  ipcMain.handle("ai:queryBalance", () => fetchAccountBalance(loadAiSettings()));
  ipcMain.handle("ai:synthesizeSpeech", (_e, payload: { text: string; voice?: string }) =>
    synthesizeSpeechMiMo(payload.text, payload.voice, loadAiSettings())
  );

  ipcMain.handle("ai:abort", (_e, requestId: string) => abortAiRequest(requestId));

  ipcMain.handle(
    "ai:summarize",
    async (
      _e,
      payload: {
        subject?: string;
        from?: string;
        body: string;
        mode?: AiMode;
        requestId?: string;
      }
    ) => taskSummarize(payload)
  );

  ipcMain.handle(
    "ai:draftReply",
    async (
      _e,
      payload: {
        subject?: string;
        from?: string;
        body: string;
        userPersona?: string;
        mode?: AiMode;
        requestId?: string;
      }
    ) => taskDraftReply(payload)
  );

  ipcMain.handle(
    "ai:quickReply",
    async (
      _e,
      payload: {
        subject?: string;
        from?: string;
        body: string;
        replyType: string;
        customNote?: string;
        mode?: AiMode;
        requestId?: string;
      }
    ) => taskQuickReply(payload)
  );

  ipcMain.handle(
    "ai:actionItems",
    async (
      _e,
      payload: {
        subject?: string;
        from?: string;
        body: string;
        mode?: AiMode;
        requestId?: string;
      }
    ) => taskExtractActionItems(payload)
  );

  ipcMain.handle(
    "ai:rewrite",
    async (
      _e,
      payload: {
        text: string;
        tone: RewriteTone;
        userPersona?: string;
        mode?: AiMode;
        requestId?: string;
      }
    ) => taskRewrite(payload)
  );

  ipcMain.handle(
    "ai:compose",
    async (
      _e,
      payload: {
        prompt: string;
        existingBody?: string;
        mode?: AiMode;
        requestId?: string;
      }
    ) => taskCompose(payload)
  );

  ipcMain.handle(
    "ai:threadSummary",
    async (
      _e,
      payload: {
        subject?: string;
        messages: { sender: string; date?: string; body: string }[];
        mode?: AiMode;
        requestId?: string;
      }
    ) => taskThreadSummary(payload)
  );

  ipcMain.handle(
    "ai:suggestSplit",
    async (
      _e,
      payload: {
        subject?: string;
        sender?: string;
        from?: string;
        body: string;
        mode?: AiMode;
        requestId?: string;
      }
    ) => taskSuggestSplit(payload)
  );

  ipcMain.handle(
    "ai:translate",
    async (
      _e,
      payload: {
        text: string;
        targetLang?: "zh" | "en";
        mode?: AiMode;
        requestId?: string;
      }
    ) => taskTranslate(payload)
  );

  ipcMain.handle(
    "ai:learnUserTone",
    async (
      _e,
      payload: {
        accountId?: string;
        mode?: AiMode;
        requestId?: string;
      }
    ) => {
      const accounts = listAccounts();
      const targetAccId = payload.accountId || accounts[0]?.id;
      let sentSamples: string[] = [];
      if (targetAccId) {
        const folders = listFolders(targetAccId);
        const sentFolder = folders.find((f) => f.role === "sent");
        if (sentFolder) {
          const messages = listMessages(targetAccId, sentFolder.id);
          sentSamples = messages
            .slice(0, 15)
            .map((m) => m.snippet || m.subject || "")
            .filter((s) => s.length > 10);
        }
        if (sentSamples.length === 0) {
          const allMessages = listAllMessages(targetAccId);
          sentSamples = allMessages
            .slice(0, 10)
            .map((m) => m.snippet || m.subject || "")
            .filter((s) => s.length > 10);
        }
      }
      return taskLearnUserTone({
        sentSamples,
        mode: payload.mode,
        requestId: payload.requestId,
      });
    }
  );

  ipcMain.handle(
    "ai:analyzeAttachment",
    async (
      _e,
      payload: {
        filename: string;
        contentType?: string;
        textContent?: string;
        base64Data?: string;
        mode?: AiMode;
        requestId?: string;
      }
    ) => taskAnalyzeAttachment(payload)
  );

  // ── Agent Stream & Workflow ────────────────────────────────────
  ipcMain.handle("agent:run", async (event, params: AgentRunParams) => {
    return runAgentWorkflow({
      ...params,
      onEvent: (evt: AgentStreamEvent) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send("agent:stream-event", {
            requestId: params.requestId,
            ...evt,
          });
        }
      },
    });
  });

  ipcMain.handle("agent:abort", (_e, requestId: string) => {
    return abortAgentWorkflow(requestId);
  });

  ipcMain.handle("agent:skills:list", () => {
    return defaultSkillsManager.listSkills();
  });

  ipcMain.handle("agent:skills:save", (_e, skill: Omit<AgentSkillDefinition, "isCustom">) => {
    return defaultSkillsManager.saveCustomSkill(skill);
  });

  ipcMain.handle("agent:skills:delete", (_e, id: string) => {
    const success = defaultSkillsManager.deleteCustomSkill(id);
    return { ok: success };
  });

  ipcMain.handle("agent:skills:export", (_e, id: string) => {
    const skill = defaultSkillsManager.getSkill(id);
    if (!skill) throw new Error(`Skill not found: ${id}`);
    return exportSkillMarkdown(skill);
  });

  ipcMain.handle("agent:mcp:getConfig", () => {
    const appPath = app.getAppPath();
    return {
      mcpServers: {
        "oh-ai-email": {
          command: "node",
          args: [path.join(appPath, "dist-electron", "mcp.js")],
          description: "Local email search, thread analysis, and draft creation MCP server",
        },
      },
    };
  });

  ipcMain.handle("agent:sessions:list", () => {
    return listAgentSessions();
  });

  ipcMain.handle("agent:sessions:messages", (_e, sessionId: string) => {
    return listAgentMessages(sessionId);
  });

  ipcMain.handle("agent:sessions:delete", (_e, sessionId: string) => {
    deleteAgentSession(sessionId);
    return { ok: true };
  });

  // Check snoozed messages every 15s
  setInterval(() => {
    try {
      const woken = checkAndWakeSnoozedMessages();
      if (woken.length > 0) {
        const win = BrowserWindow.getAllWindows()[0];
        if (win && !win.isDestroyed()) {
          win.webContents.send("mail:pushed", {
            eventType: "snooze-expired",
            count: woken.length,
            messagesSynced: woken.length,
          });
        }
      }
    } catch (err) {
      console.warn("[ipc] snooze wake check error", err);
    }
  }, 15_000);
}
