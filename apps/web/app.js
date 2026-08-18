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
  "检查当前写信草稿，看看是否遗漏了附件或写错了收件人称呼",
  "帮我将这封重要的邮件推迟到明天上午 9 点再提醒我处理",
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

function initHeroLens() {
  const canvas = document.getElementById("hero-canvas");
  const stage = canvas?.parentElement;
  if (!canvas || !stage) return;

  const gl = canvas.getContext("webgl", {
    antialias: false,
    alpha: false,
    powerPreference: "high-performance",
  });
  if (!gl) {
    stage.classList.add("no-webgl");
    canvas.remove();
    return;
  }

  const TEX_W = 2048;
  const TEX_H = 512;
  const FONT_PX = 320;
  const texCanvas = document.createElement("canvas");
  texCanvas.width = TEX_W;
  texCanvas.height = TEX_H;
  const tg = texCanvas.getContext("2d");
  tg.fillStyle = "#000";
  tg.fillRect(0, 0, TEX_W, TEX_H);
  tg.font = `700 ${FONT_PX}px -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif`;
  tg.textBaseline = "middle";
  const label = "oh-ai-email";
  const tw = tg.measureText(label).width;
  const cx = (TEX_W - tw) / 2;
  const cy = TEX_H / 2 + 10;
  tg.filter = "blur(3px)";
  tg.fillStyle = "rgba(255, 0, 0, 0.25)";
  tg.fillText(label, cx, cy + 3);
  tg.fillStyle = "rgba(0, 0, 255, 0.25)";
  tg.fillText(label, cx, cy - 3);
  tg.fillStyle = "rgba(255, 255, 255, 0.55)";
  tg.fillText(label, cx, cy);
  tg.filter = "none";
  tg.globalCompositeOperation = "multiply";
  tg.fillStyle = "rgba(0, 0, 0, 0.5)";
  for (let y = 0; y < TEX_H; y += 3) tg.fillRect(0, y, TEX_W, 1);
  tg.globalCompositeOperation = "source-over";

  const vsSrc = "attribute vec2 aPos; void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }";
  const fsSrc = `
    precision highp float;
    uniform float uDpr;
    uniform float uTime;
    uniform float uSpeed;
    uniform vec2  uCenter;
    uniform float uRadius;
    uniform float uTile;
    uniform float uBandH;
    uniform sampler2D uTex;

    vec2 lensSrc(vec2 p, float power) {
      vec2 rel = p - uCenter;
      float d = length(rel);
      float t = d / uRadius;
      if (t >= 1.0) return p;
      float srcD = uRadius / pow(max(t, 0.03), power);
      vec2 dir = d > 1e-4 ? rel / d : vec2(1.0, 0.0);
      return uCenter + dir * srcD;
    }

    float sampleBg(vec2 p, float power) {
      vec2 s = lensSrc(p, power) + vec2(uSpeed * uTime, 0.0);
      float x = mod(s.x, uTile) / uTile;
      float y = 0.5 + (s.y - uCenter.y) / uBandH;
      return texture2D(uTex, vec2(x, y)).r;
    }

    void main() {
      vec2 p = gl_FragCoord.xy / uDpr;
      vec3 col;
      col.r = sampleBg(p, 1.08);
      col.g = sampleBg(p, 1.12);
      col.b = sampleBg(p, 1.16);

      vec2 rel = p - uCenter;
      float d = length(rel);
      float t = d / uRadius;
      col *= 0.3 + 0.7 * smoothstep(0.05, 0.8, t);

      float rimMod = 1.0 + 0.55 * (d > 1e-4 ? -rel.x / d : 0.0);
      float ring = exp(-pow((d - uRadius) / (uRadius * 0.045), 2.0));
      col += vec3(1.0) * ring * 0.55 * rimMod;
      float halo = exp(-max(d - uRadius, 0.0) / (uRadius * 0.55));
      col += vec3(1.0) * halo * 0.04;

      gl_FragColor = vec4(col, 1.0);
    }
  `;

  function compile(type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(sh));
      return null;
    }
    return sh;
  }

  const vs = compile(gl.VERTEX_SHADER, vsSrc);
  const fs = compile(gl.FRAGMENT_SHADER, fsSrc);
  if (!vs || !fs) {
    stage.classList.add("no-webgl");
    canvas.remove();
    return;
  }
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    stage.classList.add("no-webgl");
    canvas.remove();
    return;
  }
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, "aPos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texCanvas);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.activeTexture(gl.TEXTURE0);
  gl.uniform1i(gl.getUniformLocation(prog, "uTex"), 0);

  const U = {
    dpr: gl.getUniformLocation(prog, "uDpr"),
    time: gl.getUniformLocation(prog, "uTime"),
    speed: gl.getUniformLocation(prog, "uSpeed"),
    center: gl.getUniformLocation(prog, "uCenter"),
    radius: gl.getUniformLocation(prog, "uRadius"),
    tile: gl.getUniformLocation(prog, "uTile"),
    band: gl.getUniformLocation(prog, "uBandH"),
  };

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    gl.viewport(0, 0, canvas.width, canvas.height);
    const scale = Math.min(0.17 * w, 190) / FONT_PX;
    gl.uniform1f(U.dpr, dpr);
    gl.uniform2f(U.center, w / 2, h * 0.37);
    gl.uniform1f(U.radius, Math.min(0.36 * Math.min(w, h), 320));
    gl.uniform1f(U.tile, TEX_W * scale);
    gl.uniform1f(U.band, TEX_H * scale);
    gl.uniform1f(U.speed, reduced ? 0 : (TEX_W * scale) / 45);
  }
  resize();
  window.addEventListener("resize", resize);

  const t0 = performance.now();
  (function frame(now) {
    gl.uniform1f(U.time, (now - t0) / 1000);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    requestAnimationFrame(frame);
  })(t0);
}

initHeroLens();

const faqRows = $$(".faq-row");
faqRows.forEach((row) => {
  const q = row.querySelector(".faq-q");
  q?.addEventListener("click", () => {
    const isActive = row.classList.contains("active");
    faqRows.forEach((r) => r.classList.remove("active"));
    if (!isActive) row.classList.add("active");
  });
});

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("in");
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.12 },
);
$$(".reveal").forEach((el) => revealObserver.observe(el));

renderCurrentScenario();
