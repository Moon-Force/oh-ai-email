import {
  CUSTOM_PROVIDER_ID,
  findProviderByEmail,
  resolveServersForEmail,
  MAIL_PROVIDERS,
} from "./providers";

describe("mail providers", () => {
  it("includes QQ and 163", () => {
    const ids = MAIL_PROVIDERS.map((p) => p.id);
    expect(ids).toContain("qq");
    expect(ids).toContain("163");
    expect(ids).toContain("gmail");
  });

  it("maps qq.com to QQ IMAP/SMTP", () => {
    const p = findProviderByEmail("me@qq.com");
    expect(p?.id).toBe("qq");
    expect(p?.servers).toMatchObject({
      imapHost: "imap.qq.com",
      imapPort: 993,
      imapTls: "ssl",
      smtpHost: "smtp.qq.com",
      smtpPort: 465,
      smtpTls: "ssl",
    });
  });

  it("maps 163.com", () => {
    expect(resolveServersForEmail("a@163.com")).toMatchObject({
      providerId: "163",
      imapHost: "imap.163.com",
      smtpHost: "smtp.163.com",
    });
  });

  it("maps outlook.com with STARTTLS SMTP", () => {
    expect(resolveServersForEmail("a@outlook.com")).toMatchObject({
      providerId: "outlook",
      imapHost: "outlook.office365.com",
      smtpHost: "smtp-mail.outlook.com",
      smtpPort: 587,
      smtpTls: "starttls",
    });
  });

  it("falls back to custom domain hosts", () => {
    expect(resolveServersForEmail("x@corp.example")).toMatchObject({
      providerId: CUSTOM_PROVIDER_ID,
      imapHost: "imap.corp.example",
      smtpHost: "smtp.corp.example",
    });
  });
});
