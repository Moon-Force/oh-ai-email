import { describe, it, expect } from "vitest";
import {
  estimateTokens,
  estimateMessagesTokens,
  shouldCompact,
  compactSessionMessages,
  type MessageToCompact,
} from "./compaction";

describe("Compaction Module", () => {
  it("estimates tokens accurately for Chinese and English strings", () => {
    const enTokens = estimateTokens("Hello world, this is a test prompt.");
    expect(enTokens).toBeGreaterThan(5);
    expect(enTokens).toBeLessThan(20);

    const zhTokens = estimateTokens("这是一段用于测试中文字符 Token 估算的句子。");
    expect(zhTokens).toBeGreaterThan(15);
  });

  it("does not compact when under budget", async () => {
    const shortMessages: MessageToCompact[] = [
      { role: "user", content: "Hi" },
      { role: "assistant", content: "Hello! How can I help you today?" },
    ];

    const res = await compactSessionMessages(shortMessages, undefined, { maxTokenBudget: 5000 });
    expect(res.compacted).toBe(false);
    expect(res.compactedMessages.length).toBe(2);
  });

  it("compacts historical messages when exceeding token budget", async () => {
    const longText = "这是一段非常冗长的邮件历史背景讨论，包含了大量详细技术细节和历史决策过程。".repeat(20);
    const messages: MessageToCompact[] = [
      { role: "user", content: longText },
      { role: "assistant", content: "收到，已了解上述技术细节。" },
      { role: "user", content: "请问第二阶段的部署窗口是哪一天？" },
      { role: "assistant", content: "预计在下周四晚间进行灰度发布。" },
      { role: "user", content: "需要通知哪些业务方？" },
      { role: "assistant", content: "需通知市场部与运营组。" },
    ];

    expect(shouldCompact(messages, 200)).toBe(true);

    const res = await compactSessionMessages(messages, undefined, {
      maxTokenBudget: 200,
      recentMessagesToKeep: 2,
    });

    expect(res.compacted).toBe(true);
    expect(res.newTokenCount).toBeLessThan(res.previousTokenCount);
    expect(res.compactedMessages[0].role).toBe("system");
    expect(res.compactedMessages[0].content).toContain("前序上下文摘要快照");
    expect(res.compactedMessages.length).toBe(3); // 1 system summary + 2 recent kept
  });
});
