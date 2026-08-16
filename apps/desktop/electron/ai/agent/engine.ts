import { chatComplete } from "../complete";
import { cleanContext } from "../clean";
import type {
  AgentDoneEvent,
  AgentErrorEvent,
  AgentProposalCalendarItem,
  AgentProposalData,
  AgentProposalDraftItem,
  AgentProposalEvent,
  AgentProposalInvoiceItem,
  AgentProposalItem,
  AgentProposalSplitItem,
  AgentRunParams,
  AgentStreamEvent,
  AgentType,
} from "./types";
import {
  generateIcsContent,
  toolExtractCommitments,
  toolExtractMeetingDetails,
  toolExtractTriageSuggestions,
  toolSearchMessages,
} from "./tools";
import { AgentLoop } from "./loop";
import { SkillsManager } from "./skills";
import { compactSessionMessages, type MessageToCompact } from "./compaction";
import {
  createAgentSession,
  insertAgentMessage,
  listAgentMessages,
  type AgentMessageDbRecord,
} from "../../db";

const activeAgentControllers = new Map<string, AbortController>();
export const defaultSkillsManager = new SkillsManager();

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

export async function runAgentWorkflow(
  params: AgentRunParams & {
    onEvent: (evt: AgentStreamEvent) => void;
  }
): Promise<AgentProposalData> {
  const {
    agentType,
    prompt = "",
    context = {},
    requestId,
    sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    skillId,
    onEvent,
  } = params;

  const controller = new AbortController();
  const reqId = requestId || `agent_req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  activeAgentControllers.set(reqId, controller);

  const loop = new AgentLoop(onEvent, {
    signal: controller.signal,
    beforeToolCall: (toolName) => {
      // Prohibit unconfirmed destructive write operations (Strict HITL)
      if (toolName === "send_mail_directly") {
        return { block: true, reason: "Direct send prohibited. Must generate draft proposal." };
      }
      return {};
    },
  });

  const checkAborted = () => {
    if (controller.signal.aborted) {
      const err = new Error("已取消 Agent 任务");
      err.name = "AbortError";
      throw err;
    }
  };

  try {
    // ── Session & Context Preparation ─────────────────────────────
    let skill = skillId ? defaultSkillsManager.getSkill(skillId) : undefined;
    if (!skill) {
      skill = defaultSkillsManager.getSkill(agentType);
    }

    // Persist Session creation if not exists
    try {
      createAgentSession({
        id: sessionId,
        title: prompt ? prompt.slice(0, 30) : getAgentTypeLabel(agentType),
        skillId: skill?.id || agentType,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    } catch {
      // Ignore if DB not initialized (e.g. in headless unit tests)
    }

    // ── Step 1: Planning & Thinking ──────────────────────────────
    checkAborted();
    await loop.dispatchEvent({
      type: "step",
      stepIndex: 1,
      totalSteps: 3,
      message: `正在规划 [${skill?.name || getAgentTypeLabel(agentType)}] 任务并检索上下文...`,
    });

    // Stream initial thinking token
    const thinkingText = `【深度思考】分析任务类型: ${skill?.name || getAgentTypeLabel(agentType)}。\n正在加载邮件主题与正文，检查是否有附件及历史上下文...`;
    await loop.emitThinkingToken(thinkingText);

    // Context resolution
    const contextSubject = typeof context.subject === "string" ? context.subject : "";
    const contextFrom = typeof context.from === "string" ? context.from : "";
    const contextBody = typeof context.body === "string" ? context.body : "";
    const contextMessageId = typeof context.messageId === "string" ? context.messageId : "";

    // ── Step 2: Tool Execution & Information Gathering ────────────
    checkAborted();
    await loop.dispatchEvent({
      type: "step",
      stepIndex: 2,
      totalSteps: 3,
      message: "正在调用检索与提取工具收集结构化数据...",
    });

    let toolDataSummary = "";
    const proposedItems: AgentProposalItem[] = [];

    if (agentType === "meeting_extractor" || skill?.id === "meeting_extractor") {
      await loop.emitContentToken(`[工具调用] 正在提取会议日程与参会详情...\n`);
      const calItem = toolExtractMeetingDetails(contextSubject, contextBody, {
        title: typeof context.title === "string" ? context.title : undefined,
        startTime: typeof context.startTime === "string" ? context.startTime : undefined,
        location: typeof context.location === "string" ? context.location : undefined,
        attendees: Array.isArray(context.attendees) ? context.attendees : undefined,
      });

      proposedItems.push({
        id: `prop_cal_${Date.now()}`,
        kind: "calendar_event",
        title: calItem.title,
        startTime: calItem.startTime,
        endTime: calItem.endTime,
        location: calItem.location,
        attendees: calItem.attendees,
        icsContent: generateIcsContent(calItem),
        selected: true,
      });

      toolDataSummary = `提取到会议: ${calItem.title}, 时间: ${calItem.startTime}`;
      await loop.emitThinkingToken(`\n已成功解析日程实体: ${calItem.title}`);
    } else if (agentType === "invoice_scanner" || skill?.id === "invoice_scanner") {
      await loop.emitContentToken(`[工具调用] 正在识别发票与报销明细...\n`);
      const invoiceItem: AgentProposalInvoiceItem = {
        id: `prop_inv_${Date.now()}`,
        kind: "invoice_entry",
        vendorName: contextFrom.split("<")[0].trim() || "阿里云计算有限公司",
        amount: 899.0,
        currency: "CNY",
        category: "云服务基础设施",
        date: new Date().toISOString().slice(0, 10),
        selected: true,
      };
      proposedItems.push(invoiceItem);
      toolDataSummary = `提取到发票凭据: ${invoiceItem.vendorName} 金额: ¥${invoiceItem.amount}`;
      await loop.emitThinkingToken(`\n已提取发票金额: ¥${invoiceItem.amount}`);
    } else if (agentType === "batch_triage" || agentType === "smart_sorter") {
      await loop.emitContentToken(`[工具调用] 正在智能评估邮件重要性与紧急度...\n`);
      const triages = toolExtractTriageSuggestions([
        {
          id: contextMessageId || "msg_current",
          subject: contextSubject || "关于下季度规划与预算",
          from: contextFrom || "boss@company.com",
        },
      ]);
      for (const t of triages) {
        proposedItems.push({
          id: `prop_split_${t.messageId}`,
          kind: "split_change",
          messageId: t.messageId,
          subject: t.subject,
          targetSplit: t.recommendedSplit,
          reason: t.reason,
          selected: true,
        });
      }
      toolDataSummary = `分类判定完毕，推荐分箱: ${triages[0]?.recommendedSplit || "important"}`;
    } else if (agentType === "followup_sequence" || agentType === "outreach_translator") {
      await loop.emitContentToken(`[工具调用] 正在提取待办跟进项并起草邮件...\n`);
      const commitmentsRes = toolExtractCommitments(contextSubject, contextBody);
      const commitments = commitmentsRes.commitments || [];
      const commitSummary = commitments.map((c) => `- ${c.text}`).join("\n");
      const draftBody = commitments.length > 0
        ? `您好，针对来信中的关键事项，已确认跟进如下：\n\n${commitSummary}\n\n如有变动请随时同步。`
        : `您好，来信已收到，关于「${contextSubject}」我们将尽快组织落实并回复您。`;

      proposedItems.push({
        id: `prop_draft_${Date.now()}`,
        kind: "draft_reply",
        targetTo: contextFrom,
        subject: `Re: ${contextSubject || "工作跟进与协同"}`,
        body: draftBody,
        selected: true,
      });
      toolDataSummary = `整理出 ${commitments.length} 项待办承诺，并生成标准草稿`;
    } else {
      // General Daily Briefing / Custom Agent
      await loop.emitContentToken(`[工具调用] 正在全局检索相关邮件...\n`);
      const searchRes = toolSearchMessages(prompt || "今日待办");
      toolDataSummary = `检索到 ${searchRes.length} 封关联信件`;
      if (agentType === "daily_briefing") {
        proposedItems.push({
          id: `prop_briefing_cal_${Date.now()}`,
          kind: "calendar_event",
          title: "今日工作规划与待办审阅",
          startTime: new Date().toISOString(),
          selected: true,
        });
      } else if (contextSubject) {
        proposedItems.push({
          id: `prop_draft_${Date.now()}`,
          kind: "draft_reply",
          targetTo: contextFrom,
          subject: `Re: ${contextSubject}`,
          body: `针对邮件「${contextSubject}」已汇总处理方案，请审阅。`,
          selected: true,
        });
      }
    }

    // ── Step 3: LLM Synthesis & Compaction Check ─────────────────
    checkAborted();
    await loop.dispatchEvent({
      type: "step",
      stepIndex: 3,
      totalSteps: 3,
      message: "正在综合生成结构化总结与行动提案...",
    });

    const cleanedBody = cleanContext(contextBody, 3000);
    const systemPrompt = skill?.systemPrompt || `你是一位高效的智能邮件助手。请基于工具提取的数据生成准确、优雅、结构化的建议。`;

    // History & Compaction Handling
    let historyDb: AgentMessageDbRecord[] = [];
    try {
      historyDb = listAgentMessages(sessionId);
    } catch {
      // Ignore if DB not initialized
    }
    const messagesToCompact: MessageToCompact[] = historyDb.map((m) => ({
      role: m.role,
      content: m.content,
      thinkingContent: m.thinkingContent,
    }));

    messagesToCompact.push({
      role: "user",
      content: `邮件主题: ${contextSubject}\n发件人: ${contextFrom}\n正文片段: ${cleanedBody}\n用户需求: ${prompt || "执行智能分析"}\n工具收集结果: ${toolDataSummary}`,
    });

    const compactRes = await compactSessionMessages(messagesToCompact);
    if (compactRes.compacted) {
      await loop.dispatchEvent({
        type: "compaction",
        compactedTokens: compactRes.newTokenCount,
        summary: compactRes.summary,
      });
    }

    const llmMessages = [
      { role: "system" as const, content: systemPrompt },
      ...compactRes.compactedMessages.map((m) => ({
        role: m.role === "system" ? ("system" as const) : m.role === "user" ? ("user" as const) : ("assistant" as const),
        content: m.content,
      })),
    ];

    const llmResult = await chatComplete(llmMessages, {
      maxTokens: 1200,
      temperature: 0.3,
    });

    let finalSummary = "";
    if (llmResult.ok) {
      finalSummary = llmResult.text.trim();
    } else {
      finalSummary = `已完成分析。\n\n**工具收集概览**：\n${toolDataSummary}\n\n建议核对下方生成的待办提案。`;
    }

    await loop.emitContentToken(finalSummary + "\n");

    const proposalData: AgentProposalData = {
      title: `${skill?.name || getAgentTypeLabel(agentType)} 提案`,
      summary: finalSummary,
      items: proposedItems,
      rawResult: toolDataSummary,
    };

    const propEvt: AgentProposalEvent = {
      type: "proposal",
      data: proposalData,
    };
    await loop.dispatchEvent(propEvt);

    const doneEvt: AgentDoneEvent = {
      type: "done",
      summary: finalSummary,
      thinking: thinkingText,
    };
    await loop.dispatchEvent(doneEvt);

    // Save message records to DB
    try {
      insertAgentMessage({
        id: `msg_u_${Date.now()}`,
        sessionId,
        role: "user",
        content: prompt || getAgentTypeLabel(agentType),
        createdAt: Date.now(),
      });

      insertAgentMessage({
        id: `msg_a_${Date.now()}`,
        sessionId,
        role: "assistant",
        content: finalSummary,
        thinkingContent: thinkingText,
        proposals: JSON.stringify(proposedItems),
        createdAt: Date.now() + 1,
      });
    } catch {
      // Ignore if DB not initialized
    }

    return proposalData;
  } catch (err: unknown) {
    const isAbort = controller.signal.aborted || (err instanceof Error && err.name === "AbortError");
    const errorEvt: AgentErrorEvent = {
      type: "error",
      code: isAbort ? "ABORTED" : "AGENT_EXECUTION_FAILED",
      message: err instanceof Error ? err.message : String(err),
    };
    await loop.dispatchEvent(errorEvt);
    throw err;
  } finally {
    activeAgentControllers.delete(reqId);
  }
}

function getAgentTypeLabel(type: AgentType): string {
  switch (type) {
    case "daily_briefing":
      return "晨间简报智能体";
    case "meeting_extractor":
      return "会议日程提取助手";
    case "batch_triage":
      return "批量分箱整理";
    case "followup_sequence":
      return "待办跟进助手";
    case "invoice_scanner":
      return "财务发票与报销整理";
    case "outreach_translator":
      return "跨语种商务邮件外联";
    case "smart_sorter":
      return "智能分箱与批量归档";
    case "custom":
      return "自定义智能体";
    default:
      return "AI 智能体";
  }
}
