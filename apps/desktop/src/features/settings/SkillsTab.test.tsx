import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import SkillsTab from "./SkillsTab";
import AppThemeProvider from "../../theme/AppThemeProvider";

function wrap(ui: React.ReactElement) {
  return <AppThemeProvider mode="light">{ui}</AppThemeProvider>;
}

describe("SkillsTab Component", () => {
  it("renders skills ecosystem title and action buttons", async () => {
    render(wrap(<SkillsTab />));

    expect(screen.getByText("智能体技能生态 (Skills Ecosystem)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "新建自定义技能" })).toBeInTheDocument();
    expect(screen.getByText("Model Context Protocol (MCP) 邮件服务")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "复制 Claude / Cursor 配置 JSON" })).toBeInTheDocument();
  });

  it("renders built-in skills cards correctly", async () => {
    render(wrap(<SkillsTab />));

    // Wait for skill names to be displayed from fallback / ipc
    expect(await screen.findByText("会议日程提取助手")).toBeInTheDocument();
    expect(await screen.findByText("财务发票与报销整理")).toBeInTheDocument();
  });
});
