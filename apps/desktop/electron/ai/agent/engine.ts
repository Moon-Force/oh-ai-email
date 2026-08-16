import { chatComplete } from "../complete";
import { cleanContext } from "../clean";
import type {
  AgentDoneEvent,
  AgentErrorEvent,
  AgentProposalCalendarItem,
  AgentProposalData,
  AgentProposalDraftItem,
  AgentProposalEvent,
  AgentProposalItem,
  AgentProposalSplitItem,
  AgentRunParams,
  AgentStepEvent,
  AgentStreamEvent,
  AgentTokenEvent,
  AgentType,
} from "./types";
import {
  generateIcsContent,
  toolExtractCommitments,
  toolExtractMeetingDetails,
  toolExtractTriageSuggestions,
  toolSearchMessages,
} from "./tools";

const activeAgentControllers = new Map<string, AbortController>();

export function abortAgentWorkflow(requestId: string): boolean {
  const controller = activeAgentControllers.get(requestId);
  if (controller) {
    controller.abort();
    activeAgentControllers.delete(requestId);
    return true;
  }
  return false;
}

export function isAgentWorkflowRunning(requestId: string): boolean {
  return activeAgentControllers.has(requestId);
}

function emitStreamTokens(text: string, onEvent: (evt: AgentStreamEvent) => void, chunkSize = 20) {
  for (let i = 0; i < text.length; i += chunkSize) {
    const chunk = text.slice(i, i + chunkSize);
    onEvent({ type: "token", textChunk: chunk });
  }
}

