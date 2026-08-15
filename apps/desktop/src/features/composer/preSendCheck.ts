export type PreSendIssueType = "missing_attachment" | "financial_risk" | "aggressive_tone";

export type PreSendIssue = {
  type: PreSendIssueType;
  title: string;
  detail: string;
  severity: "warning" | "error" | "info";
};

const ATTACHMENT_KEYWORDS = [
  "附件",
  "附上",
  "附带",
  "查收",
  "attachment",
  "attached",
  "enclosed",
  "as attached",
  "see attached",
];

const FINANCIAL_KEYWORDS = [
  "汇款",
  "转账",
  "银行卡号",
  "修改收款",
  "收款账户",
  "wire transfer",
  "bank account",
  "urgent payment",
  "payment details",
  "remittance",
];

const AGGRESSIVE_KEYWORDS = [
  "后果自负",
  "必须立刻",
  "开除",
  "严重警告",
  "责任自负",
  "立刻执行",
  "马上滚",
];

export function runPreSendCheck(data: {
  subject: string;
  bodyText: string;
  attachmentsCount: number;
}): PreSendIssue[] {
  const combined = `${data.subject}\n${data.bodyText}`.toLowerCase();
  const issues: PreSendIssue[] = [];

  // 1. Missing Attachment check
  if (data.attachmentsCount === 0) {
    const hasAttKeyword = ATTACHMENT_KEYWORDS.some((kw) =>
      combined.includes(kw.toLowerCase()),
    );
    if (hasAttKeyword) {
      issues.push({
        type: "missing_attachment",
        title: "可能遗漏附件",
        detail: "正文或主题中提及了“附件”或“查收”，但当前邮件尚未添加任何附件。",
        severity: "warning",
      });
    }
  }

  // 2. Financial Risk check
  const hasFinKeyword = FINANCIAL_KEYWORDS.some((kw) =>
    combined.includes(kw.toLowerCase()),
  );
  if (hasFinKeyword) {
    issues.push({
      type: "financial_risk",
      title: "涉及资金/转账敏感信息",
      detail: "邮件中包含银行卡、汇款或转账等敏感字样，请核实收款方身份与账号无误。",
      severity: "warning",
    });
  }

  // 3. Aggressive tone warning
  const hasAggressiveKeyword = AGGRESSIVE_KEYWORDS.some((kw) =>
    combined.includes(kw.toLowerCase()),
  );
  if (hasAggressiveKeyword) {
    issues.push({
      type: "aggressive_tone",
      title: "语气较为强烈或严厉",
      detail: "正文中包含较强硬的措辞（如“后果自负”或“必须立刻”），建议确认沟通语气是否合适。",
      severity: "info",
    });
  }

  return issues;
}
