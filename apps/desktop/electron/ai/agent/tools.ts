import { getMessage, listAccounts, listAllMessages, searchMessagesFts } from "../../db";
import type { MessageRecord } from "../../mail/types";
import type { ToolDefinition } from "../complete";
import type {
  AgentProposalCalendarItem,
  AgentProposalInvoiceItem,
  AgentProposalItem,
  AgentProposalSplitItem,
} from "./types";

export type SearchMessageResult = {
  id: string;
  accountId: string;
  folderId: string;
  from: string;
  fromName?: string;
  subject: string;
  snippet: string;
  dateMs: number;
  dateLabel: string;
  unread: boolean;
  split: "important" | "other";
  html?: string;
};

/**
 * Searches local messages across all accounts or a specific account.
 */
export function toolSearchMessages(
  query: string,
  accountId?: string,
  providedMessages?: MessageRecord[]
): SearchMessageResult[] {
  let allMessages: MessageRecord[] = [];

  if (providedMessages) {
    allMessages = providedMessages;
  } else {
    try {
      const accounts = accountId ? [{ id: accountId }] : listAccounts();
      for (const acc of accounts) {
        const msgs = listAllMessages(acc.id);
        allMessages.push(...msgs);
      }
    } catch {
      // If DB is uninitialized or in a standalone context, safely fallback to empty
      allMessages = [];
    }
  }

  const raw = query.trim().toLowerCase();
  if (!raw) {
    return allMessages.map(toSearchResult);
  }

  const terms = raw.split(/\s+/).filter(Boolean);

  const matched = allMessages.filter((m) => {
    const fromText = `${m.from} ${m.fromName ?? ""}`.toLowerCase();
    const subText = m.subject.toLowerCase();
    const bodyText = `${m.snippet ?? ""} ${m.html ?? ""}`.toLowerCase();

    return terms.every(
      (term) => subText.includes(term) || fromText.includes(term) || bodyText.includes(term)
    );
  });

  return matched.map(toSearchResult);
}

function toSearchResult(m: MessageRecord): SearchMessageResult {
  return {
    id: m.id,
    accountId: m.accountId,
    folderId: m.folderId,
    from: m.from,
    fromName: m.fromName,
    subject: m.subject,
    snippet: m.snippet,
    dateMs: m.dateMs,
    dateLabel: m.dateLabel,
    unread: m.unread,
    split: m.split,
    html: m.html,
  };
}

/**
 * Generates an RFC 5545 .ics iCalendar file content string.
 */
