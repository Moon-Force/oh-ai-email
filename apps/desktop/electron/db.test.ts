import { describe, it, expect, beforeEach } from "vitest";
import {
  initDb,
  createAgentSession,
  getAgentSession,
  listAgentSessions,
  deleteAgentSession,
  insertAgentMessage,
  listAgentMessages,
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
});
