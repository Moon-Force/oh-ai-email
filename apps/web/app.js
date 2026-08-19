const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const menuBtn = $("#menu-btn");
const menuOverlay = $("#menu-overlay");

menuBtn?.addEventListener("click", () => {
  const open = menuOverlay?.classList.toggle("open");
  menuBtn.classList.toggle("open", !!open);
  menuBtn.setAttribute("aria-expanded", String(!!open));
  menuOverlay?.setAttribute("aria-hidden", String(!open));
});

menuOverlay?.querySelectorAll("a").forEach((a) =>
  a.addEventListener("click", () => {
    menuOverlay.classList.remove("open");
    menuBtn.classList.remove("open");
    menuBtn.setAttribute("aria-expanded", "false");
  }),
);

const prompts = [
  "帮我总结这封长邮件的核心要点，并列出我需要完成的待办事项",
  "帮我用诚恳、专业的语气写一封商务合作确认回信",
  "把这封海外客户的英文需求邮件翻译成中文，并生成地道英文回复",
  "启动 AI Agent：找出今天的会议安排，提取时间地点并生成日历日程",
  "用智能体工作流批量整理收件箱，把重要邮件与一般邮件分开分箱",
];

const promptEl = $("#hero-prompt-text");
const heroInput = $("#hero-input");
const heroSend = $("#hero-send");
let promptIdx = 0;

function typePrompt() {
  if (!promptEl) return;
  const target = prompts[promptIdx];
  let i = 0;
  promptEl.textContent = "";
  heroInput?.classList.remove("has-text");

  const timer = setInterval(() => {
    i++;
    promptEl.textContent = target.slice(0, i);
    if (i >= target.length) {
      clearInterval(timer);
      heroInput?.classList.add("has-text");
      setTimeout(() => {
        promptIdx = (promptIdx + 1) % prompts.length;
        setTimeout(typePrompt, 1000);
      }, 3800);
    }
  }, 45);
}

typePrompt();

const scrollToDownload = () =>
  $("#download")?.scrollIntoView({ behavior: "smooth" });

heroSend?.addEventListener("click", (e) => {
  e.stopPropagation();
  scrollToDownload();
});

heroInput?.addEventListener("click", scrollToDownload);

