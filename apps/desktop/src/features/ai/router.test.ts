import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  cleanContext,
  cancelRequest,
  createAiRequestId,
  draftReply,
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
