// Theme switcher
const themeBtn = document.getElementById("theme-toggle");
let currentTheme = localStorage.getItem("theme") || "dark";
document.documentElement.setAttribute("data-theme", currentTheme);

function updateThemeIcon() {
  if (themeBtn) {
    themeBtn.textContent = currentTheme === "dark" ? "☀️" : "🌙";
  }
}
updateThemeIcon();

themeBtn?.addEventListener("click", () => {
  currentTheme = currentTheme === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", currentTheme);
  localStorage.setItem("theme", currentTheme);
  updateThemeIcon();
});

// Dynamic Rotating Prompt Bar (Kimi Work style)
const promptSuggestions = [
  "帮我分析李总工的千万级邮件归档升级方案，并提炼周五前安全组的行动项",
  "用专业且诚恳的商务语调，起草针对启明创投张合伙人的 Q3 路线图回信",
  "以流利英文回复 Sarah，告知 oh-ai-email 的 MCP 扩展沙箱协议规范",
  "检索上个月来自财务部门的增值税发票附件，并标记为重要邮件",
  "检查当前草稿正文是否提及附件，但尚未上传任何文件",
];

let promptIdx = 0;
const promptTextEl = document.getElementById("hero-prompt-text");

function cyclePrompt() {
  if (!promptTextEl) return;
  const targetText = promptSuggestions[promptIdx];
  let charIdx = 0;
  promptTextEl.textContent = "";

  const typeTimer = setInterval(() => {
    if (charIdx < targetText.length) {
      promptTextEl.textContent += targetText.charAt(charIdx);
      charIdx++;
    } else {
      clearInterval(typeTimer);
      setTimeout(() => {
        promptIdx = (promptIdx + 1) % promptSuggestions.length;
        cyclePrompt();
      }, 4000);
    }
  }, 40);
}
cyclePrompt();