const scenarios = {
  project: {
    sender: "张经理 (产品研发部) <zhang.pm@company.com>",
    time: "10:30",
    title: "【重要】新版产品上线排期与各部门配合事项",
    body: `各位同事好：\n经过团队两周的集中攻坚，新版本的主流程已全部完成自测。下周二下午 3 点我们将正式开启全量上线。\n\n为了确保平稳发布，请市场组在周五前准备好发版推文与海报；请客服组周一前完成常见问题手册更新；研发组请做好发布当天的监控值班安排。\n\n感谢大家的辛苦付出！\n张经理`,
    aiOutputs: {
      summary: {
        think: `[AI 思考中] 正在分析邮件重点...\n• 核心事件：新版本下周二 15:00 正式上线。\n• 待办分工：市场组（周五前）、客服组（周一前）、研发组（上线值班）。`,
        content: `📌 【邮件速览】\n1. 上线时间：下周二 15:00 全量发布新版本。\n2. 各组分工：\n   • 市场组：周五前备好宣发材料\n   • 客服组：周一前更新答疑手册\n   • 研发组：做好上线当天值班监控`,
      },
      reply: {
        think: `[AI 思考中] 拟定专业得体的确认回复...`,
        content: `张经理好，\n\n收到上线排期通知。我们团队的相关准备工作已就绪，会按时在周五前完成对接，并全力配合下周二的正式发布。\n\n祝好！`,
      },
      action: {
        think: `[AI 思考中] 提取待办清单与截止时间...`,
        content: `📋 【提取待办清单】\n• [待办 | 周五前] 市场组提交宣发文案与海报素材\n• [待办 | 周一前] 客服组完成客服问答手册更新\n• [日程 | 下周二 15:00] 参加新版本上线发布与值班保障`,
      },
      translate: {
        think: `[AI 思考中] 译为地道商务英文...`,
        content: `Hi Team,\nThe new release is scheduled for next Tuesday at 3:00 PM. Marketing materials should be ready by Friday, customer support FAQs updated by Monday, and engineering on-call support prepared for launch day.`,
      },
    },
  },
  client: {
    sender: "王总 (星云科技) <wang@nebulatech.cn>",
    time: "09:15",
    title: "关于年度企业服务方案与合作意向沟通",
    body: `您好：\n在行业展会上了解到贵团队的 AI 效率工具，体验非常出色。我们公司目前有 300+ 员工，希望在内部全面升级邮件与知识协同工具。\n\n请问下周方便安排一次 30 分钟的线上沟通吗？想进一步了解部署方案与企业采购优惠。\n\n星云科技 · 王总`,
    aiOutputs: {
      summary: {
        think: `[AI 思考中] 客户合作咨询，意向强烈（300人规模企业），约下周线上会谈。`,
        content: `📌 【合作邀约摘要】\n1. 来信人：星云科技王总（300+ 团队规模）。\n2. 意图：希望为全员采购部署 AI 办公工具，邀请下周线上沟通 30 分钟了解企业方案。`,
      },
      reply: {
        think: `[AI 思考中] 拟定热情诚恳、提供明确时间选项的商务回信...`,
        content: `王总您好，\n\n非常感谢您对我们产品的关注与认可！我们非常期待与星云科技的合作。\n\n下周二上午 10:00 或周三下午 14:30 都可以，请问哪个时段方便？我将为您准备定制的企业版演示与专属方案。\n\n祝商祺！\n商务团队`,
      },
      action: {
        think: `[AI 思考中] 提取跟进行动...`,
        content: `📋 【待办备忘】\n• [沟通] 确认王总线上会议的具体时间\n• [材料] 准备针对 300 人团队的企业级定制介绍与报价方案`,
      },
      translate: {
        think: `[AI 思考中] 英文版本...`,
        content: `Hello Mr. Wang,\nThank you for reaching out. We would be delighted to schedule a 30-minute online meeting next week to introduce our enterprise deployment and customized offerings for your team.`,
      },
    },
  },
  global: {
    sender: "Emma Watson (Design Lab) <emma@designlab.co>",
    time: "昨天",
    title: "Feedback on the new UI & Collaboration Proposal",
    body: `Hi Team,\nI've been using your AI email client for the past two weeks. The distraction-free interface and offline privacy mode are absolute game-changers for my daily workflow.\n\nOur studio would love to feature your app in our upcoming Design Trends 2026 report. Could you share some high-res brand screenshots?\n\nBest,\nEmma`,
    aiOutputs: {
      summary: {
        think: `[AI 思考中] 海外设计师 Emma 来信表扬 UI 与离线隐私，邀请参与 2026 设计趋势报告，索取高清素材。`,
        content: `📌 【海外来信中文摘要】\n1. 用户反馈：设计师 Emma 高度评价极简界面与离线隐私保护体验。\n2. 合作邀请：希望在《2026 设计趋势报告》中推荐本产品，需要提供高清产品截图。`,
      },
      reply: {
        think: `[AI 思考中] 拟定自然礼貌的英文回信...`,
        content: `Hi Emma,\n\nThank you so much for the lovely feedback! We are thrilled to hear that the app helps your daily workflow.\nWe would love to be part of your report. I have attached the high-res press kit and screenshots for you.\n\nBest regards,\nCore Team`,
      },
      action: {
        think: `[AI 思考中] 提取待办...`,
        content: `📋 【提取行动】\n• [素材] 整理并发送品牌高清设计素材包给 Emma`,
      },
      translate: {
        think: `[AI 思考中] 译为中文对照...`,
        content: `你好团队：我过去两周一直在使用你们的 AI 邮件客户端。清爽无打扰的界面和离线隐私体验彻底改变了我的日常工作。我们工作室很想在即将发布的《2026 设计趋势报告》中推荐你们，请问能否分享一些高清截图？祝好，Emma`,
      },
    },
  },
};

