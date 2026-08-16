import type { AgentSkillDefinition } from "./types";
import { listCustomSkills, saveCustomSkill, deleteCustomSkill } from "../../db";

/**
 * 4 Built-in Core Skills for AI Email Workflows
 */
/**
 * Comprehensive Built-in Core Skills for AI Email Workflows (Pi-Agent Unified Core)
 */
export const BUILTIN_SKILLS: AgentSkillDefinition[] = [
  {
    id: "summarize",
    name: "智能邮件摘要",
    description: "提炼邮件核心要点、背景与关键诉求，生成清晰简短的摘要",
    icon: "Summarize",
    version: "1.0.0",
    author: "oh-ai-email",
    tags: ["摘要", "提炼", "速读"],
    allowedTools: ["extract_action_items"],
    isCustom: false,
    systemPrompt: `You are an executive email assistant. Summarize incoming emails concisely in the SAME language as the email.
1. Capture the core purpose, critical context, and any decision required.
2. Structure with bullet points if multiple distinct topics exist.
3. Keep it crisp, factual, and strictly under 4-5 sentences without unnecessary filler.`,
  },
  {
    id: "draft_reply",
    name: "情境感知回复起草",
    description: "依据来信语境、发件人关系及用户画像，拟定得体、清晰专业的回复草稿",
    icon: "Reply",
    version: "1.0.0",
    author: "oh-ai-email",
    tags: ["写信", "回复", "草稿"],
    allowedTools: ["draft_proposal", "extract_action_items"],
    isCustom: false,
    systemPrompt: `You are an email assistant drafting professional, context-aware replies.
1. Respond in the same language as the incoming email.
2. Address questions and action items directly and politely.
3. Maintain an empathetic, efficient tone. Generate only the reply text ready to send.`,
  },
  {
    id: "quick_reply",
    name: "极速场景回复",
    description: "一键生成标准致谢、确认推进、稍后答复或礼貌婉拒等即时回复",
    icon: "Bolt",
    version: "1.0.0",
    author: "oh-ai-email",
    tags: ["快捷", "回复", "高频"],
    allowedTools: ["draft_proposal"],
    isCustom: false,
    systemPrompt: `You are a high-efficiency email assistant crafting quick replies.
Generate short, polite, context-appropriate responses according to the requested reply intent (ack/confirm/later/decline).`,
  },
  {
    id: "action_items",
    name: "结构化行动项提取",
    description: "深度识别邮件中的待办任务、责任人、截止时间及关键交付物",
    icon: "CheckCircleOutline",
    version: "1.0.0",
    author: "oh-ai-email",
    tags: ["待办", "行动项", "任务"],
    allowedTools: ["extract_action_items", "calendar_proposal"],
    isCustom: false,
    systemPrompt: `You are an action item extraction specialist.
Analyze the email and extract explicit or implicit todos, action items, assignees, and deadlines.
List actionable points cleanly starting with bullet points. If no action items are found, explicitly state none.`,
  },
  {
    id: "commitments",
    name: "承诺追踪与履约分析",
    description: "智能追踪发件人与收件人做出的承诺、约定时间与交付保证",
    icon: "Handshake",
    version: "1.0.0",
    author: "oh-ai-email",
    tags: ["承诺", "履约", "追踪"],
    allowedTools: ["extract_action_items"],
    isCustom: false,
    systemPrompt: `You are a commitment tracking assistant. Identify promises, deliverables, and timeline commitments made by participants.`,
  },
  {
    id: "thread_summary",
    name: "多轮对话线索复盘",
    description: "深度复盘多封邮件往来历史，梳理完整时间线与各方立场演变",
    icon: "Timeline",
    version: "1.0.0",
    author: "oh-ai-email",
    tags: ["时间线", "复盘", "多轮"],
    allowedTools: ["extract_action_items"],
    isCustom: false,
    systemPrompt: `You are an expert thread timeline analyst.
Analyze multi-turn email conversations, extract the sequence of events, key decisions reached, and timeline items.`,
  },
  {
    id: "suggest_split",
    name: "智能优先级分箱",
    description: "精准评估邮件重要性与紧急度，给出分箱建议（重要/其他）及原因",
    icon: "FolderSpecial",
    version: "1.0.0",
    author: "oh-ai-email",
    tags: ["分箱", "分类", "优先级"],
    allowedTools: ["split_proposal"],
    isCustom: false,
    systemPrompt: `You are a smart inbox triage agent.
Evaluate importance and urgency based on sender, topic, financial/contract impact, or system notices.
Output recommendation: SPLIT: important | other followed by REASON: ...`,
  },
  {
    id: "translate",
    name: "多语言精准邮件互译",
    description: "支持跨语种专业邮件互译，保持专业术语与商务礼仪",
    icon: "Translate",
    version: "1.0.0",
    author: "oh-ai-email",
    tags: ["翻译", "多语言", "外联"],
    allowedTools: ["draft_proposal"],
    isCustom: false,
    systemPrompt: `You are a professional email translator. Translate faithfully while adapting to natural business phrasing in the target language.`,
  },
  {
    id: "compose",
    name: "创意写作与邮件起草",
    description: "根据用户自然语言提示或要点，智能扩写或起草完整商务邮件",
    icon: "Create",
    version: "1.0.0",
    author: "oh-ai-email",
    tags: ["写作", "起草", "生成"],
    allowedTools: ["draft_proposal"],
    isCustom: false,
    systemPrompt: `You are a creative executive drafting assistant.
Transform prompt instructions into a polished, persuasive email with clear structure.`,
  },
  {
    id: "rewrite",
    name: "语气润色与表达重塑",
    description: "根据需要调整草稿语气（更精炼、更正式、更详尽、符合个人风格）",
    icon: "AutoFixHigh",
    version: "1.0.0",
    author: "oh-ai-email",
    tags: ["润色", "改写", "语气"],
    allowedTools: ["draft_proposal"],
    isCustom: false,
    systemPrompt: `You are an expert copy editor and writing stylist.
Rewrite the provided text preserving original meaning while perfecting tone, clarity, and conciseness.`,
  },
  {
    id: "meeting_extractor",
    name: "会议日程提取助手",
    description: "自动识别邮件中的会议时间、地点、参会人及议程要点，并生成标准日历日程提案",
    icon: "EventAvailable",
    version: "1.0.0",
    author: "oh-ai-email",
    tags: ["日程", "会议", "日历"],
    allowedTools: ["calendar_proposal", "extract_action_items"],
    isCustom: false,
    systemPrompt: `你是一位专业的高管日程助理。你的职责是深度分析用户提供的邮件往来记录，精准识别出：
1. 会议或活动的主题（Title）
2. 准确的起止时间（StartTime, EndTime，若未说明年份则默认当前年份，推断时区）
3. 会议地点或线上会议链接（Location）
4. 参会人员邮箱列表（Attendees）
5. 关键讨论议程或准备事项。
输出必须条理清晰，并调用日历提案工具生成可一键添加的日历日程。`,
  },
  {
    id: "invoice_scanner",
    name: "财务发票与报销整理",
    description: "精准抽取发票与账单邮件中的开票方、发票号、金额、税率及报销类别",
    icon: "ReceiptLong",
    version: "1.0.0",
    author: "oh-ai-email",
    tags: ["财务", "报销", "发票"],
    allowedTools: ["invoice_proposal", "extract_action_items"],
    isCustom: false,
    systemPrompt: `你是一位严谨的财务报销专家。你的职责是解析邮件及其附件信息中的财务凭据：
1. 识别发票开具方（Vendor Name / 商户名）
2. 发票代码与发票号码（Invoice Number）
3. 消费金额与货币单位（Amount & Currency，如 CNY, USD）
4. 消费类别（如：差旅交通、餐饮住宿、办公耗材、云服务费）
5. 报销合规提醒。
输出报销明细清单，并生成结构化报销提案。`,
  },
  {
    id: "outreach_translator",
    name: "跨语种商务邮件外联",
    description: "支持中/英/日/德等跨语种商务邮件互译与得体商务语气润色",
    icon: "Translate",
    version: "1.0.0",
    author: "oh-ai-email",
    tags: ["翻译", "商务外联", "润色"],
    allowedTools: ["draft_proposal"],
    isCustom: false,
    systemPrompt: `你是一位精通跨国商务礼仪的双语外联专家。你的任务是：
1. 将用户拟定的中文或草稿翻译为地道、得体、专业的商务外语邮件（如英语、日语等）
2. 适配跨文化沟通礼仪（恰当的问候、客套、清晰有力的 Action Item、得体的结语）
3. 遵循邮件规范结构（Clear Subject Line, Salutation, Context, Request, Sign-off）
直接生成完整草稿提案供用户核阅。`,
  },
  {
    id: "smart_sorter",
    name: "智能分箱与批量归档",
    description: "基于发件人画像与内容紧急度，智能划分「重要/其他」分箱并推荐归档策略",
    icon: "FolderSpecial",
    version: "1.0.0",
    author: "oh-ai-email",
    tags: ["分箱", "归档", "整理"],
    allowedTools: ["split_proposal"],
    isCustom: false,
    systemPrompt: `你是一位敏锐的收件箱整理专家。你的任务是：
1. 评估邮件的紧急程度与商业重要性（来自关键合作伙伴、领导、合同等标为重要；系统通知、促销、次要订阅标为其他）
2. 给出清晰合理的判定理由
3. 生成分箱调整提案（split_change），帮助用户保持收件箱清爽。`,
  },
];