// Scenario Data for the Interactive Copilot Window
const scenarios = {
  arch: {
    sender: "李总工 (架构委员会) <arch-lead@company.org>",
    time: "10:42",
    title: "关于企业邮箱千万级邮件归档升级与 AI 审计规则方案",
    body: `各位技术骨干：\n本季度针对企业邮箱的高并发同步与增量附件审计，架构组已在灰度集群完成 1000 万级邮件索引压测。测试表明 SQLite + safeStorage 本地加密方案将检索耗时降低了 78%。\n\n预计下周二下午 15:00 召开跨部门上线终审会议，请安全组周五前确认附件敏感词过滤清单，研发组准备好 IMAP IDLE 保活指标看板。\n\n顺祝商祺，\n李总工`,
    aiOutputs: {
      summary: {
        think: `[DeepSeek-R1 深度推理]\n1. 提取核心进展：1000万级邮件本地加密检索性能提升 78%。\n2. 识别关键时间线：周五前（安全组规则确认）、下周二 15:00（跨部门终审会）。\n3. 梳理架构要求：准备 IMAP IDLE 保活监控指标。`,
        content: `📌 【核心摘要】\n1. 压测突破：千万级邮件本地加密归档完成，检索性能提升 78%。\n2. 关键节点：下周二 15:00 召开跨部门终审评审会。\n3. 待办分工：安全组周五前确认敏感词规则，研发组准备 IDLE 监控看板。`,
      },
      reply: {
        think: `[DeepSeek-R1 深度推理]\n1. 来信人：架构委员会李总工。\n2. 拟定对策：确认收到、反馈 IDLE 看板进度、准时参会。`,
        content: `李总工您好，\n\n收到关于邮件归档方案与审计规则的通知。研发团队已准备好 IMAP IDLE 实时推信与保活压测指标看板，我们将在周五前同步安全组完成联调，并准时参加下周二 15:00 的终审评审会。\n\n祝好，\n研发团队`,
      },
      action: {
        think: `[DeepSeek-R1 深度推理]\n1. 抽取动词、责任人和 Deadline。`,
        content: `📋 【提取行动清单 (GTD)】\n• [待办 | 截止周五] 安全组确认附件敏感词过滤清单\n• [待办 | 截止周一] 研发组准备 IMAP IDLE 保活指标看板\n• [日程 | 下周二 15:00] 参加跨部门上线终审会议`,
      },
      translate: {
        think: `[DeepSeek-R1 深度推理]\n1. 翻译为标准跨国工程英文。`,
        content: `Dear Tech Committee,\nRegarding the multi-million archive upgrade and AI audit rules, the architecture team has concluded stress testing on the canary cluster, reducing query latency by 78%.\n\nThe review meeting is scheduled for next Tuesday at 15:00. Please ensure the sensitive filter list is approved by Friday.`,
      },
    },
  },
  investor: {
    sender: "张合伙人 (启明创投) <investor@qimingvc.com>",
    time: "09:15",
    title: "关于 oh-ai-email 桌面客户端商业化与开源生态进展",
    body: `团队您好：\n看到 oh-ai-email 刚发布的 v0.1.0 版本，不仅在 GitHub 获得了很高的关注，而且 IMAP IDLE 零延迟推信与本地 Ollama 隐私体验非常亮眼。\n\n下周团队有时间线上同步一下 Q3 的产品路线图吗？我们对企业级部署和离线大模型合规非常感兴趣。\n\n张合伙人`,
    aiOutputs: {
      summary: {
        think: `[DeepSeek-R1 深度推理]\n1. 意图：启明创投张合伙人肯定 v0.1.0 架构，约下周讨论 Q3 路线图。`,
        content: `📌 【投资人来信摘要】\n1. 投资方高度认可 v0.1.0 版本的 IMAP IDLE 零延迟与本地 Ollama 隐私架构。\n2. 邀请下周开展线上会议，深入沟通 Q3 商业化规划与企业级合规部署。`,
      },
      reply: {
        think: `[DeepSeek-R1 深度推理]\n1. 拟定商务回应，主动提供 2 个候选时间段。`,
        content: `张总您好，\n\n非常感谢对 oh-ai-email v0.1.0 架构与开源生态的认可！我们非常乐意与您同步 Q3 的企业级合规路线图。\n\n下周三上午 10:00 或周四下午 14:00 均可，请问哪个时段方便？期待与您的深入交流。\n\n祝好，\n创始人团队`,
      },
      action: {
        think: `[DeepSeek-R1 深度推理]\n1. 提取待办。`,
        content: `📋 【提取行动清单】\n• [沟通] 确认与启明创投线上沟通的具体时间档期\n• [材料] 整理 Q3 企业版合规与本地模型私有化部署 Deck`,
      },
      translate: {
        think: `[DeepSeek-R1 深度推理]\n1. 英文转译。`,
        content: `Hello Team,\nCongratulations on the v0.1.0 launch. The IMAP IDLE push and local Ollama privacy design are truly impressive.\nCould we schedule an online sync next week regarding the Q3 roadmap and enterprise compliance?`,
      },
    },
  },
  global: {
    sender: "Sarah Jenkins <sarah@nordictech.io>",
    time: "昨天",
    title: "Global Collaboration & AI Mail Extension Standards",
    body: `Hi Team,\nWe tested oh-ai-email across macOS and Linux. The zero-telemetry architecture and offline DeepSeek R1 integration meet our GDPR privacy requirements perfectly.\n\nCould you share your integration specs for custom MCP (Model Context Protocol) tool servers?\n\nBest regards,\nSarah Jenkins`,
    aiOutputs: {
      summary: {
        think: `[DeepSeek-R1 深度推理]\n1. 关键信息：已在 macOS/Linux 部署测试，满足 GDPR 零数据出境。\n2. 核心请求：MCP 工具协议规范。`,
        content: `📌 【跨国合作来信摘要】\n1. 北欧技术团队已在 macOS/Linux 部署测试，确认符合 GDPR 零遥测隐私合规。\n2. 对方希望获取自定义 MCP (Model Context Protocol) 工具扩展协议接入标准。`,
      },
      reply: {
        think: `[DeepSeek-R1 深度推理]\n1. 英文回复，指向 AGENT_WORKFLOW.md 文档。`,
        content: `Hi Sarah,\n\nThank you for reaching out. We are glad to hear that oh-ai-email meets your GDPR compliance standards.\nOur MCP server and agent sandbox specifications are documented under docs/AGENT_WORKFLOW.md in our open-source repo. We'd love to collaborate on your custom tool extension.\n\nBest,\nCore Team`,
      },
      action: {
        think: `[DeepSeek-R1 深度推理]\n1. 行动抽取。`,
        content: `📋 【提取行动清单】\n• [技术对接] 发送 docs/AGENT_WORKFLOW.md MCP 协议规范给 Sarah\n• [合规背书] 整理 GDPR 零数据出境合规说明文档`,
      },
      translate: {
        think: `[DeepSeek-R1 深度推理]\n1. 翻译为中文。`,
        content: `团队好，\n我们正在规范内部通信工具，并在 macOS 和 Linux 上测试了 oh-ai-email。其零遥测架构与离线 DeepSeek R1 集成完全符合我们的 GDPR 隐私标准。请问能否分享自定义 MCP 工具服务的接入规范？`,
      },
    },
  },
};

