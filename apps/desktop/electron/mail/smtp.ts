import nodemailer from "nodemailer";
import type { AccountRecord, TlsMode } from "./types";

export type SmtpAttachment = {
  filename: string;
  contentType?: string;
  /** base64 without data: prefix */
  contentBase64: string;
};

export type SendMailInput = {
  account: AccountRecord;
  password: string;
  to: string;
  cc?: string;
  subject: string;
  /** plain text fallback */
  body: string;
  /** rich HTML body when provided */
  html?: string;
  attachments?: SmtpAttachment[];
};

export type SendMailResult = { ok: true; messageId?: string } | { ok: false; error: string };

function splitAddresses(raw: string): string[] {
  return raw
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter((s) => s.includes("@"));
}

function humanizeSmtpError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  if (lower.includes("auth") || lower.includes("invalid login") || lower.includes("credentials")) {
    return "SMTP 认证失败：请确认已开启 SMTP 并使用授权码（不是登录密码）";
  }
  if (lower.includes("timeout") || lower.includes("timed out") || lower.includes("etimedout")) {
    return "SMTP 连接超时：请检查网络、服务器与端口";
  }
  if (lower.includes("certificate") || lower.includes("ssl") || lower.includes("tls")) {
    return `SMTP 证书/TLS 错误：${msg}`;
  }
  if (lower.includes("enotfound") || lower.includes("getaddrinfo")) {
    return `无法解析 SMTP 服务器：${msg}`;
  }
  if (lower.includes("econnrefused")) {
    return `SMTP 服务器拒绝连接：${msg}`;
  }
  if (lower.includes("recipient") || lower.includes("rcpt") || lower.includes("mailbox")) {
    return `收件人被拒绝：${msg}`;
  }
  return msg || "SMTP 发送失败";
}

function buildTransport(account: AccountRecord, password: string) {
  const port = account.smtpPort;
  const tlsMode: TlsMode = account.smtpTls;
  // 465 typically SSL direct; 587 STARTTLS
  const secure = tlsMode === "ssl" || port === 465;
  const requireTLS = tlsMode === "starttls" || (!secure && port === 587);

  return nodemailer.createTransport({
    host: account.smtpHost,
    port,
    secure,
    requireTLS: requireTLS && !secure,
    auth: {
      user: account.email,
      pass: password,
    },
    connectionTimeout: 20_000,
    greetingTimeout: 20_000,
    socketTimeout: 60_000,
    tls: {
      minVersion: "TLSv1.2",
      rejectUnauthorized: true,
    },
  });
}

/** Send one message via account SMTP settings. */
export async function sendMailViaSmtp(input: SendMailInput): Promise<SendMailResult> {
  const toList = splitAddresses(input.to);
  if (toList.length === 0) {
    return { ok: false, error: "收件人不正确" };
  }
  const ccList = input.cc ? splitAddresses(input.cc) : [];

  const transport = buildTransport(input.account, input.password);
  try {
    const attachments = (input.attachments ?? []).map((a) => ({
      filename: a.filename,
      contentType: a.contentType || "application/octet-stream",
      content: Buffer.from(a.contentBase64, "base64"),
    }));

    const html =
      input.html?.trim() ||
      (input.body
        ? `<div style="font-family:Segoe UI,system-ui,sans-serif;font-size:14px;line-height:1.55;white-space:pre-wrap">${escapeHtml(
            input.body,
          )}</div>`
        : undefined);

    const info = await transport.sendMail({
      from: input.account.displayName
        ? `"${input.account.displayName}" <${input.account.email}>`
        : input.account.email,
      to: toList.join(", "),
      cc: ccList.length ? ccList.join(", ") : undefined,
      subject: input.subject || "(无主题)",
      text: input.body || stripHtml(html || "") || undefined,
      html,
      attachments: attachments.length ? attachments : undefined,
    });
    return { ok: true, messageId: info.messageId };
  } catch (err) {
    return { ok: false, error: humanizeSmtpError(err) };
  } finally {
    transport.close();
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Lightweight SMTP auth probe (verify credentials without sending). */
export async function testSmtpConnection(
  account: Pick<AccountRecord, "email" | "smtpHost" | "smtpPort" | "smtpTls">,
  password: string,
): Promise<SendMailResult> {
  const transport = buildTransport(account as AccountRecord, password);
  try {
    await transport.verify();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: humanizeSmtpError(err) };
  } finally {
    transport.close();
  }
}
