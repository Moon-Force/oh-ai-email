import type { TlsMode } from "./model";

export type MailServerPreset = {
  imapHost: string;
  imapPort: number;
  imapTls: TlsMode;
  smtpHost: string;
  smtpPort: number;
  smtpTls: TlsMode;
};

export type MailProvider = {
  id: string;
  /** Short label for chip / button */
  label: string;
  /** Longer name for helper text */
  name: string;
  /** Domains that auto-select this provider (lowercase) */
  domains: string[];
  /** Hint about auth code / app password (shown under form) */
  authHint?: string;
  servers: MailServerPreset;
};

/**
 * Common consumer / enterprise mail IMAP+SMTP presets.
 * Ports prefer SSL (993 / 465) when the provider documents them;
 * STARTTLS (587) only when SSL/465 is not the recommended path (Outlook, iCloud).
 */
export const MAIL_PROVIDERS: MailProvider[] = [
  {
    id: "qq",
    label: "QQ 邮箱",
    name: "QQ 邮箱",
    domains: ["qq.com"],
    authHint: "请在 QQ 邮箱网页版开启 IMAP/SMTP，并使用「授权码」而非登录密码。",
    servers: {
      imapHost: "imap.qq.com",
      imapPort: 993,
      imapTls: "ssl",
      smtpHost: "smtp.qq.com",
      smtpPort: 465,
      smtpTls: "ssl",
    },
  },
  {
    id: "exmail",
    label: "腾讯企业邮",
    name: "腾讯企业邮箱 / 企业微信邮箱",
    domains: ["exmail.qq.com"],
    authHint: "企业邮箱请使用管理员开启的客户端专用密码或登录密码（视企业策略）。",
    servers: {
      imapHost: "imap.exmail.qq.com",
      imapPort: 993,
      imapTls: "ssl",
      smtpHost: "smtp.exmail.qq.com",
      smtpPort: 465,
      smtpTls: "ssl",
    },
  },
  {
    id: "163",
    label: "163 邮箱",
    name: "网易 163 邮箱",
    domains: ["163.com"],
    authHint: "请在 163 邮箱设置中开启 IMAP/SMTP，并使用客户端「授权码」。",
    servers: {
      imapHost: "imap.163.com",
      imapPort: 993,
      imapTls: "ssl",
      smtpHost: "smtp.163.com",
      smtpPort: 465,
      smtpTls: "ssl",
    },
  },
  {
    id: "126",
    label: "126 邮箱",
    name: "网易 126 邮箱",
    domains: ["126.com"],
    authHint: "请在 126 邮箱设置中开启 IMAP/SMTP，并使用客户端「授权码」。",
    servers: {
      imapHost: "imap.126.com",
      imapPort: 993,
      imapTls: "ssl",
      smtpHost: "smtp.126.com",
      smtpPort: 465,
      smtpTls: "ssl",
    },
  },
  {
    id: "yeah",
    label: "yeah.net",
    name: "网易 yeah.net 邮箱",
    domains: ["yeah.net"],
    authHint: "请在邮箱设置中开启 IMAP/SMTP，并使用客户端「授权码」。",
    servers: {
      imapHost: "imap.yeah.net",
      imapPort: 993,
      imapTls: "ssl",
      smtpHost: "smtp.yeah.net",
      smtpPort: 465,
      smtpTls: "ssl",
    },
  },
  {
    id: "139",
    label: "139 邮箱",
    name: "中国移动 139 邮箱",
    domains: ["139.com"],
    authHint: "请在 139 邮箱客户端设置中开启 IMAP，并使用授权码。",
    servers: {
      imapHost: "imap.139.com",
      imapPort: 993,
      imapTls: "ssl",
      smtpHost: "smtp.139.com",
      smtpPort: 465,
      smtpTls: "ssl",
    },
  },
  {
    id: "sina",
    label: "新浪邮箱",
    name: "新浪邮箱",
    domains: ["sina.com", "sina.cn"],
    authHint: "请在新浪邮箱设置中开启 POP/IMAP/SMTP 服务。",
    servers: {
      imapHost: "imap.sina.com",
      imapPort: 993,
      imapTls: "ssl",
      smtpHost: "smtp.sina.com",
      smtpPort: 465,
      smtpTls: "ssl",
    },
  },
  {
    id: "aliyun",
    label: "阿里企业邮",
    name: "阿里云企业邮箱",
    domains: ["aliyun.com", "alibaba-inc.com"],
    authHint: "企业域邮箱也可手动填写；服务器一般为 imap/smtp.qiye.aliyun.com。",
    servers: {
      imapHost: "imap.qiye.aliyun.com",
      imapPort: 993,
      imapTls: "ssl",
      smtpHost: "smtp.qiye.aliyun.com",
      smtpPort: 465,
      smtpTls: "ssl",
    },
  },
  {
    id: "gmail",
    label: "Gmail",
    name: "Google Gmail",
    domains: ["gmail.com", "googlemail.com"],
    authHint: "需开启两步验证并使用「应用专用密码」，或后续接入 OAuth。",
    servers: {
      imapHost: "imap.gmail.com",
      imapPort: 993,
      imapTls: "ssl",
      smtpHost: "smtp.gmail.com",
      smtpPort: 465,
      smtpTls: "ssl",
    },
  },
  {
    id: "outlook",
    label: "Outlook",
    name: "Outlook / Hotmail / Live",
    domains: ["outlook.com", "hotmail.com", "live.com", "msn.com"],
    authHint: "部分账号需在 Microsoft 账户中开启 IMAP；新账号可能仅支持 OAuth。",
    servers: {
      imapHost: "outlook.office365.com",
      imapPort: 993,
      imapTls: "ssl",
      smtpHost: "smtp-mail.outlook.com",
      smtpPort: 587,
      smtpTls: "starttls",
    },
  },
  {
    id: "icloud",
    label: "iCloud",
    name: "Apple iCloud 邮件",
    domains: ["icloud.com", "me.com", "mac.com"],
    authHint: "请在 appleid.apple.com 生成「App 专用密码」。",
    servers: {
      imapHost: "imap.mail.me.com",
      imapPort: 993,
      imapTls: "ssl",
      smtpHost: "smtp.mail.me.com",
      smtpPort: 587,
      smtpTls: "starttls",
    },
  },
  {
    id: "yahoo",
    label: "Yahoo",
    name: "Yahoo Mail",
    domains: ["yahoo.com", "yahoo.com.cn", "ymail.com"],
    authHint: "请生成 Yahoo 应用密码后再登录客户端。",
    servers: {
      imapHost: "imap.mail.yahoo.com",
      imapPort: 993,
      imapTls: "ssl",
      smtpHost: "smtp.mail.yahoo.com",
      smtpPort: 465,
      smtpTls: "ssl",
    },
  },
];

export const CUSTOM_PROVIDER_ID = "custom";

export function findProviderById(id: string): MailProvider | undefined {
  return MAIL_PROVIDERS.find((p) => p.id === id);
}

/** Match provider by email domain (e.g. user@qq.com → QQ). */
export function findProviderByEmail(email: string): MailProvider | undefined {
  const domain = email.split("@")[1]?.trim().toLowerCase();
  if (!domain) return undefined;
  return MAIL_PROVIDERS.find((p) => p.domains.includes(domain));
}

export function customServersFromEmail(email: string): MailServerPreset {
  const domain = email.split("@")[1]?.trim().toLowerCase() || "example.com";
  return {
    imapHost: `imap.${domain}`,
    imapPort: 993,
    imapTls: "ssl",
    smtpHost: `smtp.${domain}`,
    smtpPort: 465,
    smtpTls: "ssl",
  };
}

/** Resolve full server preset for an email (known provider or generic imap/smtp.domain). */
export function resolveServersForEmail(email: string): MailServerPreset & { providerId: string } {
  const known = findProviderByEmail(email);
  if (known) return { ...known.servers, providerId: known.id };
  return { ...customServersFromEmail(email), providerId: CUSTOM_PROVIDER_ID };
}
