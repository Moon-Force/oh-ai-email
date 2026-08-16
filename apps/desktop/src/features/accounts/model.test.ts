import { validateAccount, inferHosts } from "./model";

describe("validateAccount", () => {
  const base = {
    email: "a@b.com",
    imapHost: "imap.b.com",
    imapPort: 993,
    imapTls: "ssl" as const,
    smtpHost: "smtp.b.com",
    smtpPort: 465,
    smtpTls: "ssl" as const,
  };

  it("passes for valid", () => {
    expect(validateAccount(base)).toEqual([]);
  });

  it("rejects bad email", () => {
    expect(validateAccount({ ...base, email: "bad" })).toContain("邮箱格式不正确");
  });

  it("rejects empty hosts", () => {
    expect(validateAccount({ ...base, imapHost: "" }).length).toBeGreaterThan(0);
  });

  it("rejects out-of-range port", () => {
    expect(validateAccount({ ...base, imapPort: 99999 }).join()).toMatch("端口");
  });

  it("inferHosts uses known provider for gmail", () => {
    expect(inferHosts("x@gmail.com")).toEqual({
      imapHost: "imap.gmail.com",
      smtpHost: "smtp.gmail.com",
    });
  });

  it("inferHosts uses QQ preset", () => {
    expect(inferHosts("u@qq.com")).toEqual({
      imapHost: "imap.qq.com",
      smtpHost: "smtp.qq.com",
    });
  });
});
