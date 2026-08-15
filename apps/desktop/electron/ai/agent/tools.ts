import { listAccounts, listAllMessages } from "../../db";
import type { MessageRecord } from "../../mail/types";
import type {
  AgentProposalCalendarItem,
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
  providedMessages?: MessageRecord[],
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
      (term) =>
        subText.includes(term) ||
        fromText.includes(term) ||
        bodyText.includes(term),
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
  },
): AgentProposalCalendarItem | null {
  const fullText = `${subject ?? ""} ${body ?? ""}`.trim();
  if (!fullText && !inferredDetails) {
    return null;
  }

  const title =
    inferredDetails?.title ||
    subject?.replace(/^(re|fwd|回复|转发)[:：]\s*/i, "") ||
    "会议日程";

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

  const location = inferredDetails?.location ?? (fullText.includes("腾讯会议") ? "腾讯会议" : fullText.includes("Zoom") ? "Zoom" : fullText.includes("Teams") ? "Microsoft Teams" : undefined);
  
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
 * Extracts triage suggestions for a batch of messages.
 */
export function toolExtractTriageSuggestions(
  messages: { id: string; subject: string; from: string; body: string }[],
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
export function toolExtractCommitments(
  subject = "",
  body = "",
): ExtractCommitmentsResult {
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
      const direction: "i_promised" | "they_promised" = isIPromised ? "i_promised" : "they_promised";
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

