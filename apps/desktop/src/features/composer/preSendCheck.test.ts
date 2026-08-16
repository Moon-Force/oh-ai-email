import { describe, expect, it } from "vitest";
import { runPreSendCheck } from "./preSendCheck";

describe("runPreSendCheck", () => {
  it("returns no issues for normal email with attachments", () => {
    const issues = runPreSendCheck({
      subject: "Project Report",
      bodyText: "Here is the report as attached. Thanks!",
      attachmentsCount: 1,
    });
    expect(issues).toHaveLength(0);
  });

  it("detects missing attachment when mentioned in body or subject without attachments", () => {
    const issues1 = runPreSendCheck({
      subject: "设计稿请查收",
      bodyText: "请查看最新页面设计。",
      attachmentsCount: 0,
    });
    expect(issues1).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "missing_attachment", severity: "warning" }),
      ])
    );

    const issues2 = runPreSendCheck({
      subject: "Update",
      bodyText: "Please find the file in the attachment.",
      attachmentsCount: 0,
    });
    expect(issues2).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "missing_attachment" })])
    );
  });

  it("detects financial / remittance sensitive keywords", () => {
    const issues = runPreSendCheck({
      subject: "修改收款账户通知",
      bodyText: "请将本期款项转账至新的银行卡号 6222...",
      attachmentsCount: 0,
    });
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "financial_risk", severity: "warning" }),
      ])
    );
  });

  it("detects aggressive or harsh tone keywords", () => {
    const issues = runPreSendCheck({
      subject: "严重警告",
      bodyText: "请必须立刻处理，否则后果自负。",
      attachmentsCount: 0,
    });
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "aggressive_tone", severity: "info" }),
      ])
    );
  });

  it("can return multiple issues simultaneously", () => {
    const issues = runPreSendCheck({
      subject: "请查收发票",
      bodyText: "附件发票请尽快转账付款，必须立刻完成。",
      attachmentsCount: 0,
    });
    expect(issues.map((i) => i.type)).toEqual(
      expect.arrayContaining(["missing_attachment", "financial_risk", "aggressive_tone"])
    );
  });
});
