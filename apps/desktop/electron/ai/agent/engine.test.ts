import { describe, expect, it, vi } from "vitest";
import {
  executeAgentTool,
  generateIcsContent,
  normalizeToolName,
  parseProposalItemsFromOutput,
  toolExtractCommitments,
  toolExtractMeetingDetails,
  toolExtractTriageSuggestions,
  toolSearchMessages,
} from "./tools";
import { abortAgentWorkflow, runAgentWorkflow } from "./engine";
import type { AgentProposalSplitItem, AgentStreamEvent } from "./types";
import type { MessageRecord } from "../../mail/types";

describe("Agent Tools", () => {
  const sampleMessages: MessageRecord[] = [
    {
      id: "msg_1",
      accountId: "acc_1",
      folderId: "f_inbox",
      uid: 101,
      from: "boss@company.com",
      fromName: "Tech Lead",
      subject: "紧急：Q3 产品上线评审会",
      snippet: "请于明天 2026-08-20 14:00 参加上线评审会议，地点腾讯会议。",
      dateMs: Date.now() - 3600_000,
      dateLabel: "14:00",
      unread: true,
      split: "important",
    },
    {
      id: "msg_2",
      accountId: "acc_1",
      folderId: "f_inbox",
      uid: 102,
      from: "newsletter@promo.com",
      fromName: "Marketing Weekly",
      subject: "August Promotion Newsletter (Unsubscribe)",
      snippet: "Check our special discount. Click here to unsubscribe.",
      dateMs: Date.now() - 7200_000,
      dateLabel: "13:00",
      unread: false,
      split: "other",
    },
  ];

  it("toolSearchMessages filters messages by keyword", () => {
    const all = toolSearchMessages("", undefined, sampleMessages);
    expect(all).toHaveLength(2);

    const filtered = toolSearchMessages("上线评审", undefined, sampleMessages);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("msg_1");

    const none = toolSearchMessages("nonexistent term xyz", undefined, sampleMessages);
    expect(none).toHaveLength(0);
  });

  it("normalizeToolName correctly cleans duplicated, prefixed or dirty tool names", () => {
    expect(normalizeToolName("get_recent_messagesget_recent_messages")).toBe("get_recent_messages");
    expect(normalizeToolName("functions.get_recent_messages")).toBe("get_recent_messages");
    expect(normalizeToolName("search_messagessearch_messages")).toBe("search_messages");
    expect(normalizeToolName("  get_message_context  ")).toBe("get_message_context");
  });

  it("executeAgentTool handles duplicated tool names gracefully", async () => {
    const res = await executeAgentTool("get_recent_messagesget_recent_messages", { limit: 5 });
    expect(res.success).toBe(true);
  });

  it("generateIcsContent formats valid RFC 5545 iCalendar content", () => {
    const ics = generateIcsContent({
      title: "产品评审会",
      startTime: "2026-08-20T14:00:00Z",
      endTime: "2026-08-20T15:00:00Z",
      location: "会议室 A",
      attendees: ["alice@example.com", "bob@example.com"],
      description: "讨论 Q3 上线要点",
    });

    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("VERSION:2.0");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("SUMMARY:产品评审会");
    expect(ics).toContain("DTSTART:20260820T140000Z");
    expect(ics).toContain("DTEND:20260820T150000Z");
    expect(ics).toContain("LOCATION:会议室 A");
    expect(ics).toContain("ATTENDEE;CN=alice@example.com:mailto:alice@example.com");
    expect(ics).toContain("END:VEVENT");
    expect(ics).toContain("END:VCALENDAR");
  });

  it("toolExtractMeetingDetails parses message context into calendar proposal item", () => {
    const item = toolExtractMeetingDetails(
      "关于周四项目同步会议",
      "请于 2026-08-25T10:00:00 准时接入腾讯会议，参会人: lead@tech.com"
    );

    expect(item).not.toBeNull();
    expect(item?.kind).toBe("calendar_event");
    expect(item?.title).toBe("关于周四项目同步会议");
    expect(item?.location).toBe("腾讯会议");
    expect(item?.attendees).toContain("lead@tech.com");
    expect(item?.icsContent).toContain("BEGIN:VCALENDAR");
  });

  it("toolExtractTriageSuggestions identifies important vs other split items", () => {
    const triage = toolExtractTriageSuggestions([
      {
        id: "msg_urgent",
        subject: "紧急：生产环境告警请尽快排查",
        from: "ops@company.com",
        body: "asap please check server logs",
      },
      {
        id: "msg_spam",
        subject: "Weekly Digest & Special Promo",
        from: "news@deal.com",
        body: "Unsubscribe from this newsletter",
      },
    ]);

    expect(triage).toHaveLength(2);
    const urgent = triage.find((t) => t.messageId === "msg_urgent");
    expect(urgent?.targetSplit).toBe("important");

    const spam = triage.find((t) => t.messageId === "msg_spam");
    expect(spam?.targetSplit).toBe("other");
  });

  it("toolExtractCommitments extracts i_promised and they_promised commitments with deadlines", () => {
    const res = toolExtractCommitments(
      "项目合作推进",
      "我会在本周五前发送终版报价单。请于8月22日前确认商务条款，另外您提到下周二提供系统演示。"
    );

    expect(res.commitments.length).toBeGreaterThanOrEqual(2);
    const iPromised = res.commitments.find((c) => c.direction === "i_promised");
    expect(iPromised).toBeDefined();
    expect(iPromised?.text).toContain("发送终版报价单");
    expect(iPromised?.deadline).toBe("本周五前");

    const theyPromised = res.commitments.filter((c) => c.direction === "they_promised");
    expect(theyPromised.length).toBeGreaterThanOrEqual(1);
    expect(
      theyPromised.some((c) => c.text.includes("确认商务条款") && c.deadline?.includes("8月22日"))
    ).toBe(true);
  });
});