export function generateIcsContent(event: {
  title: string;
  startTime: string;
  endTime?: string;
  location?: string;
  attendees?: string[];
  description?: string;
}): string {
  const uid = `evt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}@oh-ai-email`;

  const formatIcsDate = (dStr: string): string => {
    const d = new Date(dStr);
    if (!isNaN(d.getTime())) {
      return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    }
    const clean = dStr.replace(/[-:]/g, "").replace(/\s+/g, "T");
    if (clean.length >= 8) {
      return clean.endsWith("Z") ? clean : clean + "Z";
    }
    return new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  };

  const dtStart = formatIcsDate(event.startTime);
  let dtEnd = event.endTime ? formatIcsDate(event.endTime) : "";
  if (!dtEnd) {
    const startDate = new Date(event.startTime);
    if (!isNaN(startDate.getTime())) {
      const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
      dtEnd = endDate.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    } else {
      dtEnd = dtStart;
    }
  }

  const escapeIcs = (str: string) =>
    str.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//oh-ai-email//Agent Calendar Extractor//CN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${formatIcsDate(new Date().toISOString())}`,
    `SUMMARY:${escapeIcs(event.title || "日程安排")}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
  ];

  if (event.location) {
    lines.push(`LOCATION:${escapeIcs(event.location)}`);
  }
  if (event.description) {
    lines.push(`DESCRIPTION:${escapeIcs(event.description)}`);
  }
  if (event.attendees && event.attendees.length > 0) {
    for (const attendee of event.attendees) {
      const trimmed = attendee.trim();
      if (trimmed) {
        lines.push(`ATTENDEE;CN=${escapeIcs(trimmed)}:mailto:${escapeIcs(trimmed)}`);
      }
    }
  }

  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.join("\r\n");
}

/**
 * Extracts meeting details and produces a structured calendar proposal item with valid .ics.
 */
export function toolExtractMeetingDetails(
  subject?: string,
  body?: string,
  inferredDetails?: {
    title?: string;
    startTime?: string;
    endTime?: string;
    location?: string;
    attendees?: string[];
  }
): AgentProposalCalendarItem | null {
  const fullText = `${subject ?? ""} ${body ?? ""}`.trim();
  if (!fullText && !inferredDetails) {
    return null;
  }

  const title =
    inferredDetails?.title || subject?.replace(/^(re|fwd|回复|转发)[:：]\s*/i, "") || "会议日程";

  let startTime = inferredDetails?.startTime;
  if (!startTime) {
    const isoMatch = fullText.match(/\d{4}-\d{2}-\d{2}(?:[T\s]\d{2}:\d{2}(?::\d{2})?)?/);
    if (isoMatch) {
      startTime = isoMatch[0].replace(" ", "T");
    } else {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(10, 0, 0, 0);
      startTime = tomorrow.toISOString();
    }
  }

  let endTime = inferredDetails?.endTime;
  if (!endTime) {
    const startObj = new Date(startTime);
    if (!isNaN(startObj.getTime())) {
      const endObj = new Date(startObj.getTime() + 60 * 60 * 1000);
      endTime = endObj.toISOString();
    }
  }

  const location =
    inferredDetails?.location ??
    (fullText.includes("腾讯会议")
      ? "腾讯会议"
      : fullText.includes("Zoom")
        ? "Zoom"
        : fullText.includes("Teams")
          ? "Microsoft Teams"
          : undefined);

  // Extract potential emails from body if attendees not provided
  let attendees = inferredDetails?.attendees;
  if (!attendees || attendees.length === 0) {
    const emailMatches = fullText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
    if (emailMatches) {
      attendees = Array.from(new Set(emailMatches)).slice(0, 5);
    }
  }

  const icsContent = generateIcsContent({
    title,
    startTime,
    endTime,
    location,
    attendees,
    description: body ? body.slice(0, 500) : undefined,
  });

  return {
    id: `prop_cal_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    kind: "calendar_event",
    title,
    startTime,
    endTime,
    location,
    attendees,
    icsContent,
    selected: true,
  };
}

/**
 * Extracts invoice and financial reimbursement details from email content.
 */
