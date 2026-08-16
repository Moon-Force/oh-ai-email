import type { AgentSkillDefinition } from "./types";

/**
 * 4 Built-in Core Skills for AI Email Workflows
 */
export const BUILTIN_SKILLS: AgentSkillDefinition[] = [
  {
    id: "meeting_extractor",
    name: "会议日程提取助手",
    description: "自动识别邮件中的会议时间、地点、参会人及议程要点，并生成标准日历日程提案",
    icon: "EventAvailable",
    version: "1.0.0",
    author: "oh-ai-email",
    tags: ["日程", "会议", "日历"],
    allowedTools: ["calendar_proposal", "extract_action_items"],
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
  };
}

/**
 * Skills Manager to register, discover, and retrieve agent skills.
 */
export class SkillsManager {
  private skills: Map<string, AgentSkillDefinition> = new Map();

  constructor() {
    // Register built-in skills by default
    for (const skill of BUILTIN_SKILLS) {
      this.skills.set(skill.id, skill);
    }
  }

  public getSkill(id: string): AgentSkillDefinition | undefined {
    return this.skills.get(id);
  }

  public listSkills(): AgentSkillDefinition[] {
    return Array.from(this.skills.values());
  }

  public registerSkill(skill: AgentSkillDefinition): void {
    this.skills.set(skill.id, skill);
  }

  public registerFromMarkdown(content: string, fallbackId: string): AgentSkillDefinition {
    const skill = parseSkillMarkdown(content, fallbackId);
    this.skills.set(skill.id, skill);
    return skill;
  }
}