describe("Agent Workflow Engine", () => {
  it("runs meeting_extractor workflow and emits stepped & token events", async () => {
    const events: AgentStreamEvent[] = [];
    const proposal = await runAgentWorkflow({
      agentType: "meeting_extractor",
      context: {
        subject: "客户需求评审会议",
        from: "client@partner.com",
        body: "我们计划在 2026-09-01T15:00:00 举行需求对接会，地点 Zoom。",
      },
      onEvent: (evt) => events.push(evt),
    });

    expect(proposal).toBeDefined();
    expect(proposal.items.length).toBeGreaterThanOrEqual(1);

    // Verify step events
    const stepEvents = events.filter((e) => e.type === "step");
    expect(stepEvents.length).toBe(3);
    expect(stepEvents[0]).toMatchObject({ type: "step", stepIndex: 1 });
    expect(stepEvents[1]).toMatchObject({ type: "step", stepIndex: 2 });
    expect(stepEvents[2]).toMatchObject({ type: "step", stepIndex: 3 });

    // Verify token events
    const tokenEvents = events.filter((e) => e.type === "token");
    expect(tokenEvents.length).toBeGreaterThan(0);

    // Verify proposal & done events
    const proposalEvent = events.find((e) => e.type === "proposal");
    expect(proposalEvent).toBeDefined();

    const doneEvent = events.find((e) => e.type === "done");
    expect(doneEvent).toBeDefined();

    // Verify calendar item generated
    const calItem = proposal.items.find((i) => i.kind === "calendar_event");
    expect(calItem).toBeDefined();
    if (calItem && calItem.kind === "calendar_event") {
      expect(calItem.icsContent).toContain("BEGIN:VCALENDAR");
    }
  });

  it("runs followup_sequence workflow and generates draft replies", async () => {
    const events: AgentStreamEvent[] = [];
    const proposal = await runAgentWorkflow({
      agentType: "followup_sequence",
      context: {
        subject: "合作意向方案",
        from: "partner@corp.com",
        body: "请审阅附件方案并回复。",
      },
      onEvent: (evt) => events.push(evt),
    });

    expect(proposal.items.length).toBeGreaterThan(0);
    const draftItem = proposal.items.find((i) => i.kind === "draft_reply");
    expect(draftItem).toBeDefined();
    if (draftItem && draftItem.kind === "draft_reply") {
      expect(draftItem.targetTo).toBe("partner@corp.com");
      expect(draftItem.body).toContain("合作意向方案");
    }
  });

  it("runs daily_briefing workflow and generates briefing proposals", async () => {
    const events: AgentStreamEvent[] = [];
    const proposal = await runAgentWorkflow({
      agentType: "daily_briefing",
      context: {
        subject: "每日工作待办总结",
      },
      onEvent: (evt) => events.push(evt),
    });

    expect(proposal.items.length).toBeGreaterThan(0);
    const calEvent = proposal.items.find((i) => i.kind === "calendar_event");
    expect(calEvent).toBeDefined();
    expect(calEvent?.title).toContain("今日工作规划");
  });

  it("runs invoice_scanner skill workflow and extracts financial entries", async () => {
    const events: AgentStreamEvent[] = [];
    const proposal = await runAgentWorkflow({
      agentType: "invoice_scanner",
      context: {
        subject: "阿里云电子发票开具通知",
        from: "billing@service.aliyun.com",
        body: "您的云服务器消费发票已开具，金额 899.00 CNY。",
      },
      onEvent: (evt) => events.push(evt),
    });

    expect(proposal.items.length).toBeGreaterThan(0);
    const invItem = proposal.items.find((i) => i.kind === "invoice_entry");
    expect(invItem).toBeDefined();
    if (invItem && invItem.kind === "invoice_entry") {
      expect(invItem.amount).toBe(899.0);
      expect(invItem.currency).toBe("CNY");
    }
  });

  it("handles workflow abort correctly", async () => {
    const reqId = "test_req_abort";
    const events: AgentStreamEvent[] = [];

    await expect(
      runAgentWorkflow({
        agentType: "custom",
        prompt: "分析所有未读邮件",
        requestId: reqId,
        onEvent: (evt) => {
          events.push(evt);
          if (evt.type === "step" && evt.stepIndex === 1) {
            abortAgentWorkflow(reqId);
          }
        },
      })
    ).rejects.toThrow();

    const errorEvent = events.find((e) => e.type === "error");
    expect(errorEvent).toBeDefined();
    if (errorEvent && errorEvent.type === "error") {
      expect(errorEvent.code).toBe("ABORTED");
    }
  });

  it("runs batch_triage workflow and emits split proposals", async () => {
    const events: AgentStreamEvent[] = [];
    const proposal = await runAgentWorkflow({
      agentType: "batch_triage",
      context: {
        subject: "紧急生产故障排查",
        from: "dev@company.com",
        body: "请立即处理生产故障告警",
      },
      onEvent: (evt) => events.push(evt),
    });

    expect(proposal.items.length).toBeGreaterThan(0);
    expect(proposal.items[0].kind).toBe("split_change");
  });

  it("parseProposalItemsFromOutput extracts LLM split proposals and overrides pre-populated items", () => {
    const mockExisting = [
      {
        id: "prop_1",
        kind: "split_change" as const,
        messageId: "msg_101",
        subject: "Re: 【超期提醒】交货 2 单已超期",
        targetSplit: "important" as const,
        reason: "默认规则原因",
        selected: true,
      },
      {
        id: "prop_2",
        kind: "split_change" as const,
        messageId: "msg_102",
        subject: "你好",
        targetSplit: "important" as const,
        reason: "默认规则原因",
        selected: true,
      },
    ];

    const llmReport = `
根据分析，以下是分箱建议：
\`\`\`json
{
  "split_change": [
    {
      "message_id": "msg_101",
      "subject": "Re: 【超期提醒】交货 2 单已超期",
      "new_split": "important",
      "reason": "涉及紧急订单超期处理"
    },
    {
      "message_id": "msg_102",
      "subject": "你好",
      "new_split": "other",
      "reason": "纯问候无实质业务内容"
    }
  ]
}
\`\`\`
`;

    const parsed = parseProposalItemsFromOutput(llmReport, mockExisting);
    expect(parsed).toHaveLength(2);
    const item1 = parsed[0] as AgentProposalSplitItem;
    const item2 = parsed[1] as AgentProposalSplitItem;
    expect(item1.targetSplit).toBe("important");
    expect(item1.reason).toBe("涉及紧急订单超期处理");

    expect(item2.targetSplit).toBe("other");
    expect(item2.reason).toBe("纯问候无实质业务内容");
  });
});
