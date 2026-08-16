import { beforeEach, describe, expect, it } from "vitest";
import { useAgentStore } from "./agentStore";
import { useMailStore } from "../mail/store";
import type { AgentProposalData } from "../../lib/ipc";

describe("AgentStore", () => {
  beforeEach(() => {
    useAgentStore.getState().reset();
    useAgentStore.setState({ open: false, proposal: null, status: "idle" });
  });

  it("handles drawer open and close", () => {
    const store = useAgentStore.getState();
    expect(store.open).toBe(false);

    store.openDrawer("meeting_extractor", { subject: "Test Meeting" }, "custom prompt");
    expect(useAgentStore.getState().open).toBe(true);
    expect(useAgentStore.getState().agentType).toBe("meeting_extractor");
    expect(useAgentStore.getState().prompt).toBe("custom prompt");

    useAgentStore.getState().closeDrawer();
    expect(useAgentStore.getState().open).toBe(false);
  });

  it("toggles item selection and select all items", () => {
    const mockProposal: AgentProposalData = {
      title: "提议测试",
      summary: "包含 2 项待审阅操作",
      items: [
        {
          id: "item_1",
          kind: "draft_reply",
          targetTo: "a@b.com",
          subject: "Re: Hi",
          body: "Hello",
          selected: true,
        },
        {
          id: "item_2",
          kind: "split_change",
          messageId: "msg_123",
          subject: "Weekly update",
          targetSplit: "important",
          reason: "重要进展",
          selected: true,
        },
      ],
    };

    useAgentStore.setState({ proposal: mockProposal });

    // Toggle item_1 to false
    useAgentStore.getState().toggleItemSelection("item_1");
    expect(useAgentStore.getState().proposal?.items[0].selected).toBe(false);
    expect(useAgentStore.getState().proposal?.items[1].selected).toBe(true);

    // Select all false
    useAgentStore.getState().selectAllItems(false);
    expect(useAgentStore.getState().proposal?.items.every((i) => !i.selected)).toBe(true);

    // Select all true
    useAgentStore.getState().selectAllItems(true);
    expect(useAgentStore.getState().proposal?.items.every((i) => i.selected)).toBe(true);
  });

  it("runs workflow and receives stream simulation in fallback mode", async () => {
    await useAgentStore.getState().runWorkflow("daily_briefing", "", { from: "test@company.com" });

    const state = useAgentStore.getState();
    expect(state.status).toBe("review_pending");
    expect(state.proposal).not.toBeNull();
    expect(state.streamText.length).toBeGreaterThan(0);
    expect(state.steps.length).toBeGreaterThanOrEqual(1);
  });

  it("accepts selected items and applies actions to mailStore", async () => {
    // Setup message in mailStore
    useMailStore.setState({
      messages: [
        {
          id: "msg_split_target",
          accountId: "acc_1",
          folderId: "f_inbox",
          folderRole: "inbox",
          uid: 1,
          from: "sender@corp.com",
          fromName: "Sender",
          subject: "项目变更通知",
          snippet: "变更内容",
          date: "10:00",
          dateMs: Date.now(),
          unread: true,
          split: "other",
        },
      ],
    });

    const mockProposal: AgentProposalData = {
      title: "待采纳提议",
      summary: "1 项分箱变更，1 项草稿",
      items: [
        {
          id: "item_split",
          kind: "split_change",
          messageId: "msg_split_target",
          subject: "项目变更通知",
          targetSplit: "important",
          reason: "重要紧急",
          selected: true,
        },
        {
          id: "item_draft",
          kind: "draft_reply",
          targetTo: "sender@corp.com",
          subject: "Re: 项目变更通知",
          body: "收到变更，马上处理。",
          selected: true,
        },
        {
          id: "item_cal",
          kind: "calendar_event",
          title: "项目变更沟通会",
          startTime: "2026-08-20T10:00:00Z",
          icsContent: "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR",
          selected: false, // unselected
        },
      ],
    };

    useAgentStore.setState({ proposal: mockProposal });

    const result = await useAgentStore.getState().acceptSelected();

    expect(result.acceptedCount).toBe(2);
    expect(result.splitChanges).toHaveLength(1);
    expect(result.drafts).toHaveLength(1);
    expect(result.calendarEvents).toHaveLength(0);

    // Verify split updated in mailStore
    const updatedMsg = useMailStore.getState().messages.find((m) => m.id === "msg_split_target");
    expect(updatedMsg?.split).toBe("important");

    expect(useAgentStore.getState().status).toBe("completed");
  });

  it("handles abortWorkflow gracefully", async () => {
    useAgentStore.setState({ activeReqId: "active_req_123", status: "executing_tools" });
    await useAgentStore.getState().abortWorkflow();

    expect(useAgentStore.getState().status).toBe("cancelled");
    expect(useAgentStore.getState().activeReqId).toBeNull();
  });
});
