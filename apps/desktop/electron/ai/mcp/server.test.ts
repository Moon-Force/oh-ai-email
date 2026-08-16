import { describe, it, expect, beforeEach } from "vitest";
import { MailMcpServer, MAIL_MCP_TOOLS } from "./server";
import { initDb, upsertMessage, getDraft } from "../../db";

describe("Mail MCP Server (Model Context Protocol)", () => {
  let server: MailMcpServer;

  beforeEach(async () => {
    await initDb();
    server = new MailMcpServer();
  });

  it("handles initialize and returns server capabilities", async () => {
    const req = JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {},
    });

    const resRaw = await server.handleMessage(req);
    expect(resRaw).toBeDefined();
    const res = JSON.parse(resRaw!);
    expect(res.id).toBe(1);
    expect(res.result.protocolVersion).toBe("2024-11-05");
    expect(res.result.serverInfo.name).toBe("oh-ai-email-mcp");
  });

  it("handles tools/list and returns available mail tools", async () => {
    const req = JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
    });

    const resRaw = await server.handleMessage(req);
    const res = JSON.parse(resRaw!);
    expect(res.id).toBe(2);
    expect(res.result.tools.length).toBe(MAIL_MCP_TOOLS.length);
    expect(res.result.tools.some((t: { name: string }) => t.name === "search_messages")).toBe(true);
    expect(res.result.tools.some((t: { name: string }) => t.name === "create_mail_draft")).toBe(true);
  });

  it("executes search_messages and get_message_context tool calls", async () => {
    upsertMessage({
      id: "msg_mcp_1",
      accountId: "acc1",
      folderId: "inbox",
      uid: 1,
      subject: "Q4 财报预算会议",
      from: "finance@company.com",
      fromName: "Finance Team",
      dateMs: Date.now(),
      dateLabel: "2026-08-17",
      snippet: "请查收 Q4 预算草案并参加周四下午的 Q4 预算审计会议。",
      unread: true,
      split: "important",
    });

    // 1. Search tool
    const searchReq = JSON.stringify({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "search_messages",
        arguments: { query: "预算" },
      },
    });

    const searchResRaw = await server.handleMessage(searchReq);
    const searchRes = JSON.parse(searchResRaw!);
    expect(searchRes.result.content[0].text).toContain("Q4 财报预算会议");

    // 2. Message context tool
    const contextReq = JSON.stringify({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: {
        name: "get_message_context",
        arguments: { messageId: "msg_mcp_1" },
      },
    });

    const contextResRaw = await server.handleMessage(contextReq);
    const contextRes = JSON.parse(contextResRaw!);
    expect(contextRes.result.content[0].text).toContain("Q4 预算审计会议");
  });

  it("executes create_mail_draft tool and creates local draft safely", async () => {
    const draftReq = JSON.stringify({
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: {
        name: "create_mail_draft",
        arguments: {
          to: "partner@example.com",
          subject: "Re: 合作意向书",
          body: "我们已审阅贵司提案，方案基本可行。",
        },
      },
    });

    const resRaw = await server.handleMessage(draftReq);
    const res = JSON.parse(resRaw!);
    expect(res.result.content[0].text).toContain("saved_to_drafts");

    const parsedResult = JSON.parse(res.result.content[0].text);
    const draft = getDraft(parsedResult.draftId);
    expect(draft).toBeDefined();
    expect(draft?.to).toBe("partner@example.com");
    expect(draft?.body).toContain("方案基本可行");
  });
});