export function toolExtractInvoiceDetails(
  subject = "",
  body = "",
  from = ""
): AgentProposalInvoiceItem | null {
  const fullText = `${subject} ${body}`;
  if (!fullText.trim()) return null;

  // Extract amount
  let amount = 0;
  let currency = "CNY";

  const amountMatch =
    fullText.match(/(?:金额|合计|总额|amount|total)[:：\s]*[¥$€]?\s*([0-9]+(?:\.[0-9]{1,2})?)/i) ||
    fullText.match(/[¥￥$€]\s*([0-9]+(?:\.[0-9]{1,2})?)/) ||
    fullText.match(/([0-9]+(?:\.[0-9]{1,2})?)\s*(?:CNY|RMB|USD|EUR|元)/i);

  if (amountMatch && amountMatch[1]) {
    amount = parseFloat(amountMatch[1]);
  }

  if (fullText.includes("USD") || fullText.includes("$")) {
    currency = "USD";
  } else if (fullText.includes("EUR") || fullText.includes("€")) {
    currency = "EUR";
  }

  // Extract vendor
  let vendorName = from.split("<")[0].trim().replace(/["']/g, "");
  if (!vendorName || vendorName.includes("@")) {
    const vendorMatch = subject.match(/(?:【([^】]+)】|\[([^\]]+)\])/);
    vendorName = vendorMatch ? (vendorMatch[1] || vendorMatch[2]) : (from.split("@")[0] || "开票方");
  }

  // Determine category
  let category = "商务与日常办公";
  if (/(?:云|服务器|aliyun|aws|tencent|腾讯云|azure)/i.test(fullText)) {
    category = "云服务与基础设施";
  } else if (/(?:差旅|机票|酒店|打车|滴滴|高铁|客运)/i.test(fullText)) {
    category = "差旅交通";
  } else if (/(?:餐饮|外卖|餐费|聚餐)/i.test(fullText)) {
    category = "商务餐饮";
  } else if (/(?:软件|订阅|saas|github|jetbrains)/i.test(fullText)) {
    category = "软件服务与订阅";
  }

  return {
    id: `prop_inv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    kind: "invoice_entry",
    vendorName,
    amount,
    currency,
    category,
    date: new Date().toISOString().slice(0, 10),
    selected: true,
  };
}

/**
 * Extracts triage suggestions for a batch of messages.
 */
export function toolExtractTriageSuggestions(
  messages: { id: string; subject: string; from: string; body: string }[]
): AgentProposalSplitItem[] {
  const suggestions: AgentProposalSplitItem[] = [];

  for (const msg of messages) {
    const text = `${msg.subject} ${msg.from} ${msg.body}`.toLowerCase();

    // Check low-priority / spam / newsletter indicators
    const isOther =
      text.includes("unsubscribe") ||
      text.includes("退订") ||
      text.includes("no-reply") ||
      text.includes("noreply") ||
      text.includes("newsletter") ||
      text.includes("marketing") ||
      text.includes("推广") ||
      text.includes("账单") ||
      text.includes("广告") ||
      text.includes("通知") ||
      text.includes("notification") ||
      text.includes("digest");

    const isUrgent =
      text.includes("urgent") ||
      text.includes("紧急") ||
      text.includes("尽快") ||
      text.includes("asap") ||
      text.includes("审批") ||
      text.includes("action required") ||
      text.includes("review needed") ||
      text.includes("重要通知");

    let targetSplit: "important" | "other" = isOther && !isUrgent ? "other" : "important";
    let reason = "";

    if (isUrgent) {
      targetSplit = "important";
      reason = "包含紧急/待办行动项或直接沟通请求，建议设为重要";
    } else if (isOther) {
      targetSplit = "other";
      reason = "检测到系统通知/订阅推广或自动邮件，建议移至其他";
    } else {
      targetSplit = "important";
      reason = "来自工作联系人的直接往来邮件，建议保持在重要";
    }

    suggestions.push({
      id: `prop_split_${msg.id}_${Math.random().toString(36).slice(2, 6)}`,
      kind: "split_change",
      messageId: msg.id,
      subject: msg.subject || "无主题",
      targetSplit,
      reason,
      selected: true,
    });
  }

  return suggestions;
}

export type CommitmentItem = {
  direction: "i_promised" | "they_promised";
  text: string;
  deadline?: string;
};

export type ExtractCommitmentsResult = {
  commitments: CommitmentItem[];
};

/**
 * Extracts commitments (what I promised vs what they promised) and deadlines from email text.
 */
export function toolExtractCommitments(subject = "", body = ""): ExtractCommitmentsResult {
  const fullText = `${subject}\n${body}`.trim();
  if (!fullText) {
    return { commitments: [] };
  }

  const rawSentences = fullText
    .split(/[。！？\n.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 4);

  const commitments: CommitmentItem[] = [];
  const seen = new Set<string>();

  const deadlineRegex =
    /(?:(?:(?:本周|下周|周|星期)[一二三四五六日天](?:前|下午\d*点?|上午\d*点?|晚上|中午)?)|(?:\d{1,2}月\d{1,2}[号日](?:前)?)|(?:\d{4}-\d{2}-\d{2})|明天(?:前|下午\d*点?|上午\d*点?|晚上|中午)?|后天|今晚|下周|月底|周五前|截止[：:]?\s*[^，。]+|by\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|next week|\d{1,2}(?:st|nd|rd|th)?\s+[a-zA-Z]+|\d{4}-\d{2}-\d{2}))/i;

  const iPromisedPatterns = [
    /我(?:会|将|稍后|承诺|打算|负责|去办|来安排|会在)/i,
    /我们(?:会|将|承诺|稍后|来)/i,
    /我方(?:会|将|承诺|确认)/i,
    /I\s+will|I'll|I\s+promise|We\s+will|We'll|I\s+am\s+going\s+to|I\s+shall/i,
  ];

  const theyPromisedPatterns = [
    /你(?:说|提到|承诺|会|将|答应|负责|需要在)/i,
    /您(?:提到|承诺|会|将|答应|负责|请在|需要在)/i,
    /对方(?:承诺|答应|会|将)/i,
    /贵方(?:承诺|会|将)/i,
    /请于|请在|务必在|请于.*前/i,
    /You\s+promised|You\s+mentioned|You\s+will|Please\s+provide|Please\s+send/i,
  ];

  for (const s of rawSentences) {
    const isIPromised = iPromisedPatterns.some((p) => p.test(s));
    const isTheyPromised = !isIPromised && theyPromisedPatterns.some((p) => p.test(s));

    if (isIPromised || isTheyPromised) {
      const deadlineMatch = s.match(deadlineRegex);
      const deadline = deadlineMatch ? deadlineMatch[0].trim() : undefined;
      const direction: "i_promised" | "they_promised" = isIPromised
        ? "i_promised"
        : "they_promised";
      const key = `${direction}_${s}`;
      if (!seen.has(key)) {
        seen.add(key);
        commitments.push({
          direction,
          text: s,
          deadline,
        });
      }
    }
  }

  return { commitments };
}

/**
 * Standard OpenAI Function Calling Tool Definitions for Agentic Workflows.
 */
export const AGENT_TOOLS: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "search_messages",
      description:
        "Search local emails in the user's mailbox by keywords, sender, subject, date, unread status, or full text.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Keyword or search terms (e.g., '发票', '周报', '合同', sender name or email)",
          },
          limit: {
            type: "number",
            description: "Maximum number of email results to return (default 8, max 30)",
          },
          unreadOnly: {
            type: "boolean",
            description: "Filter only unread emails if true",
          },
          split: {
            type: "string",
            description: "Filter by split category ('important' or 'other')",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_message_context",
      description:
        "Retrieve the full body text, headers, and metadata of a specific email message by its messageId.",
      parameters: {
        type: "object",
        properties: {
          messageId: {
            type: "string",
            description: "The unique ID of the message to inspect",
          },
        },
        required: ["messageId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_unread_summary",
      description: "Retrieve a list and overview of recent unread emails across all active accounts in the inbox.",
      parameters: {
        type: "object",
        properties: {
          limit: {
            type: "number",
            description: "Maximum number of unread emails to retrieve (default 10)",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_recent_messages",
      description: "Retrieve the most recent received or sent emails to understand current context or daily briefing.",
      parameters: {
        type: "object",
        properties: {
          limit: {
            type: "number",
            description: "Maximum number of recent emails (default 10)",
          },
        },
      },
    },
  },
];

/**
 * Retrieves full details of a specific message.
 */
export function toolGetMessageContext(messageId: string): Record<string, unknown> | null {
  try {
    const msg = getMessage(messageId);
    if (!msg) return null;
    return {
      id: msg.id,
      accountId: msg.accountId,
      subject: msg.subject,
      from: msg.from,
      fromName: msg.fromName,
      dateLabel: msg.dateLabel,
      dateMs: msg.dateMs,
      split: msg.split,
      unread: msg.unread,
      bodyText: msg.snippet || msg.subject,
      html: msg.html ? msg.html.slice(0, 3000) : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Retrieves recent unread messages across all accounts.
 */
export function toolGetUnreadSummary(limit = 10): SearchMessageResult[] {
  try {
    const accounts = listAccounts();
    const all: MessageRecord[] = [];
    for (const acc of accounts) {
      all.push(...listAllMessages(acc.id));
    }
    const unread = all.filter((m) => m.unread).sort((a, b) => b.dateMs - a.dateMs);
    return unread.slice(0, Math.min(limit, 30)).map(toSearchResult);
  } catch {
    return [];
  }
}

/**
 * Retrieves recent messages across all accounts.
 */
export function toolGetRecentMessages(limit = 10): SearchMessageResult[] {
  try {
    const accounts = listAccounts();
    const all: MessageRecord[] = [];
    for (const acc of accounts) {
      all.push(...listAllMessages(acc.id));
    }
    all.sort((a, b) => b.dateMs - a.dateMs);
    return all.slice(0, Math.min(limit, 30)).map(toSearchResult);
  } catch {
    return [];
  }
}

/**
 * Normalizes tool names to handle duplicates, prefixes or casing anomalies from various LLM providers.
 */
export function normalizeToolName(rawName: string): string {
  const clean = rawName
    .trim()
    .replace(/^functions?\./i, "")
    .replace(/^tools?[:.]/i, "");

  const knownTools = [
    "search_messages",
    "get_message_context",
    "get_unread_summary",
    "get_recent_messages",
  ];

  for (const k of knownTools) {
    if (clean === k || clean.startsWith(k) || clean.includes(k)) {
      return k;
    }
  }
  return clean;
}

/**
 * Unified Agent Tool Execution Engine.
 * Executes read-only email queries safely against local SQLite DB.
 */
export async function executeAgentTool(
  toolName: string,
  args: Record<string, unknown>
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  try {
    const normalized = normalizeToolName(toolName);
    switch (normalized) {
      case "search_messages": {
        const query = String(args.query || "");
        const limit = Math.min(Math.max(Number(args.limit || 8), 1), 30);
        let results = toolSearchMessages(query);

        if (args.unreadOnly) {
          results = results.filter((r) => r.unread);
        }
        if (args.split === "important" || args.split === "other") {
          results = results.filter((r) => r.split === args.split);
        }

        const trimmed = results.slice(0, limit).map((r) => ({
          id: r.id,
          subject: r.subject,
          from: r.from,
          fromName: r.fromName,
          dateLabel: r.dateLabel,
          snippet: r.snippet ? r.snippet.slice(0, 300) : "",
          split: r.split,
          unread: r.unread,
        }));

        return {
          success: true,
          data: {
            totalFound: results.length,
            messages: trimmed,
          },
        };
      }

      case "get_message_context": {
        const messageId = String(args.messageId || "");
        const context = toolGetMessageContext(messageId);
        if (!context) {
          return { success: false, error: `未找到 ID 为 ${messageId} 的邮件详情` };
        }
        return { success: true, data: context };
      }

      case "get_unread_summary": {
        const limit = Math.min(Math.max(Number(args.limit || 10), 1), 30);
        const unread = toolGetUnreadSummary(limit);
        return {
          success: true,
          data: {
            totalUnread: unread.length,
            messages: unread.map((r) => ({
              id: r.id,
              subject: r.subject,
              from: r.from,
              dateLabel: r.dateLabel,
              snippet: r.snippet ? r.snippet.slice(0, 200) : "",
            })),
          },
        };
      }

      case "get_recent_messages": {
        const limit = Math.min(Math.max(Number(args.limit || 10), 1), 30);
        const recents = toolGetRecentMessages(limit);
        return {
          success: true,
          data: {
            count: recents.length,
            messages: recents.map((r) => ({
              id: r.id,
              subject: r.subject,
              from: r.from,
              dateLabel: r.dateLabel,
              snippet: r.snippet ? r.snippet.slice(0, 200) : "",
            })),
          },
        };
      }

      default:
        return { success: false, error: `未知工具名称: ${toolName}` };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: `工具执行异常: ${msg}` };
  }
}

/**
 * Parses structured proposal items (split changes, calendar events, invoices, drafts)
 * emitted by the LLM in markdown JSON blocks or raw text structures, and merges/replaces
 * pre-populated items with the model's intelligent decisions.
 */
export function parseProposalItemsFromOutput(
  text: string,
  existingItems: AgentProposalItem[]
): AgentProposalItem[] {
  if (!text) return existingItems;

  let resultItems: AgentProposalItem[] = [...existingItems];

  // 1. Extract JSON code blocks or raw JSON object/arrays
  const jsonBlocks: Record<string, unknown>[] = [];
  const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/gi;
  let match: RegExpExecArray | null;
  while ((match = codeBlockRegex.exec(text)) !== null) {
    const raw = match[1].trim();
    if ((raw.startsWith("{") && raw.endsWith("}")) || (raw.startsWith("[") && raw.endsWith("]"))) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          jsonBlocks.push(parsed);
        }
      } catch {
        // ignore invalid json in code block
      }
    }
  }

  if (jsonBlocks.length === 0) {
    // Try finding JSON object containing split_change in text directly
    const objMatch = text.match(/\{[\s\S]*"split_change"[\s\S]*\}/);
    if (objMatch) {
      try {
        const parsed = JSON.parse(objMatch[0]);
        if (parsed && typeof parsed === "object") {
          jsonBlocks.push(parsed);
        }
      } catch {
        // ignore
      }
    }
  }

  for (const block of jsonBlocks) {
    if (!block || typeof block !== "object") continue;

    // A. Parse split_change
    const blockRec = block as Record<string, unknown>;
    const splitArr = Array.isArray(block)
      ? block
      : Array.isArray(blockRec.split_change)
        ? blockRec.split_change
        : Array.isArray(blockRec.split_changes)
          ? blockRec.split_changes
          : Array.isArray(blockRec.splits)
            ? blockRec.splits
            : Array.isArray(blockRec.split_proposals)
              ? blockRec.split_proposals
              : null;

    if (splitArr && splitArr.length > 0) {
      const parsedSplits: AgentProposalSplitItem[] = [];
      for (const item of splitArr) {
        if (!item || typeof item !== "object") continue;
        const i = item as Record<string, unknown>;
        const msgId = String(i.message_id || i.messageId || i.id || "");
        const rawSplit = String(
          i.new_split || i.target_split || i.split || i.targetSplit || ""
        ).toLowerCase();
        const targetSplit: "important" | "other" =
          rawSplit.includes("other") ||
          rawSplit.includes("其它") ||
          rawSplit.includes("其他") ||
          rawSplit === "low" ||
          rawSplit === "低"
            ? "other"
            : "important";
        const reason = String(i.reason || i.rationale || i.explanation || "智能分箱分析");
        const subject = String(i.subject || "");

        parsedSplits.push({
          id: `prop_split_${msgId || Math.random().toString(36).slice(2, 7)}`,
          kind: "split_change",
          messageId: msgId,
          subject,
          targetSplit,
          reason,
          selected: true,
        });
      }

      if (parsedSplits.length > 0) {
        // If existing items has split_change items, update / replace them
        const existingSplitItems = existingItems.filter((e) => e.kind === "split_change");
        const updated = parsedSplits.map((ps, idx) => {
          const matched = existingItems.find(
            (e) =>
              e.kind === "split_change" &&
              ((ps.messageId && e.messageId === ps.messageId) ||
                (ps.subject &&
                  e.subject &&
                  (e.subject.includes(ps.subject) || ps.subject.includes(e.subject))))
          );
          if (matched && matched.kind === "split_change") {
            return {
              ...matched,
              targetSplit: ps.targetSplit,
              reason: ps.reason || matched.reason,
              subject: ps.subject || matched.subject,
            };
          }
          if (existingSplitItems[idx] && existingSplitItems[idx].kind === "split_change") {
            const fallback = existingSplitItems[idx] as AgentProposalSplitItem;
            return {
              ...fallback,
              targetSplit: ps.targetSplit,
              reason: ps.reason || fallback.reason,
              subject: ps.subject || fallback.subject,
            };
          }
          return ps;
        });

        const nonSplit = resultItems.filter((i) => i.kind !== "split_change");
        resultItems = [...nonSplit, ...updated];
      }
    }
  }

  return resultItems;
}