/**
 * Parses markdown frontmatter text into an AgentSkillDefinition.
 * Compatible with pi-style markdown skills.
 */
export function parseSkillMarkdown(content: string, fallbackId: string): AgentSkillDefinition {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    return {
      id: fallbackId,
      name: fallbackId,
      description: "",
      version: "1.0.0",
      allowedTools: [],
      systemPrompt: content.trim(),
      isCustom: true,
    };
  }

  const frontmatter = match[1];
  const body = match[2].trim();

  const metadata: Record<string, string> = {};
  for (const line of frontmatter.split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim();
      const val = line.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, "");
      metadata[key] = val;
    }
  }

  const allowedTools = metadata.allowedTools
    ? metadata.allowedTools.split(",").map((s) => s.trim()).filter(Boolean)
    : [];
  const tags = metadata.tags
    ? metadata.tags.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  return {
    id: metadata.id || fallbackId,
    name: metadata.name || fallbackId,
    description: metadata.description || "",
    icon: metadata.icon || "Psychology",
    version: metadata.version || "1.0.0",
    author: metadata.author,
    tags,
    allowedTools,
    systemPrompt: body,
    isCustom: true,
  };
}

/**
 * Converts an AgentSkillDefinition into Markdown with YAML frontmatter.
 */
export function exportSkillMarkdown(skill: AgentSkillDefinition): string {
  const lines = [
    "---",
    `id: ${skill.id}`,
    `name: ${skill.name}`,
    `description: ${skill.description}`,
    `version: ${skill.version || "1.0.0"}`,
  ];
  if (skill.icon) lines.push(`icon: ${skill.icon}`);
  if (skill.author) lines.push(`author: ${skill.author}`);
  if (skill.tags && skill.tags.length > 0) lines.push(`tags: ${skill.tags.join(",")}`);
  if (skill.allowedTools && skill.allowedTools.length > 0) lines.push(`allowedTools: ${skill.allowedTools.join(",")}`);
  lines.push("---");
  lines.push("");
  lines.push(skill.systemPrompt);
  return lines.join("\n");
}

