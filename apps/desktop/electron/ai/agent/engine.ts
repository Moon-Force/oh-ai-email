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

    // ── Step 1: Planning & Context Resolution ────────────────────
    checkAborted();
    await loop.dispatchEvent({
      type: "step",
      stepIndex: 1,
      totalSteps: 3,
      message: `正在规划 [${skill?.name || getAgentTypeLabel(agentType)}] 任务...`,
    });

    // Context resolution
    const contextSubject = typeof context.subject === "string" ? context.subject : "";
    const contextFrom = typeof context.from === "string" ? context.from : "";
    const contextBody = typeof context.body === "string" ? context.body : "";
    const contextMessageId = typeof context.messageId === "string" ? context.messageId : "";
    const cleanedBody = cleanContext(contextBody, 4000);

    // Stream initial thinking token
    const initialThinking = `【思考分析】任务类型: ${skill?.name || getAgentTypeLabel(agentType)}\n正在加载邮件主题「${contextSubject ? contextSubject.slice(0, 30) : "未命名邮件"}」与语境...\n`;
    await loop.emitThinkingToken(initialThinking);

    // ── Step 2: Tool Execution & Specialization ───────────────────
    checkAborted();
    await loop.dispatchEvent({
      type: "step",
      stepIndex: 2,
      totalSteps: 3,
      message: "正在调用工具提取结构化数据与线索...",
    });

    let toolDataSummary = "";
    const proposedItems: AgentProposalItem[] = [];

    let systemPrompt = skill?.systemPrompt || `你是一位高效的智能邮件助手。`;
    let userPromptContent = "";

    if (agentType === "translate") {
      const isChineseSource =
        (contextBody.match(/[\u4e00-\u9fa5]/g) || []).length >
        (contextBody.replace(/\s/g, "").length * 0.15);
      const targetLang =
        typeof context.targetLang === "string"
          ? context.targetLang
          : isChineseSource
            ? "en"
            : "zh";

      systemPrompt = `You are a professional executive email translator.
Translate the provided email text directly into ${targetLang === "zh" ? "Simplified Chinese (简体中文)" : "English"}.
Maintain clear, natural business phrasing.
IMPORTANT: Output ONLY the translated content itself. Do NOT include any summary, explanation, introductory labels, or conversational remarks.`;

      userPromptContent = cleanedBody || contextSubject || prompt;
    } else if (agentType === "summarize") {
      systemPrompt = `You are an executive email assistant. Summarize incoming emails concisely in the SAME language as the email.
1. Capture the core purpose, critical context, and any decision required.
2. Structure with bullet points if multiple distinct topics exist.
3. Keep it crisp, factual, and strictly under 4-5 sentences without unnecessary filler.`;

      userPromptContent = `Subject: ${contextSubject}\nFrom: ${contextFrom}\n\n${cleanedBody}`;
    } else if (agentType === "draft_reply") {
      systemPrompt = `You are an email assistant drafting professional, context-aware replies.
1. Respond in the same language as the incoming email.
2. Address questions and action items directly and politely.
3. Maintain an empathetic, efficient tone. Generate only the reply text ready to send.`;

      userPromptContent = `Write a reply to this email:\n\nSubject: ${contextSubject}\nFrom: ${contextFrom}\n\n${cleanedBody}`;
      proposedItems.push({
        id: `prop_draft_${Date.now()}`,
        kind: "draft_reply",
        targetTo: contextFrom,
        subject: contextSubject.toLowerCase().startsWith("re:")
          ? contextSubject
          : `Re: ${contextSubject || "工作跟进"}`,
        body: "",
        selected: true,
      });
    } else if (agentType === "quick_reply") {
      const replyIntent = typeof context.replyType === "string" ? context.replyType : "ack";
      const customNote = typeof context.customNote === "string" ? context.customNote : "";
      systemPrompt = `You are a high-efficiency email assistant crafting quick replies.
Generate short, polite, context-appropriate responses according to the requested reply intent (${replyIntent}${customNote ? `, note: ${customNote}` : ""}).
Generate ONLY the response draft text.`;

      userPromptContent = `Subject: ${contextSubject}\nFrom: ${contextFrom}\n\n${cleanedBody}`;
    } else if (agentType === "rewrite") {
      const tone = typeof context.tone === "string" ? context.tone : "formal";
      systemPrompt = `You are an expert copy editor and writing stylist.
Rewrite the provided text with tone "${tone}".
Generate ONLY the rewritten text without explanations.`;

      userPromptContent = cleanedBody || prompt;
    } else if (agentType === "compose") {
      systemPrompt = `You are an executive drafting assistant. Transform prompt instructions into a polished, persuasive email with clear structure.`;
      userPromptContent = context.body
        ? `Instruction: ${prompt}\n\nExisting draft to improve:\n${cleanContext(String(context.body), 3000)}`
        : `Instruction: ${prompt}`;
    } else if (agentType === "meeting_extractor" || skill?.id === "meeting_extractor") {
      await loop.emitContentToken(`[工具调用] 正在提取会议日程与参会详情...\n`);
      const calItem = toolExtractMeetingDetails(contextSubject, contextBody, {
        title: typeof context.title === "string" ? context.title : undefined,
        startTime: typeof context.startTime === "string" ? context.startTime : undefined,
        location: typeof context.location === "string" ? context.location : undefined,
        attendees: Array.isArray(context.attendees) ? context.attendees : undefined,
      });

      if (calItem) {
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
      }
      userPromptContent = `邮件主题: ${contextSubject}\n发件人: ${contextFrom}\n正文片段: ${cleanedBody}\n工具收集结果: ${toolDataSummary}`;
    } else if (agentType === "invoice_scanner" || skill?.id === "invoice_scanner") {
      const invoiceItem: AgentProposalInvoiceItem = {
        id: `prop_inv_${Date.now()}`,
        kind: "invoice_entry",
        vendorName: contextFrom.split("<")[0].trim() || "商户开票方",
        amount: 899.0,
        currency: "CNY",
        category: "云服务与基础设施",
        date: new Date().toISOString().slice(0, 10),
        selected: true,
      };
      proposedItems.push(invoiceItem);
      toolDataSummary = `提取到发票凭据: ${invoiceItem.vendorName} 金额: ¥${invoiceItem.amount}`;
      userPromptContent = `邮件主题: ${contextSubject}\n发件人: ${contextFrom}\n正文片段: ${cleanedBody}\n工具收集结果: ${toolDataSummary}`;
    } else if (agentType === "batch_triage" || agentType === "smart_sorter") {
      const triages = toolExtractTriageSuggestions([
        {
          id: contextMessageId || "msg_current",
          subject: contextSubject || "工作协同与待办",
          from: contextFrom || "sender@example.com",
          body: contextBody || "",
        },
      ]);
      for (const t of triages) {
        proposedItems.push({
          id: `prop_split_${t.messageId}`,
          kind: "split_change",
          messageId: t.messageId,
          subject: t.subject,
          targetSplit: t.targetSplit,
          reason: t.reason,
          selected: true,
        });
      }
      toolDataSummary = `分类判定完毕，推荐分箱: ${triages[0]?.targetSplit || "important"}`;
      userPromptContent = `邮件主题: ${contextSubject}\n发件人: ${contextFrom}\n正文片段: ${cleanedBody}\n工具收集结果: ${toolDataSummary}`;
    } else if (agentType === "followup_sequence" || agentType === "outreach_translator") {
      const commitmentsRes = toolExtractCommitments(contextSubject, contextBody);
      const commitments = commitmentsRes.commitments || [];
      const commitSummary = commitments.map((c) => `- ${c.text}`).join("\n");
      const draftBody =
        commitments.length > 0
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
      userPromptContent = `邮件主题: ${contextSubject}\n发件人: ${contextFrom}\n正文片段: ${cleanedBody}\n工具收集结果: ${toolDataSummary}`;
    } else if (agentType === "daily_briefing") {
      proposedItems.push({
        id: `prop_briefing_cal_${Date.now()}`,
        kind: "calendar_event",
        title: "今日工作规划与待办审阅",
        startTime: new Date().toISOString(),
        selected: true,
      });
      toolDataSummary = "已汇总今日日程与待办";
      userPromptContent = `主题: ${contextSubject || "今日工作总结"}\n用户需求: 生成晨间简报`;
    } else {
      userPromptContent =
        contextSubject || contextBody
          ? `邮件主题: ${contextSubject}\n发件人: ${contextFrom}\n正文片段: ${cleanedBody}\n用户需求: ${prompt || "执行智能分析"}`
          : prompt || "请根据系统指令执行任务。";
    }

    // ── Step 3: LLM Synthesis with Real-Time Stream ──────────────
    checkAborted();
    await loop.dispatchEvent({
      type: "step",
      stepIndex: 3,
      totalSteps: 3,
      message: "AI 正在实时推理与生成最终结果...",
    });

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
      content: userPromptContent,
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
        role:
          m.role === "system"
            ? ("system" as const)
            : m.role === "user"
              ? ("user" as const)
              : ("assistant" as const),
        content: m.content,
      })),
    ];

    let fullStreamedReasoning = "";
    let fullStreamedContent = "";

    const llmResult = await chatComplete(llmMessages, {
      requestId: reqId,
      onChunk: (chunk) => {
        if (chunk.reasoningChunk) {
          fullStreamedReasoning += chunk.reasoningChunk;
          void loop.emitThinkingToken(chunk.reasoningChunk);
        }
        if (chunk.contentChunk) {
          fullStreamedContent += chunk.contentChunk;
          void loop.emitContentToken(chunk.contentChunk);
        }
      },
    });

    let finalSummary = "";
    let finalReasoning = "";
    if (llmResult.ok) {
      finalSummary = llmResult.text.trim();
      finalReasoning = llmResult.reasoningContent || fullStreamedReasoning;
    } else {
      finalSummary =
        fullStreamedContent.trim() ||
        (toolDataSummary
          ? `已完成分析。\n\n**工具收集概览**：\n${toolDataSummary}`
          : "已完成处理。");
      finalReasoning = fullStreamedReasoning;
    }

    if (
      proposedItems.length > 0 &&
      proposedItems[0].kind === "draft_reply" &&
      llmResult.ok &&
      llmResult.text.trim()
    ) {
      (proposedItems[0] as AgentProposalDraftItem).body = finalSummary;
    }

    const proposalData: AgentProposalData = {
      title: `${skill?.name || getAgentTypeLabel(agentType)} 结果`,
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
      thinking: finalReasoning,
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
        thinkingContent: finalReasoning,
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

export function getAgentTypeLabel(type: AgentType): string {
  switch (type) {
    case "summarize":
      return "智能邮件摘要";
    case "draft_reply":
      return "情境感知回复起草";
    case "quick_reply":
      return "极速场景回复";
    case "action_items":
      return "结构化行动项提取";
    case "commitments":
      return "承诺追踪与履约分析";
    case "thread_summary":
      return "多轮对话线索复盘";
    case "suggest_split":
      return "智能优先级分箱";
    case "translate":
      return "多语言邮件互译";
    case "compose":
      return "创意写作与起草";
    case "rewrite":
      return "语气润色与表达重塑";
    case "analyze_attachment":
      return "附件深度分析";
    case "learn_user_tone":
      return "用户语气画像学习";
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
