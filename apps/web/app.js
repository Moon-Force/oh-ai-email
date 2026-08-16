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

// Scenario Data for the Interactive Cockpit
const scenarios = {
  arch: {
    sender: "架构委员会 · 李总工 <arch-lead@company.org>",
    time: "10:42 (10分钟前)",
    title: "关于企业邮箱千万级邮件归档升级与 AI 审计规则方案",
    body: `各位技术骨干：\n本季度针对企业邮箱的高并发同步与增量附件审计，架构组已在灰度集群完成 1000 万级邮件索引压测。测试表明 SQLite + safeStorage 本地加密方案将检索耗时降低了 78%。\n\n预计下周二下午 15:00 召开跨部门上线终审会议，请安全组周五前确认附件敏感词过滤清单，研发组准备好 IMAP IDLE 保活指标看板。\n\n顺祝商祺，\n李总工`,
    aiOutputs: {
      summary: {
        think: `[DeepSeek-R1 思考过程]\n1. 分析来信核心主题：千万级邮件归档压测完成，下周二召开终审会。\n2. 识别关键时间节点：周五前（安全组确认规则）、下周二 15:00（终审会）。\n3. 提取核心价值指标：本地加密索引提速 78%。\n4. 组织为结构化高管摘要。`,
        content: `📌 【核心摘要】\n1. 压测突破：千万级邮件本地加密归档完成，检索性能提升 78%。\n2. 关键节点：下周二 15:00 召开跨部门终审评审会。\n3. 待办分工：安全组周五前确认敏感词规则，研发组准备 IDLE 监控看板。`,
      },
      reply: {
        think: `[DeepSeek-R1 思考过程]\n1. 来信人角色：架构委员会李总工。\n2. 回复目标：确认收到、反馈排期无问题、确认参会。\n3. 拟定商务专业且简练的语调。`,
        content: `李总工您好，\n\n收到关于邮件归档方案与审计规则的通知。研发团队已准备好 IMAP IDLE 实时推信与保活压测指标看板，我们将在周五前同步安全组完成联调，并准时参加下周二 15:00 的终审评审会。\n\n祝好，\n研发团队`,
      },
      action: {
        think: `[DeepSeek-R1 思考过程]\n1. 扫描动词短语与时态：下周二、周五前、确认、准备。\n2. 转化为标准 GTD 清单。`,
        content: `📋 【提取行动清单 (GTD)】\n• [待办 | 截止周五] 安全组确认附件敏感词过滤清单\n• [待办 | 截止周一] 研发组准备 IMAP IDLE 保活指标看板\n• [日程 | 下周二 15:00] 参加跨部门上线终审会议`,
      },
      translate: {
        think: `[DeepSeek-R1 思考过程]\n1. 商务英文翻译，保持技术专业术语准确性（SQLite + safeStorage, IMAP IDLE keepalive）。`,
        content: `Dear Tech Committee,\nRegarding the multi-million archive upgrade and AI audit rules, the architecture team has concluded stress testing on the canary cluster, reducing query latency by 78%.\n\nThe review meeting is scheduled for next Tuesday at 15:00. Please ensure the sensitive filter list is approved by Friday.`,
      },
    },
  },
  investor: {
    sender: "启明创投 · 张合伙人 <investor@qimingvc.com>",
    time: "09:15 (1小时前)",
    title: "关于 oh-ai-email 桌面客户端商业化与开源生态进展",
    body: `团队您好：\n看到 oh-ai-email 刚发布的 v0.1.0 版本，不仅在 GitHub 获得了很高的 Star 增长，而且 IMAP IDLE 零延迟推信与本地 Ollama 隐私体验非常亮眼。\n\n下周团队有时间线上同步一下 Q3 的产品路线图吗？我们对企业级部署和离线大模型合规非常感兴趣。\n\n张合伙人`,
    aiOutputs: {
      summary: {
        think: `[DeepSeek-R1 思考过程]\n1. 识别发件人：启明创投投资人张合伙人。\n2. 意图：肯定 v0.1.0 开源表现，约下周线上会谈商业化与企业合规。`,
        content: `📌 【投资人来信摘要】\n1. 投资方高度认可 v0.1.0 版本的 IMAP IDLE 零延迟与本地 Ollama 隐私架构。\n2. 邀请下周开展线上会议，深入沟通 Q3 商业化规划与企业级合规部署。`,
      },
      reply: {
        think: `[DeepSeek-R1 思考过程]\n1. 投资人沟通策略：积极开放、提供明确的时间选项。`,
        content: `张总您好，\n\n非常感谢对 oh-ai-email v0.1.0 架构与开源生态的认可！我们非常乐意与您同步 Q3 的企业级合规路线图。\n\n下周三上午 10:00 或周四下午 14:00 均可，请问哪个时段方便？期待与您的深入交流。\n\n祝好，\n创始人团队`,
      },
      action: {
        think: `[DeepSeek-R1 思考过程]\n1. 投资人对接行动项。`,
        content: `📋 【提取行动清单】\n• [沟通] 确认与启明创投线上沟通的具体时间档期\n• [材料] 整理 Q3 企业版合规与本地模型私有化部署 Deck`,
      },
      translate: {
        think: `[DeepSeek-R1 思考过程]\n1. 投资意向英文转换。`,
        content: `Hello Team,\nCongratulations on the v0.1.0 launch. The IMAP IDLE push and local Ollama privacy design are truly impressive.\nCould we schedule an online sync next week regarding the Q3 roadmap and enterprise compliance?`,
      },
    },
  },
  global: {
    sender: "Nordic Tech Hub · Sarah Jenkins <sarah@nordictech.io>",
    time: "昨天 18:30",
    title: "Global Collaboration & AI Mail Extension Standards",
    body: `Hi Team,\nWe are standardizing our internal communication tools and tested oh-ai-email across macOS and Linux. The zero-telemetry architecture and offline DeepSeek R1 integration meet our GDPR privacy requirements perfectly.\n\nCould you share your integration specs for custom MCP (Model Context Protocol) tool servers?\n\nBest regards,\nSarah Jenkins`,
    aiOutputs: {
      summary: {
        think: `[DeepSeek-R1 思考过程]\n1. 识别海外技术负责人 Sarah。\n2. 确认在 macOS/Linux 上测试通过，符合欧盟 GDPR 严苛合规。\n3. 请求 MCP 扩展协议规范。`,
        content: `📌 【跨国合作来信摘要】\n1. 北欧技术团队已在 macOS/Linux 部署测试，确认符合 GDPR 零遥测隐私合规。\n2. 对方希望获取自定义 MCP (Model Context Protocol) 工具扩展协议接入标准。`,
      },
      reply: {
        think: `[DeepSeek-R1 思考过程]\n1. 英文回复，提供文档链接与标准。`,
        content: `Hi Sarah,\n\nThank you for reaching out. We are glad to hear that oh-ai-email meets your GDPR compliance standards.\nOur MCP server and agent sandbox specifications are documented under docs/AGENT_WORKFLOW.md in our open-source repo. We'd love to collaborate on your custom tool extension.\n\nBest,\nCore Team`,
      },
      action: {
        think: `[DeepSeek-R1 思考过程]\n1. 行动清单提取。`,
        content: `📋 【提取行动清单】\n• [技术对接] 发送 docs/AGENT_WORKFLOW.md MCP 协议规范给 Sarah\n• [合规背书] 整理 GDPR 零数据出境合规说明文档`,
      },
      translate: {
        think: `[DeepSeek-R1 思考过程]\n1. 英文转中文。`,
        content: `团队好，\n我们正在规范内部通信工具，并在 macOS 和 Linux 上测试了 oh-ai-email。其零遥测架构与离线 DeepSeek R1 集成完全符合我们的 GDPR 隐私标准。请问能否分享自定义 MCP 工具服务的接入规范？`,
      },
    },
  },
};

