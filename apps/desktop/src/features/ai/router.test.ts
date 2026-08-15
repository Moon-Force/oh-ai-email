import { describe, expect, it, vi, beforeEach } from "vitest";
import { cleanContext, draftReply, rewriteTone, summarize, AiRequestError } from "./router";

vi.mock("../../lib/ipc", () => ({
  hasDesktopApi: () => true,
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
});

describe("draftReply", () => {
  it("returns editable draft", async () => {
    const d = await draftReply("Q3 assets");
    expect(d).toMatch(/你好/);
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
