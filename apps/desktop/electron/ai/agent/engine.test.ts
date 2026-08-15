import { describe, expect, it, vi } from "vitest";
import {
  generateIcsContent,
  toolExtractMeetingDetails,
  toolExtractTriageSuggestions,
  toolSearchMessages,
} from "./tools";
import {
  abortAgentWorkflow,
  runAgentWorkflow,
} from "./engine";
import type { AgentStreamEvent } from "./types";
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
      "请于 2026-08-25T10:00:00 准时接入腾讯会议，参会人: lead@tech.com",
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
      }),
    ).rejects.toThrow();

    const errorEvent = events.find((e) => e.type === "error");
    expect(errorEvent).toBeDefined();
    if (errorEvent && errorEvent.type === "error") {
      expect(errorEvent.code).toBe("ABORTED");
    }
  });
});