let currentScenarioKey = "project";
let currentActionKey = "summary";
let isThinkingEnabled = true;

const threadItems = $$(".thread-item");
const readerTitle = $("#reader-subject-text");
const readerMeta = $("#reader-meta-text");
const readerBody = $("#reader-body-text");
const agentChips = $$(".agent-chip");
const thinkingPanel = $("#thinking-panel");
const outputBox = $("#copilot-output");
const thinkToggle = $("#toggle-think");
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

  if (isThinkingEnabled && thinkingPanel) {
    thinkingPanel.textContent = aiData.think;
    thinkingPanel.classList.add("active");
  } else if (thinkingPanel) {
    thinkingPanel.classList.remove("active");
  }

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

function initHeroUnicorn() {
  const stage = document.querySelector(".hero-stage");
  const host = document.getElementById("hero-unicorn");
  if (!stage || !host) return;

  const fail = () => stage.classList.add("no-webgl");

  if (typeof UnicornStudio === "undefined") {
    fail();
    return;
  }

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    fail();
    return;
  }

  let webgl2 = false;
  try {
    webgl2 = !!document.createElement("canvas").getContext("webgl2");
  } catch {
    webgl2 = false;
  }
  if (!webgl2) {
    fail();
    return;
  }

  UnicornStudio.addScene({
    filePath: "hero-scene.json",
    element: host,
    fps: 30,
    dpi: 1,
    scale: 0.75,
    altText: "oh-ai-email 动态背景",
    ariaLabel: "oh-ai-email 动态背景",
  }).catch(fail);
}

initHeroUnicorn();

const faqRows = $$(".faq-row");
faqRows.forEach((row) => {
  const q = row.querySelector(".faq-q");
  q?.addEventListener("click", () => {
    const isActive = row.classList.contains("active");
    faqRows.forEach((r) => r.classList.remove("active"));
    if (!isActive) row.classList.add("active");
  });
});

if ("IntersectionObserver" in window) {
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0, rootMargin: "0px 0px -8% 0px" },
  );
  $$(".reveal").forEach((el) => revealObserver.observe(el));
} else {
  $$(".reveal").forEach((el) => el.classList.add("in"));
}

const cursorDot = $(".cursor-dot");
const cursorRing = $(".cursor-ring");
if (
  cursorDot &&
  cursorRing &&
  window.matchMedia("(pointer: fine)").matches
) {
  document.documentElement.classList.add("custom-cursor");
  const snap = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let mx = -100;
  let my = -100;
  let rx = -100;
  let ry = -100;

  const showCursor = () => {
    if (!document.body.classList.contains("cursor-visible")) {
      rx = mx;
      ry = my;
      document.body.classList.add("cursor-visible");
    }
  };

  document.addEventListener("mousemove", (e) => {
    mx = e.clientX;
    my = e.clientY;
    showCursor();
    cursorDot.style.transform = `translate(${mx - cursorDot.offsetWidth / 2}px, ${my - cursorDot.offsetHeight / 2}px)`;
  });

  document.documentElement.addEventListener("mouseleave", () => {
    document.body.classList.remove("cursor-visible");
  });

  const hoverSelector =
    "a, button, [role='button'], input, label, .thread-item, .faq-q";
  document.addEventListener("mouseover", (e) => {
    const interactive = e.target.closest(hoverSelector);
    document.body.classList.toggle("cursor-hover", !!interactive);
  });

  const trackRing = () => {
    const k = snap ? 1 : 0.16;
    rx += (mx - rx) * k;
    ry += (my - ry) * k;
    cursorRing.style.transform = `translate(${rx - cursorRing.offsetWidth / 2}px, ${ry - cursorRing.offsetHeight / 2}px)`;
    requestAnimationFrame(trackRing);
  };
  requestAnimationFrame(trackRing);
}

renderCurrentScenario();
