import { resolveServersForEmail } from "./providers";

export type TlsMode = "ssl" | "starttls" | "none";

export type Account = {
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
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateAccount(a: Omit<Account, "id">): string[] {
  const errs: string[] = [];
  if (!EMAIL_RE.test(a.email)) errs.push("邮箱格式不正确");
  if (!a.imapHost.trim()) errs.push("IMAP 服务器不能为空");
  if (!a.smtpHost.trim()) errs.push("SMTP 服务器不能为空");
  for (const [label, port] of [
    ["IMAP 端口", a.imapPort],
    ["SMTP 端口", a.smtpPort],
  ] as const) {
    if (!Number.isInteger(port) || port < 1 || port > 65535) errs.push(`${label} 需为 1-65535`);
  }
  return errs;
}

/** Back-compat: host names only. Prefer resolveServersForEmail for full presets. */
export function inferHosts(email: string): { imapHost: string; smtpHost: string } {
  const s = resolveServersForEmail(email);
  return { imapHost: s.imapHost, smtpHost: s.smtpHost };
}

export { resolveServersForEmail } from "./providers";

