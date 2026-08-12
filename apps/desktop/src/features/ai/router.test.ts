import { describe, expect, it } from "vitest";
import { cleanContext, draftReply, rewriteTone, summarize } from "./router";

describe("cleanContext", () => {
  it("strips quote lines and truncates", () => {
    const input = "Hello\n> quoted\nWorld";
    expect(cleanContext(input)).toBe("Hello\n\nWorld");
    expect(cleanContext("a".repeat(50), 10)).toHaveLength(10);
  });
});

describe("summarize", () => {
  it("prefixes cloud vs local", async () => {
    await expect(summarize("hello team")).resolves.toMatch(/^【摘要】/);
    await expect(summarize("hello team", "local")).resolves.toMatch(/^【本机摘要】/);
  });
});

describe("draftReply", () => {
  it("returns editable draft", async () => {
    const d = await draftReply("Q3 assets");
    expect(d).toMatch(/你好/);
    expect(d).toMatch(/Q3/);
  });
});

describe("rewriteTone", () => {
  it("shortens and formalizes", async () => {
    const base = "line1\n\nline2\n\nline3\n\nline4";
    const short = await rewriteTone(base, "shorter");
    expect(short.split("\n").filter(Boolean).length).toBeLessThanOrEqual(3);
    const formal = await rewriteTone("thanks", "formal");
    expect(formal).toMatch(/敬启者/);
  });
});
