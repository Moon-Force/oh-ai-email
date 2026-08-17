import { chatComplete, type ChatMessage } from "../complete";
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
  AGENT_TOOLS,
  executeAgentTool,
  generateIcsContent,
  normalizeToolName,
  parseProposalItemsFromOutput,
  toolExtractCommitments,
  toolExtractInvoiceDetails,
  toolExtractMeetingDetails,
  toolExtractTriageSuggestions,
  toolGetRecentMessages,
  toolGetUnreadSummary,
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

const MAX_REACT_TURNS = 10;

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

    const contextSubject = typeof context.subject === "string" ? context.subject : "";
    const contextFrom = typeof context.from === "string" ? context.from : "";
    const contextBody = typeof context.body === "string" ? context.body : "";
    const contextMessageId = typeof context.messageId === "string" ? context.messageId : "";
    const cleanedBody = cleanContext(contextBody, 4000);

    const initialThinking = `【思考分析】任务类型: ${skill?.name || getAgentTypeLabel(agentType)}\n正在加载语境「${contextSubject ? contextSubject.slice(0, 30) : "全局邮箱模式"}」与工具沙箱...\n`;
    await loop.emitThinkingToken(initialThinking);

    // ── Step 2: Tool Execution & Context Pre-population ───────────
    checkAborted();
    await loop.dispatchEvent({
      type: "step",
      stepIndex: 2,
      totalSteps: 3,
      message: "正在准备上下文与执行环境...",
    });

    let toolDataSummary = "";
    const proposedItems: AgentProposalItem[] = [];
    let systemPrompt =
      skill?.systemPrompt ||
      `你是一位专业的 AI 邮件助理。你可以使用提供的工具检索用户的本地邮箱邮件、查看邮件全文、分析未读与往来邮件。若需要查询多封邮件或执行多次搜索，建议在单轮中并行调用工具。请根据检索到的信息提供严谨、准确的回答与操作建议。`;

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
      userPromptContent = `邮件主题: ${contextSubject}\n发件人: ${contextFrom}\n正文片段: ${cleanedBody}\n用户需求: ${prompt || "提取会议详情并生成日程提议"}`;
    } else if (agentType === "invoice_scanner" || skill?.id === "invoice_scanner") {
      await loop.emitContentToken(`[工具调用] 正在解析发票与财务账单...\n`);
      if (contextSubject || contextBody) {
        const invItem = toolExtractInvoiceDetails(contextSubject, contextBody, contextFrom);
        if (invItem) {
          proposedItems.push(invItem);
          toolDataSummary = `已从邮件提取发票: ${invItem.vendorName}, 金额: ${invItem.amount} ${invItem.currency}`;
        }
        userPromptContent = `邮件主题: ${contextSubject}\n发件人: ${contextFrom}\n正文片段: ${cleanedBody}\n用户需求: ${prompt || "抽取发票与账单信息"}`;
      } else {
        const found = toolSearchMessages("发票 账单 invoice receipt 报销");
        const invoiceEmails = found.slice(0, 5);
        if (invoiceEmails.length > 0) {
          toolDataSummary = `已自动检索到 ${invoiceEmails.length} 封相关发票/账单邮件`;
          for (const m of invoiceEmails) {
            const extracted = toolExtractInvoiceDetails(m.subject, m.snippet || "", m.from);
            if (extracted) {
              proposedItems.push(extracted);
            }
          }
          userPromptContent = `检索到的发票相关邮件如下:\n${invoiceEmails.map((e) => `[${e.dateLabel}] ${e.from}: 《${e.subject}》\n摘要: ${e.snippet}`).join("\n\n")}\n\n请针对以上邮件进行财务报销与发票信息整理。\n用户补充指令: ${prompt || "整理发票信息"}`;
        } else {
          userPromptContent = prompt || "请从本地邮箱中扫描发票与报销邮件。";
        }
      }
    } else if (agentType === "batch_triage" || agentType === "smart_sorter") {
      let targetMsgs = [];
      if (contextMessageId || contextSubject || contextBody) {
        targetMsgs = [
          {
            id: contextMessageId || "msg_current",
            subject: contextSubject || "工作协同与待办",
            from: contextFrom || "sender@example.com",
            body: contextBody || "",
          },
        ];
      } else {
        const recents = toolGetRecentMessages(8);
        targetMsgs = recents.map((r) => ({
          id: r.id,
          subject: r.subject,
          from: r.from,
          body: r.snippet || "",
        }));
      }

      const triages = toolExtractTriageSuggestions(targetMsgs);
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
      toolDataSummary = `已分析 ${triages.length} 封邮件的分箱归类`;
      userPromptContent = `待分箱邮件清单:\n${targetMsgs.map((m) => `- id: ${m.id} | 《${m.subject}》来自 ${m.from}`).join("\n")}\n\n用户指令: ${prompt || "执行智能分箱与归档评估"}\n请评估每封邮件的重要性与紧急程度，输出详细分析报告并在文末附上包含 split_change 数组的 JSON 代码块（包含 message_id, subject, new_split ("important"|"other"), reason），以便系统生成一键采纳卡片。`;
    } else if (agentType === "followup_sequence" || agentType === "outreach_translator") {
      let subjectToUse = contextSubject;
      let bodyToUse = contextBody;
      let fromToUse = contextFrom;

      if (!subjectToUse && !bodyToUse) {
        const recents = toolGetRecentMessages(5);
        if (recents.length > 0) {
          subjectToUse = recents[0].subject;
          fromToUse = recents[0].from;
          bodyToUse = recents[0].snippet;
        }
      }

      const commitmentsRes = toolExtractCommitments(subjectToUse, bodyToUse);
      const commitments = commitmentsRes.commitments || [];
      const commitSummary = commitments.map((c) => `- ${c.text}`).join("\n");
      const draftBody =
        commitments.length > 0
          ? `您好，针对来信中的关键事项，已确认跟进如下：\n\n${commitSummary}\n\n如有变动请随时同步。`
          : `您好，来信已收到，关于「${subjectToUse || "工作跟进"}」我们将尽快组织落实并回复您。`;

      proposedItems.push({
        id: `prop_draft_${Date.now()}`,
        kind: "draft_reply",
        targetTo: fromToUse || "colleague@example.com",
        subject: `Re: ${subjectToUse || "工作跟进与协同"}`,
        body: draftBody,
        selected: true,
      });
      toolDataSummary = `整理出 ${commitments.length} 项待办承诺，并生成标准草稿`;
      userPromptContent = `邮件主题: ${subjectToUse}\n发件人: ${fromToUse}\n正文片段: ${cleanContext(bodyToUse, 3000)}\n用户需求: ${prompt || "生成跟进回复草稿"}`;
    } else if (agentType === "daily_briefing") {
      const unreadList = toolGetUnreadSummary(10);
      const recentList = toolGetRecentMessages(6);
      proposedItems.push({
        id: `prop_briefing_cal_${Date.now()}`,
        kind: "calendar_event",
        title: "今日工作规划与待办审阅",
        startTime: new Date().toISOString(),
        selected: true,
      });
      toolDataSummary = `已汇总 ${unreadList.length} 封未读邮件与 ${recentList.length} 封近期往来邮件`;
      userPromptContent = `【收件箱概览】\n- 未读邮件数: ${unreadList.length}\n${unreadList.map((u) => `  * [${u.dateLabel}] ${u.from}: 《${u.subject}》`).join("\n")}\n\n【近期往来】\n${recentList.map((r) => `  * [${r.dateLabel}] ${r.from}: 《${r.subject}》`).join("\n")}\n\n用户指令: 请为我生成今日晨间简报与待办建议。${prompt ? `补充要求: ${prompt}` : ""}`;
    } else {
      userPromptContent =
        contextSubject || contextBody
          ? `邮件主题: ${contextSubject}\n发件人: ${contextFrom}\n正文片段: ${cleanedBody}\n用户需求: ${prompt || "执行智能分析"}`
          : prompt || "请根据系统指令执行任务。若需要查询邮箱内容，请直接调用相关工具。";
    }

    // ── Step 3: Multi-turn ReAct Reasoning & Tool Execution Loop ─
    checkAborted();
    await loop.dispatchEvent({
      type: "step",
      stepIndex: 3,
      totalSteps: 3,
      message: "AI 正在实时推理与自主检索...",
    });

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

    const currentChatMessages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
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
    let finalSummary = "";
    let finalReasoning = "";

    // ── ReAct Loop (Up to MAX_REACT_TURNS) ─────────────────────────
    for (let turn = 1; turn <= MAX_REACT_TURNS; turn++) {
      checkAborted();

      let turnReasoning = "";
      let turnContent = "";

      const llmResult = await chatComplete(currentChatMessages, {
        requestId: `${reqId}_t${turn}`,
        tools: AGENT_TOOLS,
        onChunk: (chunk) => {
          if (chunk.reasoningChunk) {
            turnReasoning += chunk.reasoningChunk;
            fullStreamedReasoning += chunk.reasoningChunk;
            void loop.emitThinkingToken(chunk.reasoningChunk);
          }
          if (chunk.contentChunk) {
            turnContent += chunk.contentChunk;
            fullStreamedContent += chunk.contentChunk;
            void loop.emitContentToken(chunk.contentChunk);
          }
        },
      });

      if (!llmResult.ok) {
        if (!fullStreamedContent && !finalSummary) {
          finalSummary = toolDataSummary
            ? `已完成分析。\n\n**工具收集概览**：\n${toolDataSummary}`
            : "已完成处理。";
        }
        break;
      }

      const hasToolCalls = Boolean(llmResult.toolCalls && llmResult.toolCalls.length > 0);

      if (!hasToolCalls) {
        // Model finished reasoning and returned final textual synthesis
        finalSummary = llmResult.text.trim();
        finalReasoning = llmResult.reasoningContent || fullStreamedReasoning;
        break;
      }

      // Execute Tool Calls in Local Sandbox
      const toolCalls = llmResult.toolCalls!;
      currentChatMessages.push({
        role: "assistant",
        content: llmResult.text || null,
        tool_calls: toolCalls,
      });

      for (const tc of toolCalls) {
        checkAborted();
        const fnName = normalizeToolName(tc.function.name);
        let fnArgs: Record<string, unknown> = {};
        try {
          fnArgs = JSON.parse(tc.function.arguments || "{}");
        } catch {
          fnArgs = {};
        }

        const toolNotice = `\n[工具调用] 正在执行 ${fnName}(${JSON.stringify(fnArgs)})...\n`;
        await loop.emitContentToken(toolNotice);

        const execResult = await executeAgentTool(fnName, fnArgs);
        const resultString = execResult.success
          ? JSON.stringify(execResult.data || {})
          : JSON.stringify({ error: execResult.error });

        currentChatMessages.push({
          role: "tool",
          name: fnName,
          tool_call_id: tc.id,
          content: resultString,
        });

        toolDataSummary += `\n- 调用 ${fnName}: ${execResult.success ? "成功" : "失败"}`;
      }
    }

    // If the loop finished on tool calls without emitting final textual synthesis,
    // conduct one graceful final synthesis turn (without tools) to summarize findings.
    if (!finalSummary && !controller.signal.aborted) {
      currentChatMessages.push({
        role: "user",
        content: "请根据以上检索到的所有邮件信息和工具执行结果，给出最终的分析结论、建议或总结。",
      });
      const synthResult = await chatComplete(currentChatMessages, {
        requestId: `${reqId}_final_synth`,
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
      if (synthResult.ok && synthResult.text) {
        finalSummary = synthResult.text.trim();
        finalReasoning = synthResult.reasoningContent || fullStreamedReasoning;
      }
    }

    if (!finalSummary) {
      finalSummary =
        fullStreamedContent.trim() ||
        (toolDataSummary
          ? `已完成分析。\n\n**工具收集概览**：\n${toolDataSummary}`
          : "已完成处理。");
      finalReasoning = fullStreamedReasoning;
    }

    // Parse and merge proposals from the model's final synthesis output (e.g. split_change JSON)
    const finalizedItems = parseProposalItemsFromOutput(finalSummary, proposedItems);

    if (
      finalizedItems.length > 0 &&
      finalizedItems[0].kind === "draft_reply" &&
      finalSummary.trim() &&
      !finalizedItems[0].body
    ) {
      (finalizedItems[0] as AgentProposalDraftItem).body = finalSummary;
    }

    const proposalData: AgentProposalData = {
      title: `${skill?.name || getAgentTypeLabel(agentType)} 结果`,
      summary: finalSummary,
      items: finalizedItems,
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
