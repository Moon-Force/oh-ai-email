import { describe, it, expect, beforeEach } from "vitest";
import {
  initDb,
  createAgentSession,
  getAgentSession,
  listAgentSessions,
  deleteAgentSession,
  insertAgentMessage,
  listAgentMessages,
  saveCustomSkill,
  listCustomSkills,
  getCustomSkill,
  deleteCustomSkill,
} from "./db";

describe("Database Agent Sessions and Messages", () => {
  beforeEach(async () => {
    await initDb();
  });

  it("creates, retrieves, and lists agent sessions", () => {
    const now = Date.now();
    createAgentSession({
      id: "sess_1",
      title: "Q3 运营会议日程整理",
      skillId: "meeting_extractor",
      createdAt: now,
      updatedAt: now,
    });

    const session = getAgentSession("sess_1");
    expect(session).toBeDefined();
    expect(session?.title).toBe("Q3 运营会议日程整理");
    expect(session?.skillId).toBe("meeting_extractor");

    const list = listAgentSessions();
    expect(list.some((s) => s.id === "sess_1")).toBe(true);
  });

  it("inserts and retrieves agent messages for a session", () => {
    const now = Date.now();
    createAgentSession({
      id: "sess_2",
      title: "报销整理",
      createdAt: now,
      updatedAt: now,
    });

    insertAgentMessage({
      id: "msg_1",
      sessionId: "sess_2",
      role: "user",
      content: "请整理附件发票",
      createdAt: now + 1,
    });

    insertAgentMessage({
      id: "msg_2",
      sessionId: "sess_2",
      role: "assistant",
      content: "已提取发票并生成报销单",
      thinkingContent: "思考过程：识别商户与总额...",
      createdAt: now + 2,
    });

    const messages = listAgentMessages("sess_2");
    expect(messages.length).toBe(2);
    expect(messages[0].role).toBe("user");
    expect(messages[1].thinkingContent).toContain("思考过程");

    deleteAgentSession("sess_2");
    expect(getAgentSession("sess_2")).toBeNull();
    expect(listAgentMessages("sess_2").length).toBe(0);
  });

  it("saves, lists, and deletes custom skills", () => {
    const now = Date.now();
    saveCustomSkill({
      id: "custom_contract_reviewer",
      name: "商务合同审查助手",
      description: "快速扫描邮件中的法律风险与商务条款",
      allowedTools: ["search_messages", "get_thread_context"],
      systemPrompt: "你是一名资深商务法律顾问，请重点审查违约金与账期。",
      tags: ["法务", "合同"],
      createdAt: now,
      updatedAt: now,
    });

    const skill = getCustomSkill("custom_contract_reviewer");
    expect(skill).toBeDefined();
    expect(skill?.name).toBe("商务合同审查助手");
    expect(skill?.allowedTools).toContain("search_messages");
    expect(skill?.tags).toContain("法务");

    const list = listCustomSkills();
    expect(list.some((s) => s.id === "custom_contract_reviewer")).toBe(true);

    deleteCustomSkill("custom_contract_reviewer");
    expect(getCustomSkill("custom_contract_reviewer")).toBeNull();
  });
});
