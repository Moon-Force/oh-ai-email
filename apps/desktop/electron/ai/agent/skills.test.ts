import { describe, it, expect } from "vitest";
import { SkillsManager, parseSkillMarkdown, BUILTIN_SKILLS } from "./skills";

describe("Skills System", () => {
  it("initializes with 4 built-in email skills", () => {
    const manager = new SkillsManager();
    const list = manager.listSkills();
    expect(list.length).toBe(4);
    expect(list.map((s) => s.id)).toEqual([
      "meeting_extractor",
      "invoice_scanner",
      "outreach_translator",
      "smart_sorter",
    ]);

    const meetingSkill = manager.getSkill("meeting_extractor");
    expect(meetingSkill).toBeDefined();
    expect(meetingSkill?.name).toBe("会议日程提取助手");
    expect(meetingSkill?.allowedTools).toContain("calendar_proposal");
  });

  it("parses pi-style markdown skills with YAML frontmatter correctly", () => {
    const md = `---
id: custom_legal_reviewer
name: 法务条款审查助手
description: 专门审查邮件合同附件中的免责条款
allowedTools: extract_action_items, draft_proposal
tags: 合同, 法务
version: 1.2.0
---

你是一位资深公司法务顾问。请审查邮件中涉及的合作条款并标记风险。`;

    const parsed = parseSkillMarkdown(md, "fallback_id");
    expect(parsed.id).toBe("custom_legal_reviewer");
    expect(parsed.name).toBe("法务条款审查助手");
    expect(parsed.allowedTools).toEqual(["extract_action_items", "draft_proposal"]);
    expect(parsed.tags).toEqual(["合同", "法务"]);
    expect(parsed.systemPrompt).toContain("你是一位资深公司法务顾问");
  });

  it("registers custom skills into manager dynamically", () => {
    const manager = new SkillsManager();
    manager.registerSkill({
      id: "qa_bot",
      name: "QA Bot",
      description: "Answers questions",
      version: "1.0.0",
      allowedTools: [],
      systemPrompt: "Answer concisely.",
    });

    expect(manager.listSkills().length).toBe(5);
    expect(manager.getSkill("qa_bot")?.name).toBe("QA Bot");
  });
});
