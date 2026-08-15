import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  cleanContext,
  cancelRequest,
  createAiRequestId,
  draftReply,
  extractActionItems,
  quickReplyDraft,
  rewriteTone,
  summarize,
  AiRequestError,
} from "./router";

vi.mock("../../lib/ipc", () => ({
  hasDesktopApi: () => true,
  aiAbort: vi.fn(async () => true),
  aiSummarize: vi.fn(async () => ({ ok: true as const, text: "【摘要】要点：hello", mode: "cloud" as const })),
  aiDraftReply: vi.fn(async () => ({
    ok: true as const,
    text: "你好，\n\n关于来信的回复。",
    mode: "cloud" as const,
  })),
  aiQuickReply: vi.fn(async () => ({
    ok: true as const,
    text: "收到，非常感谢！",
    mode: "cloud" as const,
  })),
  aiActionItems: vi.fn(async () => ({
    ok: true as const,
    tags: ["需回复", "待办事项"],
    actionItems: ["提交 Q3 报告", "确认预算"],
    deadline: "周五下午5点",
    mode: "cloud" as const,
  })),
  aiRewrite: vi.fn(async () => ({
    ok: true as const,
    text: "敬启者：\n\nthanks\n\n此致",
    mode: "cloud" as const,
  })),
  aiCompose: vi.fn(async () => ({ ok: true as const, text: "生成正文", mode: "cloud" as const })),
}));

import * as ipc from "../../lib/ipc";

beforeEach(() => {
  vi.mocked(ipc.aiAbort).mockClear();
  vi.mocked(ipc.aiSummarize).mockClear();
  vi.mocked(ipc.aiDraftReply).mockClear();
  vi.mocked(ipc.aiQuickReply).mockClear();
  vi.mocked(ipc.aiActionItems).mockClear();
  vi.mocked(ipc.aiRewrite).mockClear();
});

describe("cleanContext", () => {
  it("strips quote lines and truncates", () => {
    const input = "Hello\n> quoted\nWorld";
    expect(cleanContext(input)).toBe("Hello\n\nWorld");
    expect(cleanContext("a".repeat(50), 10)).toHaveLength(10);
  });
});

describe("summarize", () => {
  it("calls desktop AI and returns text", async () => {
    await expect(summarize("hello team")).resolves.toMatch(/摘要/);
    expect(ipc.aiSummarize).toHaveBeenCalled();
  });

  it("passes requestId when provided", async () => {
    await summarize("hello team", { requestId: "req_123" });
    expect(ipc.aiSummarize).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: "req_123" }),
    );
  });
});

describe("draftReply", () => {
  it("returns editable draft", async () => {
    const d = await draftReply("Q3 assets");
    expect(d).toMatch(/你好/);
  });

  it("passes requestId when provided", async () => {
    await draftReply({ body: "test", subject: "re" }, { requestId: "req_draft_1" });
    expect(ipc.aiDraftReply).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: "req_draft_1" }),
    );
  });
});

describe("quickReplyDraft", () => {
  it("generates quick reply text", async () => {
    const d = await quickReplyDraft({ body: "test", replyType: "ack" });
    expect(d).toMatch(/收到/);
    expect(ipc.aiQuickReply).toHaveBeenCalledWith(
      expect.objectContaining({ replyType: "ack", body: "test" }),
    );
  });

  it("passes requestId when provided", async () => {
    await quickReplyDraft(
      { body: "test", replyType: "agree" },
      { requestId: "req_qr_1" },
    );
    expect(ipc.aiQuickReply).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: "req_qr_1", replyType: "agree" }),
    );
  });
});

describe("extractActionItems", () => {
  it("extracts tags and action items", async () => {
    const data = await extractActionItems({ body: "Please submit Q3 report by Friday", subject: "Report" });
    expect(data.tags).toContain("需回复");
    expect(data.actionItems).toContain("提交 Q3 报告");
    expect(data.deadline).toBe("周五下午5点");
    expect(ipc.aiActionItems).toHaveBeenCalled();
  });

  it("passes requestId when provided", async () => {
    await extractActionItems({ body: "test" }, { requestId: "req_act_1" });
    expect(ipc.aiActionItems).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: "req_act_1" }),
    );
  });
});

describe("rewriteTone", () => {
  it("delegates to aiRewrite", async () => {
    const formal = await rewriteTone("thanks", "formal");
    expect(formal).toMatch(/敬启者/);
    expect(ipc.aiRewrite).toHaveBeenCalledWith(
      expect.objectContaining({ tone: "formal", text: "thanks" }),
    );
  });

  it("passes requestId when provided", async () => {
    await rewriteTone("thanks", "shorter", { requestId: "req_rewrite_1" });
    expect(ipc.aiRewrite).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: "req_rewrite_1", tone: "shorter" }),
    );
  });
});

describe("cancelRequest and createAiRequestId", () => {
  it("creates unique ai request ids", () => {
    const id1 = createAiRequestId();
    const id2 = createAiRequestId();
    expect(id1).toMatch(/^airq_/);
    expect(id1).not.toBe(id2);
  });

  it("calls aiAbort via cancelRequest", async () => {
    const res = await cancelRequest("req_test");
    expect(res).toBe(true);
    expect(ipc.aiAbort).toHaveBeenCalledWith("req_test");
  });
});

describe("errors", () => {
  it("throws AiRequestError on failure", async () => {
    vi.mocked(ipc.aiSummarize).mockResolvedValueOnce({
      ok: false,
      code: "NO_KEY",
      error: "未配置",
    });
    await expect(summarize("x")).rejects.toBeInstanceOf(AiRequestError);
  });
});