export async function runAgentWorkflow(
  params: AgentRunParams & {
    onEvent: (evt: AgentStreamEvent) => void;
  }
): Promise<AgentProposalData> {
  const { agentType, prompt = "", context = {}, requestId, onEvent } = params;

  const controller = new AbortController();
  const reqId = requestId || `agent_req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  activeAgentControllers.set(reqId, controller);

  const checkAborted = () => {
    if (controller.signal.aborted) {
      const err = new Error("已取消 Agent 任务");
      err.name = "AbortError";
      throw err;
    }
  };

  try {
    // ── Step 1: Planning ──────────────────────────────────────────
    checkAborted();
    onEvent({
      type: "step",
      stepIndex: 1,
      totalSteps: 3,
      message: `正在规划 [${getAgentTypeLabel(agentType)}] 任务并检索上下文...`,
    });
    emitStreamTokens(`>>> 开始执行工作流: ${getAgentTypeLabel(agentType)}\n`, onEvent);

    // Context resolution
    const contextSubject = typeof context.subject === "string" ? context.subject : "";
    const contextFrom = typeof context.from === "string" ? context.from : "";
    const contextBody = typeof context.body === "string" ? context.body : "";
    const contextMessageId = typeof context.messageId === "string" ? context.messageId : "";

    // ── Step 2: Tool Execution ────────────────────────────────────
    checkAborted();
    onEvent({
      type: "step",
      stepIndex: 2,
      totalSteps: 3,
      message: "正在调用检索与提取工具收集结构化数据...",
    });

    let toolDataSummary = "";
    let proposedItems: AgentProposalItem[] = [];

    if (agentType === "meeting_extractor") {
      emitStreamTokens(`[工具] 正在提取会议日程与参会详情...\n`, onEvent);
      const calItem = toolExtractMeetingDetails(contextSubject, contextBody, {
        title: typeof context.title === "string" ? context.title : undefined,
        startTime: typeof context.startTime === "string" ? context.startTime : undefined,
        endTime: typeof context.endTime === "string" ? context.endTime : undefined,
        location: typeof context.location === "string" ? context.location : undefined,
      });

      if (calItem) {
        proposedItems.push(calItem);
        toolDataSummary += `已提取日程：${calItem.title}（时间：${calItem.startTime}，地点：${calItem.location || "线上"}）\n`;
      }

      if (contextFrom) {
        proposedItems.push({
          id: `prop_draft_confirm_${Date.now()}`,
          kind: "draft_reply",
          targetTo: contextFrom,
          subject: contextSubject ? `Re: ${contextSubject}` : "会议确认",
          body: `您好，\n\n已收到关于「${calItem?.title || contextSubject || "会议"}」的通知并已添加到日历，届时将准时参加。\n\n顺祝商祺！`,
          selected: true,
        });
      }
    } else if (agentType === "batch_triage") {
      emitStreamTokens(`[工具] 正在检索近期邮件进行智能分箱评估...\n`, onEvent);
      const searchResults = toolSearchMessages("", undefined);
      const candidateList = searchResults.slice(0, 15).map((m) => ({
        id: m.id,
        subject: m.subject,
        from: m.from,
        body: m.snippet,
      }));

      const triageItems = toolExtractTriageSuggestions(candidateList);
      proposedItems.push(...triageItems);
      toolDataSummary += `已分析 ${triageItems.length} 封邮件的分箱归类建议。\n`;
    } else if (agentType === "followup_sequence") {
      emitStreamTokens(`[工具] 正在检索待跟进邮件与沟通线索...\n`, onEvent);
      const searchResults = toolSearchMessages("", undefined);
      const targetMessages = searchResults
        .filter((m) => m.unread || m.split === "important")
        .slice(0, 5);

      if (targetMessages.length > 0) {
        for (const msg of targetMessages) {
          const { commitments } = toolExtractCommitments(msg.subject, msg.snippet);
          let contextNote = "";
          if (commitments.length > 0) {
            const first = commitments[0];
            contextNote = `（涉及承诺事项：${first.text}${first.deadline ? `，截止: ${first.deadline}` : ""}）\n\n`;
          }

          proposedItems.push({
            id: `prop_draft_followup_${msg.id}`,
            kind: "draft_reply",
            targetTo: msg.from,
            subject: `Re: ${msg.subject}`,
            body: `您好，\n\n关于此前沟通的「${msg.subject}」在此跟进确认最新进展。${contextNote}如有任何需要协助或补充的信息，请随时告知。\n\n顺祝商祺！`,
            selected: true,
          });
        }
        toolDataSummary += `已为 ${targetMessages.length} 封重要往来邮件生成跟进回复草稿。\n`;
      } else if (contextFrom || contextSubject) {
        const { commitments } = toolExtractCommitments(contextSubject, contextBody);
        let note = "";
        if (commitments.length > 0) {
          note = `（涉及事项：${commitments[0].text}）\n\n`;
        }

        proposedItems.push({
          id: `prop_draft_followup_ctx_${Date.now()}`,
          kind: "draft_reply",
          targetTo: contextFrom || "recipient@example.com",
          subject: contextSubject ? `Re: ${contextSubject}` : "跟进：项目进展",
          body: `您好，\n\n关于「${contextSubject || "此前讨论事宜"}」在此跟进最新进展。${note}若有需要协助的地方请随时告知。\n\n顺祝安好！`,
          selected: true,
        });
      }
    } else if (agentType === "daily_briefing") {
      emitStreamTokens(`[工具] 正在汇聚今日待办、重要邮件与日程...\n`, onEvent);
      const allMsgs = toolSearchMessages("", undefined);
      const importantUnread = allMsgs.filter((m) => m.unread && m.split === "important");
      const generalUnread = allMsgs.filter((m) => m.unread);

      // Extract top 3 urgent topics
      const topUrgent = (importantUnread.length > 0 ? importantUnread : generalUnread).slice(0, 3);
      const urgentSummaries = topUrgent.map(
        (m, i) => `${i + 1}. [${m.fromName || m.from}] ${m.subject}`
      );

      toolDataSummary += `今日待处理：共 ${generalUnread.length} 封未读邮件（其中 ${importantUnread.length} 封重要）。\n`;
      if (urgentSummaries.length > 0) {
        toolDataSummary += `今日 Top 3 紧急焦点：\n${urgentSummaries.join("\n")}\n`;
      }

      // Generate draft proposals for the top urgent items
      for (const item of topUrgent) {
        const { commitments } = toolExtractCommitments(item.subject, item.snippet);
        let commitText = "";
        if (commitments.length > 0) {
          commitText = `对于您提到的「${commitments[0].text}」，我方已在同步跟进。`;
        }
        proposedItems.push({
          id: `prop_draft_briefing_${item.id}`,
          kind: "draft_reply",
          targetTo: item.from,
          subject: `Re: ${item.subject}`,
          body: `您好，\n\n邮件已收悉，正在处理「${item.subject}」。${commitText}\n\n如有进一步进展将及时与您同步，谢谢！`,
          selected: true,
        });
      }

      // Add a briefing calendar event item
      const cal = toolExtractMeetingDetails(
        "今日工作规划与任务复盘",
        "今日晨报梳理：重点处理 " + topUrgent.map((m) => m.subject).join("、 "),
        {
          title: "今日工作规划与任务复盘",
        }
      );
      if (cal) proposedItems.push(cal);
    } else {
      // custom agent
      emitStreamTokens(
        `[工具] 正在根据提示词「${prompt.slice(0, 30)}」检索并提取上下文...\n`,
        onEvent
      );
      const searchResults = toolSearchMessages(prompt, undefined);
      toolDataSummary += `根据查询匹配到 ${searchResults.length} 封相关邮件。\n`;

      if (searchResults.length > 0) {
        const top = searchResults[0];
        proposedItems.push({
          id: `prop_draft_custom_${top.id}`,
          kind: "draft_reply",
          targetTo: top.from,
          subject: `Re: ${top.subject}`,
          body: `您好，\n\n关于「${top.subject}」已处理完成。\n\n顺祝商祺！`,
          selected: true,
        });
      }
    }

    // ── Step 3: Proposal Generation via LLM ───────────────────────
    checkAborted();
    onEvent({
      type: "step",
      stepIndex: 3,
      totalSteps: 3,
      message: "正在调用 AI 大模型整合分析并生成结构化提议...",
    });

    const systemPrompt = `You are the oh-ai-email Intelligent Agent Copilot.
Your job is to analyze the email workflow context and user request, then output a structured JSON response.
Rules:
1. NEVER automatically send emails or execute irreversible destructive actions.
2. Produce actionable proposals (e.g. calendar_event, draft_reply, split_change) that the user can review and select.
3. Return valid JSON adhering to this schema:
{
  "title": "Short title of the proposal",
  "summary": "Concise summary of findings and proposed actions in Chinese",
  "items": [
    {
      "id": "unique_string",
      "kind": "calendar_event" | "draft_reply" | "split_change",
      "title": "...", // if calendar_event
      "startTime": "YYYY-MM-DDTHH:mm:ssZ", // if calendar_event
      "endTime": "...", // optional if calendar_event
      "location": "...", // optional if calendar_event
      "attendees": ["email@example.com"], // optional if calendar_event
      "targetTo": "...", // if draft_reply
      "subject": "...", // if draft_reply or split_change
      "body": "...", // if draft_reply
      "messageId": "...", // if split_change
      "targetSplit": "important" | "other", // if split_change
      "reason": "...", // if split_change
      "selected": true
    }
  ]
}`;

    const userPromptContent = `Workflow Type: ${agentType}
User Prompt: ${prompt || "自动执行该类型标准工作流"}
Context Details:
Subject: ${contextSubject}
From: ${contextFrom}
Body: ${cleanContext(contextBody, 2000)}
Tool Extracted Data:
${toolDataSummary}
Existing Items Prepared:
${JSON.stringify(proposedItems, null, 2)}

Please review and output the final structured proposals in JSON format.`;

    let llmResultText = "";
    try {
      const llmRes = await chatComplete(
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPromptContent },
        ],
        { requestId: reqId }
      );

      if (llmRes.ok) {
        llmResultText = llmRes.text;
        emitStreamTokens(`\n[模型推理完成]\n${llmResultText}\n`, onEvent);
      }
    } catch {
      // If LLM call fails (e.g. no api key in test environment), fallback smoothly
      emitStreamTokens(`\n[已基于本地规则引擎完成提议组装]\n`, onEvent);
    }

    checkAborted();

    // Parse LLM response or fallback to tool-generated proposals
    const proposalData = parseLlmProposalResult(
      llmResultText,
      agentType,
      toolDataSummary,
      proposedItems
    );

    // Final events
    onEvent({ type: "proposal", data: proposalData });
    onEvent({ type: "done", summary: proposalData.summary });

    return proposalData;
  } catch (error) {
    const isAbort =
      controller.signal.aborted ||
      (error instanceof Error && (error.name === "AbortError" || error.message.includes("已取消")));

    const errorEvent: AgentErrorEvent = {
      type: "error",
      code: isAbort ? "ABORTED" : "WORKFLOW_ERROR",
      message: isAbort
        ? "已取消 Agent 任务"
        : error instanceof Error
          ? error.message
          : String(error),
    };

    onEvent(errorEvent);
    throw error;
  } finally {
    activeAgentControllers.delete(reqId);
  }
}

function getAgentTypeLabel(agentType: AgentType): string {
  switch (agentType) {
    case "daily_briefing":
      return "每日邮件简报与待办梳理";
    case "meeting_extractor":
      return "会议日程提取与 ICS 生成";
    case "batch_triage":
      return "批量分箱智能评估";
    case "followup_sequence":
      return "待跟进邮件梳理与回复草稿";
    case "custom":
      return "自定义智能助理工作流";
    default:
      return "智能工作流";
  }
}

function parseLlmProposalResult(
  rawText: string,
  agentType: AgentType,
  toolDataSummary: string,
  fallbackItems: AgentProposalItem[]
): AgentProposalData {
  const defaultTitle = `${getAgentTypeLabel(agentType)}结果`;
  const defaultSummary =
    toolDataSummary.trim() ||
    `已成功运行「${getAgentTypeLabel(agentType)}」，生成 ${fallbackItems.length} 项待审阅操作。`;

  if (!rawText.trim()) {
    return {
      title: defaultTitle,
      summary: defaultSummary,
      items: fallbackItems,
    };
  }

  try {
    let clean = rawText.trim();
    if (clean.startsWith("```")) {
      clean = clean
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/, "")
        .trim();
    }
    const jsonMatch = clean.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      clean = jsonMatch[0];
    }
    const parsed = JSON.parse(clean) as {
      title?: string;
      summary?: string;
      items?: Array<Record<string, unknown>>;
    };

    const title =
      typeof parsed.title === "string" && parsed.title.trim() ? parsed.title.trim() : defaultTitle;
    const summary =
      typeof parsed.summary === "string" && parsed.summary.trim()
        ? parsed.summary.trim()
        : defaultSummary;

    const parsedItems: AgentProposalItem[] = [];

    if (Array.isArray(parsed.items) && parsed.items.length > 0) {
      for (const item of parsed.items) {
        const kind = item.kind;
        const id =
          typeof item.id === "string" && item.id.trim()
            ? item.id.trim()
            : `item_${Math.random().toString(36).slice(2, 8)}`;
        const selected = item.selected !== false;

        if (kind === "calendar_event") {
          const itemTitle = typeof item.title === "string" ? item.title : "日程安排";
          const startTime =
            typeof item.startTime === "string" ? item.startTime : new Date().toISOString();
          const endTime = typeof item.endTime === "string" ? item.endTime : undefined;
          const location = typeof item.location === "string" ? item.location : undefined;
          const attendees = Array.isArray(item.attendees) ? item.attendees.map(String) : undefined;
          const icsContent =
            typeof item.icsContent === "string" && item.icsContent.trim()
              ? item.icsContent
              : generateIcsContent({ title: itemTitle, startTime, endTime, location, attendees });

          parsedItems.push({
            id,
            kind: "calendar_event",
            title: itemTitle,
            startTime,
            endTime,
            location,
            attendees,
            icsContent,
            selected,
          });
        } else if (kind === "draft_reply") {
          parsedItems.push({
            id,
            kind: "draft_reply",
            targetTo: typeof item.targetTo === "string" ? item.targetTo : "",
            subject: typeof item.subject === "string" ? item.subject : "回复邮件",
            body: typeof item.body === "string" ? item.body : "",
            selected,
          });
        } else if (kind === "split_change") {
          parsedItems.push({
            id,
            kind: "split_change",
            messageId: typeof item.messageId === "string" ? item.messageId : "",
            subject: typeof item.subject === "string" ? item.subject : "",
            targetSplit:
              item.targetSplit === "important" || item.targetSplit === "other"
                ? item.targetSplit
                : "important",
            reason: typeof item.reason === "string" ? item.reason : "建议调整分箱",
            selected,
          });
        }
      }
    }

    return {
      title,
      summary,
      items: parsedItems.length > 0 ? parsedItems : fallbackItems,
      rawResult: rawText,
    };
  } catch {
    return {
      title: defaultTitle,
      summary: defaultSummary,
      items: fallbackItems,
      rawResult: rawText,
    };
  }
}