/**
 * Skills Manager to register, discover, and retrieve agent skills.
 */
export class SkillsManager {
  private skills: Map<string, AgentSkillDefinition> = new Map();

  constructor() {
    // Register built-in skills by default
    for (const skill of BUILTIN_SKILLS) {
      this.skills.set(skill.id, { ...skill, isCustom: false });
    }
    this.syncFromDb();
  }

  public syncFromDb(): void {
    try {
      const customSkills = listCustomSkills();
      for (const cs of customSkills) {
        this.skills.set(cs.id, {
          id: cs.id,
          name: cs.name,
          description: cs.description,
          icon: "Psychology",
          version: "1.0.0",
          author: "User",
          tags: cs.tags,
          allowedTools: cs.allowedTools,
          systemPrompt: cs.systemPrompt,
          isCustom: true,
          createdAt: cs.createdAt,
          updatedAt: cs.updatedAt,
        });
      }
    } catch {
      // safe fallback if DB not ready
    }
  }

  public getSkill(id: string): AgentSkillDefinition | undefined {
    return this.skills.get(id);
  }

  public listSkills(): AgentSkillDefinition[] {
    this.syncFromDb();
    return Array.from(this.skills.values());
  }

  public registerSkill(skill: AgentSkillDefinition): void {
    this.skills.set(skill.id, skill);
  }

  public saveCustomSkill(skill: Omit<AgentSkillDefinition, "isCustom">): AgentSkillDefinition {
    const now = Date.now();
    const fullSkill: AgentSkillDefinition = {
      ...skill,
      isCustom: true,
      version: skill.version || "1.0.0",
      createdAt: skill.createdAt || now,
      updatedAt: now,
    };
    saveCustomSkill({
      id: fullSkill.id,
      name: fullSkill.name,
      description: fullSkill.description,
      allowedTools: fullSkill.allowedTools,
      systemPrompt: fullSkill.systemPrompt,
      tags: fullSkill.tags,
      createdAt: fullSkill.createdAt || now,
      updatedAt: now,
    });
    this.skills.set(fullSkill.id, fullSkill);
    return fullSkill;
  }

  public deleteCustomSkill(id: string): boolean {
    const existing = this.skills.get(id);
    if (!existing || !existing.isCustom) {
      return false;
    }
    deleteCustomSkill(id);
    this.skills.delete(id);
    return true;
  }

  public registerFromMarkdown(content: string, fallbackId: string): AgentSkillDefinition {
    const skill = parseSkillMarkdown(content, fallbackId);
    return this.saveCustomSkill(skill);
  }
}