let currentScenarioKey = "arch";
let currentActionKey = "summary";
let isThinkingEnabled = true;

const mailCards = document.querySelectorAll(".mail-card");
const readerTitle = document.getElementById("reader-title");
const readerMeta = document.getElementById("reader-meta");
const readerBody = document.getElementById("reader-body");

const actionChips = document.querySelectorAll(".action-chip");
const thinkingBlock = document.getElementById("thinking-block");
const outputText = document.getElementById("capsule-output-text");
const thinkToggle = document.getElementById("toggle-think");

const copyBtn = document.getElementById("copy-btn");
const toast = document.getElementById("app-toast");

let typingInterval = null;

function renderScenario(key) {
  const data = scenarios[key];
  if (!data) return;

  if (readerTitle) readerTitle.textContent = data.title;
  if (readerMeta) readerMeta.textContent = `发件人：${data.sender} · ${data.time}`;
  if (readerBody) readerBody.textContent = data.body;

  triggerAiAction(currentActionKey);
}

function triggerAiAction(action) {
  currentActionKey = action;
  const data = scenarios[currentScenarioKey];
  const aiData = data.aiOutputs[action] || data.aiOutputs.summary;

  // Show thinking if enabled
  if (isThinkingEnabled && thinkingBlock) {
    thinkingBlock.textContent = aiData.think;
    thinkingBlock.classList.add("show");
  } else if (thinkingBlock) {
    thinkingBlock.classList.remove("show");
  }

  // Stream text typing
  if (typingInterval) clearInterval(typingInterval);
  if (!outputText) return;
  outputText.textContent = "";
  let idx = 0;
  const fullText = aiData.content;
  typingInterval = setInterval(() => {
    if (idx < fullText.length) {
      outputText.textContent += fullText.charAt(idx);
      idx++;
    } else {
      clearInterval(typingInterval);
    }
  }, 10);
}

// Mail item switching
mailCards.forEach((card) => {
  card.addEventListener("click", () => {
    mailCards.forEach((c) => c.classList.remove("selected"));
    card.classList.add("selected");
    const key = card.getAttribute("data-key");
    if (key && scenarios[key]) {
      currentScenarioKey = key;
      renderScenario(key);
    }
  });
});

// AI Action Chips
actionChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    actionChips.forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
    const action = chip.getAttribute("data-action");
    if (action) triggerAiAction(action);
  });
});

// Thinking Toggle
thinkToggle?.addEventListener("change", (e) => {
  isThinkingEnabled = e.target.checked;
  triggerAiAction(currentActionKey);
});

// Copy button
copyBtn?.addEventListener("click", () => {
  if (outputText && outputText.textContent) {
    navigator.clipboard
      .writeText(outputText.textContent)
      .then(() => {
        showToast("已成功复制 AI 生成结果到剪贴板！");
      })
      .catch(() => {
        showToast("复制成功！");
      });
  }
});

function showToast(msg) {
  if (!toast) return;
  toast.textContent = msg;
  toast.style.opacity = "1";
  toast.style.transform = "translateY(0)";
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(10px)";
  }, 2500);
}

// FAQ Accordion
const faqItems = document.querySelectorAll(".faq-item");
faqItems.forEach((item) => {
  const q = item.querySelector(".faq-question");
  q?.addEventListener("click", () => {
    const isOpen = item.classList.contains("open");
    faqItems.forEach((i) => i.classList.remove("open"));
    if (!isOpen) {
      item.classList.add("open");
    }
  });
});

// Initialize on page load
renderScenario("arch");
