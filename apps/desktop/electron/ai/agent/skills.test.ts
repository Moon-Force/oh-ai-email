import { describe, it, expect, beforeEach } from "vitest";
import { SkillsManager, parseSkillMarkdown, exportSkillMarkdown, BUILTIN_SKILLS } from "./skills";
import { initDb } from "../../db";

describe("Skills System", () => {
  beforeEach(async () => {
    await initDb();
  });

  it("initializes with 4 built-in email skills", () => {
    const manager = new SkillsManager();
    const list = manager.listSkills();
    expect(list.length).toBeGreaterThanOrEqual(4);
    expect(list.some((s) => s.id === "meeting_extractor")).toBe(true);
    expect(list.some((s) => s.id === "invoice_scanner")).toBe(true);
    expect(list.some((s) => s.id === "outreach_translator")).toBe(true);
    expect(list.some((s) => s.id === "smart_sorter")).toBe(true);

    const meetingSkill = manager.getSkill("meeting_extractor");
    expect(meetingSkill).toBeDefined();
    expect(meetingSkill?.name).toBe("会议日程提取助手");
    expect(meetingSkill?.allowedTools).toContain("calendar_proposal");
  });

  it("parses and exports pi-style markdown skills with YAML frontmatter correctly", () => {
    const md = `---
id: custom_legal_reviewer
name: 法务条款审查助手
description: 专门审查邮件合同附件中的免责条款
version: 1.2.0
tags: 合同,法务
allowedTools: extract_action_items,draft_proposal
---

你是一位资深公司法务顾问。请审查邮件中涉及的合作条款并标记风险。`;

    const parsed = parseSkillMarkdown(md, "fallback_id");
    expect(parsed.id).toBe("custom_legal_reviewer");
    expect(parsed.name).toBe("法务条款审查助手");
    expect(parsed.allowedTools).toEqual(["extract_action_items", "draft_proposal"]);
    expect(parsed.tags).toEqual(["合同", "法务"]);
    expect(parsed.systemPrompt).toContain("你是一位资深公司法务顾问");

    const exported = exportSkillMarkdown(parsed);
    expect(exported).toContain("id: custom_legal_reviewer");
    expect(exported).toContain("name: 法务条款审查助手");
    expect(exported).toContain("tags: 合同,法务");
    expect(exported).toContain("你是一位资深公司法务顾问");
  });

  it("registers, persists, and deletes custom skills dynamically", () => {
    const manager = new SkillsManager();
    manager.saveCustomSkill({
      id: "qa_bot",
      name: "QA 助手",
      description: "快速问答与提炼",
      version: "1.0.0",
      allowedTools: ["extract_action_items"],
      systemPrompt: "请用极简短语言回答问题。",
      tags: ["问答"],
    });

    expect(manager.getSkill("qa_bot")?.name).toBe("QA 助手");
    expect(manager.getSkill("qa_bot")?.isCustom).toBe(true);

    // Protection: built-in skills cannot be deleted
    const deleteBuiltinResult = manager.deleteCustomSkill("meeting_extractor");
    expect(deleteBuiltinResult).toBe(false);

    // Custom skills can be deleted
    const deleteCustomResult = manager.deleteCustomSkill("qa_bot");
    expect(deleteCustomResult).toBe(true);
    expect(manager.getSkill("qa_bot")).toBeUndefined();
  });
});