let currentScenarioKey = "arch";
let currentActionKey = "summary";
let isThinkingEnabled = true;

const threadItems = document.querySelectorAll(".thread-item");
const readerTitle = document.getElementById("reader-subject-text");
const readerMeta = document.getElementById("reader-meta-text");
const readerBody = document.getElementById("reader-body-text");

const agentChips = document.querySelectorAll(".agent-chip");
const thinkingPanel = document.getElementById("thinking-panel");
const outputBox = document.getElementById("copilot-output");
const thinkToggle = document.getElementById("toggle-think");

let typingTimer = null;

function renderCurrentScenario() {
  const data = scenarios[currentScenarioKey];
  if (!data) return;

  if (readerTitle) readerTitle.textContent = data.title;
  if (readerMeta) readerMeta.textContent = `发件人：${data.sender} · ${data.time}`;
  if (readerBody) readerBody.textContent = data.body;

  triggerAction(currentActionKey);
}

function triggerAction(action) {
  currentActionKey = action;
  const data = scenarios[currentScenarioKey];
  const aiData = data.aiOutputs[action] || data.aiOutputs.summary;

  // Thinking panel
  if (isThinkingEnabled && thinkingPanel) {
    thinkingPanel.textContent = aiData.think;
    thinkingPanel.classList.add("active");
  } else if (thinkingPanel) {
    thinkingPanel.classList.remove("active");
  }

  // Stream output
  if (typingTimer) clearInterval(typingTimer);
  if (!outputBox) return;
  outputBox.textContent = "";
  let idx = 0;
  const fullText = aiData.content;
  typingTimer = setInterval(() => {
    if (idx < fullText.length) {
      outputBox.textContent += fullText.charAt(idx);
      idx++;
    } else {
      clearInterval(typingTimer);
    }
  }, 10);
}

threadItems.forEach((item) => {
  item.addEventListener("click", () => {
    threadItems.forEach((i) => i.classList.remove("selected"));
    item.classList.add("selected");
    const key = item.getAttribute("data-scenario");
    if (key && scenarios[key]) {
      currentScenarioKey = key;
      renderCurrentScenario();
    }
  });
});

agentChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    agentChips.forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
    const action = chip.getAttribute("data-action");
    if (action) triggerAction(action);
  });
});

thinkToggle?.addEventListener("change", (e) => {
  isThinkingEnabled = e.target.checked;
  triggerAction(currentActionKey);
});

// FAQ Accordion
const faqRows = document.querySelectorAll(".faq-row");
faqRows.forEach((row) => {
  const q = row.querySelector(".faq-q");
  q?.addEventListener("click", () => {
    const isActive = row.classList.contains("active");
    faqRows.forEach((r) => r.classList.remove("active"));
    if (!isActive) {
      row.classList.add("active");
    }
  });
});

// Init
renderCurrentScenario();
