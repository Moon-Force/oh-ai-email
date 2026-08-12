import { ipcMain } from "electron";
import {
  deleteAccount,
  getAccount,
  getMessage,
  initDb,
  listAccounts,
  listAllMessages,
  listFolders,
  persist,
  recomputeFolderUnread,
  setMessageSplit,
  setMessageUnread,
  upsertAccount,
} from "./db";
import { passwordKey, testImapConnection } from "./mail/imap";
import { sendMailViaSmtp } from "./mail/smtp";
import {
  markMessageReadRemote,
  recordDraft,
  recordSentAfterSend,
  sortFoldersForUi,
  syncAccount,
} from "./mail/sync";
import type { AccountRecord, TlsMode } from "./mail/types";
import { deleteSecret, loadSecret, saveSecret } from "./store";

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
    return { ok: true as const, account: record, sync };
  });

  ipcMain.handle("account:remove", (_e, id: string) => {
    deleteAccount(id);
    deleteSecret(passwordKey(id));
    return true;
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
    const activeId = accountId && accounts.some((a) => a.id === accountId) ? accountId : accounts[0]?.id;
    if (!activeId) {
      return {
        accounts,
        activeAccountId: null as string | null,
        folders: [] as ReturnType<typeof listFolders>,
        messages: [] as ReturnType<typeof listAllMessages>,
      };
    }
    return {
      accounts,
      activeAccountId: activeId,
      folders: sortFoldersForUi(listFolders(activeId)),
      messages: listAllMessages(activeId),
    };
  });

  ipcMain.handle("mail:get", (_e, id: string) => getMessage(id));

  ipcMain.handle("mail:markRead", async (_e, id: string) => {
    setMessageUnread(id, false);
    const msg = getMessage(id);
    if (msg) {
      recomputeFolderUnread(msg.accountId, msg.folderId);
      persist();
      // fire-and-forget remote flag
      void markMessageReadRemote(id);
    }
    return getMessage(id);
  });

  ipcMain.handle("mail:setSplit", (_e, id: string, split: "important" | "other") => {
    if (split !== "important" && split !== "other") {
      return null;
    }
    setMessageSplit(id, split);
    return getMessage(id);
  });

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
      },
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
          ? payload.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
          : "");
      const attachNote =
        attCount > 0 ? `\n\n[附件 ${attCount} 个${totalBytes ? ` · ${Math.round(totalBytes / 1024)} KB` : ""}]` : "";
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
    },
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
      },
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
          ? payload.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
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
    },
  );
}
