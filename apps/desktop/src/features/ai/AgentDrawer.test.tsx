import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import AgentDrawer from "./AgentDrawer";
import { useAgentStore } from "./agentStore";
import AppThemeProvider from "../../theme/AppThemeProvider";
import type { AgentProposalData } from "../../lib/ipc";

function wrap(ui: React.ReactElement) {
  return <AppThemeProvider mode="light">{ui}</AppThemeProvider>;
}

describe("AgentDrawer Component", () => {
  it("renders closed when open is false", () => {
    useAgentStore.setState({ open: false });
    render(wrap(<AgentDrawer />));
    expect(screen.queryByText("AI 智能体工作流")).not.toBeInTheDocument();
  });

  it("renders correctly when open with proposal cards and thinking stream", () => {
    const mockProposal: AgentProposalData = {
      title: "每日简报建议",
      summary: "已生成 1 项会议日程与 1 封回复草稿",
      items: [
        {
          id: "cal_1",
          kind: "calendar_event",
          title: "产品评审会",
          startTime: "2026-08-20 14:00",
          location: "会议室 A",
          attendees: ["alice@example.com"],
          icsContent: "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR",
          selected: true,
        },
        {
          id: "draft_1",
          kind: "draft_reply",
          targetTo: "lead@corp.com",
          subject: "Re: 进度汇报",
          body: "已收到进展汇报，方案通过。",
          selected: true,
        },
      ],
    };

    useAgentStore.setState({
      open: true,
      status: "review_pending",
      proposal: mockProposal,
      thinkingText: "深度思考过程：已识别关键时间点...",
      streamText: "正在分析数据并生成提议...",
    });

    render(wrap(<AgentDrawer />));

    expect(screen.getByText("AI 智能体工作流")).toBeInTheDocument();
    expect(screen.getByText("每日简报建议")).toBeInTheDocument();
    expect(screen.getByText("产品评审会")).toBeInTheDocument();
    expect(screen.getByText("Re: 进度汇报")).toBeInTheDocument();
    expect(screen.getByText("深度思考过程 (Thinking Stream)")).toBeInTheDocument();

    // Check action buttons
    expect(screen.getByRole("button", { name: /采纳已选/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "全部采纳" })).toBeInTheDocument();
  });

  it("toggles item checkbox on click", () => {
    const mockProposal: AgentProposalData = {
      title: "分箱建议",
      summary: "归类建议",
      items: [
        {
          id: "split_1",
          kind: "split_change",
          messageId: "m1",
          subject: "推广邮件",
          targetSplit: "other",
          reason: "检测到营销推广内容",
          selected: true,
        },
      ],
    };

    useAgentStore.setState({
      open: true,
      status: "review_pending",
      proposal: mockProposal,
    });

    render(wrap(<AgentDrawer />));

    const checkboxes = screen.getAllByRole("checkbox");
    // Find the item checkbox
    const itemCheckbox = checkboxes[checkboxes.length - 1];
    expect(itemCheckbox).toBeChecked();

    fireEvent.click(itemCheckbox);
    expect(useAgentStore.getState().proposal?.items[0].selected).toBe(false);
  });

  it("triggers quick agent shortcuts on click", () => {
    useAgentStore.setState({
      open: true,
      status: "idle",
      agentType: "custom",
    });

    render(wrap(<AgentDrawer />));

    const dailyBtn = screen.getByTestId("quick-agent-daily-briefing");
    const followupBtn = screen.getByTestId("quick-agent-followup");
    const triageBtn = screen.getByTestId("quick-agent-triage");
    const invoiceBtn = screen.getByTestId("quick-agent-invoice");

    expect(dailyBtn).toBeInTheDocument();
    expect(followupBtn).toBeInTheDocument();
    expect(triageBtn).toBeInTheDocument();
    expect(invoiceBtn).toBeInTheDocument();

    fireEvent.click(followupBtn);
    expect(useAgentStore.getState().agentType).toBe("followup_sequence");

    fireEvent.click(triageBtn);
    expect(useAgentStore.getState().agentType).toBe("smart_sorter");

    fireEvent.click(invoiceBtn);
    expect(useAgentStore.getState().agentType).toBe("invoice_scanner");

    fireEvent.click(dailyBtn);
    expect(useAgentStore.getState().agentType).toBe("daily_briefing");
  });
});
