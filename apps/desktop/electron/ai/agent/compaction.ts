export interface MessageToCompact {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  thinkingContent?: string;
}

export interface CompactionOptions {
  maxTokenBudget?: number; // Default: 6000
  recentMessagesToKeep?: number; // Default: 4
  customSummaryGenerator?: (messages: MessageToCompact[]) => Promise<string>;
}

export interface CompactionResult {
  compacted: boolean;
  previousTokenCount: number;
  newTokenCount: number;
  summary: string;
  compactedMessages: MessageToCompact[];
}

/**
 * Fast character-based token estimator (approx 1 token ~= 3.5 chars for mixed CJK & English).
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  // CJK character count
  const cjkMatches = text.match(/[\u4e00-\u9fa5\u3040-\u30ff\uac00-\ud7af]/g);
  const cjkCount = cjkMatches ? cjkMatches.length : 0;
  const nonCjkLength = text.length - cjkCount;
  return Math.ceil(cjkCount * 1.2 + nonCjkLength / 3.8);
}

/**
 * Estimates total tokens in a message list.
 */
export function estimateMessagesTokens(messages: MessageToCompact[]): number {
  return messages.reduce((acc, m) => {
    return acc + estimateTokens(m.content) + (m.thinkingContent ? estimateTokens(m.thinkingContent) : 0) + 10;
  }, 0);
}

/**
 * Checks whether message history should be compacted.
 */
export function shouldCompact(
  messages: MessageToCompact[],
  budget: number = 6000
): boolean {
  if (messages.length <= 4) return false;
  const totalTokens = estimateMessagesTokens(messages);
  return totalTokens > budget;
}

/**
 * Performs structured compaction on historical messages.
 */
export async function compactSessionMessages(
  messages: MessageToCompact[],
  existingSummary?: string,
  options: CompactionOptions = {}
): Promise<CompactionResult> {
  const budget = options.maxTokenBudget ?? 6000;
  const keepCount = Math.max(2, options.recentMessagesToKeep ?? 4);

  const prevTokenCount = estimateMessagesTokens(messages);
  if (!shouldCompact(messages, budget)) {
    return {
      compacted: false,
      previousTokenCount: prevTokenCount,
      newTokenCount: prevTokenCount,
      summary: existingSummary || "",
      compactedMessages: messages,
    };
  }

  // Split into messages to compact and messages to keep
  const splitIndex = Math.max(1, messages.length - keepCount);
  const toSummarize = messages.slice(0, splitIndex);
  const toKeep = messages.slice(splitIndex);

  let newSummary = "";
  if (options.customSummaryGenerator) {
    newSummary = await options.customSummaryGenerator(toSummarize);
  } else {
    // Built-in rule-based deterministic summary
    const highlights = toSummarize
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => {
        const snippet = m.content.slice(0, 120).replace(/\n/g, " ");
        return `[${m.role.toUpperCase()}]: ${snippet}${m.content.length > 120 ? "..." : ""}`;
      })
      .join("\n");
    newSummary = `${existingSummary ? existingSummary + "\n" : ""}=== 前序历史对话概要 ===\n${highlights}`;
  }

  const compactedMessages: MessageToCompact[] = [
    {
      role: "system",
      content: `【前序上下文摘要快照】\n${newSummary}`,
    },
    ...toKeep,
  ];

  const newTokenCount = estimateMessagesTokens(compactedMessages);

  return {
    compacted: true,
    previousTokenCount: prevTokenCount,
    newTokenCount,
    summary: newSummary,
    compactedMessages,
  };
}
