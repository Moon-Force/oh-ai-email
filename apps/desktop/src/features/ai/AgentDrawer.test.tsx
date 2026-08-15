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
    expect(screen.queryByText("AI 智能工作流")).not.toBeInTheDocument();
  });

  it("renders correctly when open with proposal cards", () => {
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
      streamText: "正在分析数据并生成提议...",
    });

    render(wrap(<AgentDrawer />));

    expect(screen.getByText("AI 智能工作流")).toBeInTheDocument();
    expect(screen.getByText("每日简报建议")).toBeInTheDocument();
    expect(screen.getByText("产品评审会")).toBeInTheDocument();
    expect(screen.getByText("Re: 进度汇报")).toBeInTheDocument();

    // Check action buttons
    expect(screen.getByRole("button", { name: "确认采纳所选项" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "一键全部采纳" })).toBeInTheDocument();
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

    const checkbox = screen.getByRole("checkbox", { name: "" });
    expect(checkbox).toBeChecked();

    fireEvent.click(checkbox);
    expect(useAgentStore.getState().proposal?.items[0].selected).toBe(false);
  });
});
