import { BrowserWindow, Notification } from "electron";

export interface MailNotificationPayload {
  messageId: string;
  accountId: string;
  from: string;
  fromName?: string;
  subject: string;
  snippet?: string;
}

export function showMailNotification(
  payload: MailNotificationPayload,
  mainWindow?: BrowserWindow | null
) {
  if (!Notification.isSupported()) return;

  const sender = payload.fromName ? `${payload.fromName} (${payload.from})` : payload.from;
  const title = `新邮件 · ${sender}`;
  const body = payload.subject || payload.snippet || "收到一封新邮件";

  const notification = new Notification({
    title,
    body,
    silent: false,
  });

  notification.on("click", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
      mainWindow.webContents.send("mail:open-message", {
        messageId: payload.messageId,
        accountId: payload.accountId,
      });
    }
  });

  notification.show();
}
