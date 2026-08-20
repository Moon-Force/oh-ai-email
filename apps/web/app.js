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

const aiAnswers = [
  "已提炼 3 个要点：上线时间、物料准备、值班安排，并生成 2 条待办（周五前 / 周一前）。",
  "已起草回信：确认排期、承诺周五前完成物料对接，语气专业诚恳，可一键插入草稿箱。",
  "中文摘要已生成；英文回复采用地道商务表达，确认需求并附交付时间表。",
  "Agent 已解析 2 场会议：10:30 产品周会（线上）、15:00 客户评审（3 号会议室），日程待你确认。",
  "工作流已扫描 48 封邮件：12 封标记重要，36 封归入常规，3 封建议稍后处理。",
];

const promptEl = $("#hero-prompt-text");
const heroInput = $("#hero-input");
const heroSend = $("#hero-send");
let promptIdx = 0;

const aiRow = $("#hero-ai");
const aiText = $("#hero-ai-text");
let aiStreamTimer = null;

function hideAiMock() {
  if (aiStreamTimer) {
    clearInterval(aiStreamTimer);
    aiStreamTimer = null;
  }
  aiRow?.classList.remove("on");
  if (aiText) {
    aiText.textContent = "";
    aiText.classList.remove("hero-ai-thinking");
  }
}

function showAiMock(answer) {
  if (!aiRow || !aiText) return;
  aiText.classList.add("hero-ai-thinking");
  aiText.textContent = "AI 正在思考…";
  aiRow.classList.add("on");
  setTimeout(() => {
    aiText.classList.remove("hero-ai-thinking");
    let j = 0;
    aiStreamTimer = setInterval(() => {
      j++;
      aiText.textContent = answer.slice(0, j);
      if (j >= answer.length) {
        clearInterval(aiStreamTimer);
        aiStreamTimer = null;
      }
    }, 22);
  }, 950);
}

function typePrompt() {
  if (!promptEl) return;
  const target = prompts[promptIdx];
  let i = 0;
  promptEl.textContent = "";
  heroInput?.classList.remove("has-text");
  hideAiMock();

  const timer = setInterval(() => {
    i++;
    promptEl.textContent = target.slice(0, i);
    if (i >= target.length) {
      clearInterval(timer);
      heroInput?.classList.add("has-text");
      showAiMock(aiAnswers[promptIdx]);
      setTimeout(() => {
        promptIdx = (promptIdx + 1) % prompts.length;
        setTimeout(typePrompt, 1000);
      }, 4600);
    }
  }, 45);
}

typePrompt();

function initWebGLOrb(gl, dpr, reduced) {
  const vs = `#version 300 es
in vec2 aPos;
void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }`;

  const fs = `#version 300 es
// noise/flow math adapted from Unicorn Studio scene "Creating AI Animation (Remix)"
// (project 0Eca3WN2DNPAormHdsVR; used per user-declared authorization, attribution kept)
precision highp float;
out vec4 o;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uMouse;

vec3 hash3(vec2 p){
  vec3 q=vec3(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3)),dot(p,vec2(419.2,371.9)));
  return fract(sin(q)*43758.5453);
}
float voronoise(vec2 uv,float time,float scale,float phase){
  vec2 x=uv*scale;
  vec2 p=floor(x);
  vec2 f=fract(x);
  float va=0.0,wt=0.0;
  for(int j=-2;j<=2;j++)
  for(int i=-2;i<=2;i++){
    vec2 g=vec2(float(i),float(j));
    vec3 oo=hash3(p+g);
    oo.xy+=0.5*vec2(sin(time*0.1+phase+oo.x*6.28318),sin(time*0.07+phase*1.3+oo.y*6.28318));
    vec2 r=g-f+oo.xy;
    float dd=dot(r,r);
    float ww=pow(1.0-smoothstep(0.0,1.414,sqrt(dd)),1.0);
    va+=oo.z*ww;
    wt+=ww;
  }
  return va/max(wt,1e-5);
}
vec3 hash33(vec3 p3){
  p3=fract(p3*vec3(0.1031,0.11369,0.13787));
  p3+=dot(p3,p3.yxz+19.19);
  return -1.0+2.0*fract(vec3((p3.x+p3.y)*p3.z,(p3.x+p3.z)*p3.y,(p3.y+p3.z)*p3.x));
}
float perlin(vec3 p){
  vec3 pi=floor(p),pf=p-pi;
  vec3 w=pf*pf*(3.0-2.0*pf);
  float n000=dot(pf,hash33(pi));
  float n100=dot(pf-vec3(1,0,0),hash33(pi+vec3(1,0,0)));
  float n010=dot(pf-vec3(0,1,0),hash33(pi+vec3(0,1,0)));
  float n110=dot(pf-vec3(1,1,0),hash33(pi+vec3(1,1,0)));
  float n001=dot(pf-vec3(0,0,1),hash33(pi+vec3(0,0,1)));
  float n101=dot(pf-vec3(1,0,1),hash33(pi+vec3(1,0,1)));
  float n011=dot(pf-vec3(0,1,1),hash33(pi+vec3(0,1,1)));
  float n111=dot(pf-vec3(1,1,1),hash33(pi+vec3(1,1,1)));
  float nx00=mix(n000,n100,w.x),nx01=mix(n001,n101,w.x);
  float nx10=mix(n010,n110,w.x),nx11=mix(n011,n111,w.x);
  float nxy0=mix(nx00,nx10,w.y),nxy1=mix(nx01,nx11,w.y);
  return mix(nxy0,nxy1,w.z);
}

void main(){
  vec2 uv=(2.0*gl_FragCoord.xy-uRes)/uRes.y;
  float t=uTime;
  float aspect=uRes.x/uRes.y;
  vec2 m=(2.0*uMouse-uRes)/uRes.y;

  vec2 fuv=uv;
  vec2 mpos=m*0.18;
  float freq=5.0*0.41;
  float rad=360.0*4.617*3.14159265/180.0;
  float amt=0.016;
  for(int i=0;i<6;i++){
    vec2 s=(clamp(fuv,-1.,2.)-0.5)*vec2(aspect,1.0)+vec2(1.0,1.0)-mpos;
    float per=perlin(vec3((s-0.5)*freq,t*1.0))-0.5;
    float ang=per*rad;
    fuv+=vec2(cos(ang),sin(ang))*amt;
  }
  fuv=mix(uv,fuv,0.9);

  vec2 c=vec2(0.012*sin(t*0.5),0.008*cos(t*0.4));
  float R=0.48*(1.0+0.03*sin(t*1.1));
  vec2 p=uv-c;
  float d=length(p);
  vec2 nd=p/max(d,1e-4);

  float zz=sqrt(max(1.0-d*d/(R*R),0.0));
  vec3 n3=vec3(nd*(d/R),zz);
  vec3 L=normalize(vec3(-0.45,0.55,0.75));
  float diff=max(dot(n3,L),0.0);

  vec3 shadowC=vec3(0.34,0.12,0.52);
  vec3 litC=vec3(0.98,0.48,0.72);
  vec3 col=mix(shadowC,litC,smoothstep(0.0,1.0,diff*0.9+0.12));

  float nz=voronoise((fuv-c)*2.4+vec2(0.0,t*0.35),t,4.0,0.0);
  vec3 mid=vec3(0.60,0.26,0.62);
  vec3 amp=vec3(0.34,0.16,0.08);
  col=mix(col,mid+amp*cos(6.28318*nz),0.40);
  float nz2=voronoise((fuv-c)*4.2+vec2(-t*0.18,t*0.1),t,6.0,1.7);
  col=mix(col,mid+amp*0.7*cos(6.28318*nz2),0.18);

  float rim=pow(1.0-zz,4.0);
  col=mix(col,vec3(1.0,0.75,0.92),rim*0.55);

  vec3 Hv=normalize(L+vec3(0.0,0.0,1.0));
  float spec=pow(max(dot(n3,Hv),0.0),80.0);
  col+=vec3(1.0,0.97,1.0)*spec*0.85;

  float ballMask=smoothstep(R*1.015,R*0.985,d);

  vec3 haloCol=vec3(0.98,0.62,1.0);
  float glow=smoothstep(R*1.0,R*1.12,d)*(1.0-smoothstep(R*1.2,R*1.45,d));

  vec3 colOut=col*ballMask+haloCol*glow*0.5;
  float aOut=max(ballMask,glow*0.5);

  float vg=1.0-0.20*dot(uv*0.5,uv*0.5);
  o=vec4(colOut*aOut*clamp(vg,0.0,1.0),aOut);
}`;

  const prog = gl.createProgram();
  const mk = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error("orb shader:", gl.getShaderInfoLog(s));
    }
    gl.attachShader(prog, s);
  };
  mk(gl.VERTEX_SHADER, vs);
  mk(gl.FRAGMENT_SHADER, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error("orb program:", gl.getProgramInfoLog(prog));
    return;
  }
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "aPos");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const uRes = gl.getUniformLocation(prog, "uRes");
  const uTime = gl.getUniformLocation(prog, "uTime");
  const uMouse = gl.getUniformLocation(prog, "uMouse");

  orbCanvas.width = Math.round(76 * dpr);
  orbCanvas.height = Math.round(76 * dpr);
  gl.viewport(0, 0, orbCanvas.width, orbCanvas.height);

  const mouse = { x: orbCanvas.width / 2, y: orbCanvas.height / 2 };
  orbCanvas.addEventListener("pointermove", (e) => {
    const r = orbCanvas.getBoundingClientRect();
    mouse.x = ((e.clientX - r.left) / r.width) * orbCanvas.width;
    mouse.y = ((e.clientY - r.top) / r.height) * orbCanvas.height;
  });

  const draw = (t) => {
    gl.uniform2f(uRes, orbCanvas.width, orbCanvas.height);
    gl.uniform1f(uTime, reduced ? 0 : t / 1000);
    gl.uniform2f(uMouse, mouse.x, mouse.y);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (!reduced) requestAnimationFrame(draw);
  };
  draw(0);
}

const orbCanvas = $("#hero-ai-orb");
if (orbCanvas) {
  const orbReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const orbDpr = Math.min(window.devicePixelRatio || 1, 2);
  const orbGl = orbCanvas.getContext("webgl2", { alpha: true, preserveDrawingBuffer: true });
  if (orbGl) {
    orbCanvas.dataset.renderer = "webgl2";
    initWebGLOrb(orbGl, orbDpr, orbReduced);
  } else {
    const octx = orbCanvas.getContext("2d");
    orbCanvas.dataset.renderer = "canvas2d";
    if (octx) {
    const OS = 140;
    orbCanvas.width = OS * orbDpr;
    orbCanvas.height = OS * orbDpr;
    octx.setTransform(orbDpr, 0, 0, orbDpr, 0, 0);
    const OC = OS / 2;
    const OR = 33;

    const orbBlobs = [
      { r: OR * 0.55, a: 0.3, fx: 0.13, fy: 0.083, ph: 0.6, sw: 0.55, col: "244,114,182" },
      { r: OR * 0.5, a: 0.25, fx: 0.097, fy: 0.061, ph: 3.4, sw: -0.42, col: "129,140,248" },
      { r: OR * 0.45, a: 0.22, fx: 0.157, fy: 0.049, ph: 5.1, sw: 0.7, col: "56,189,248" },
      { r: OR * 0.4, a: 0.3, fx: 0.071, fy: 0.121, ph: 1.9, sw: -0.6, col: "235,240,255" },
    ];

    function drawOrb(t) {
      const time = orbReduced ? 0 : t / 1000;
      octx.clearRect(0, 0, OS, OS);

      const breathe = 1 + 0.025 * Math.sin(time * 1.1);
      const cy = OC + 2 * Math.sin(time * 0.5);
      const R = OR * 1.05 * breathe;

      const haloR = Math.min(OR * 1.5, OS * 0.48);
      const hg = octx.createRadialGradient(OC, cy, R * 0.7, OC, cy, haloR);
      hg.addColorStop(0, "rgba(230,110,220,0.3)");
      hg.addColorStop(0.6, "rgba(230,110,220,0.12)");
      hg.addColorStop(1, "rgba(230,110,220,0)");
      octx.fillStyle = hg;
      octx.beginPath();
      octx.arc(OC, cy, haloR, 0, 6.2832);
      octx.fill();

      const base = octx.createRadialGradient(OC - R * 0.35, cy - R * 0.42, R * 0.08, OC, cy, R * 1.02);
      base.addColorStop(0, "#ffd7ec");
      base.addColorStop(0.3, "#e56ba8");
      base.addColorStop(0.65, "#7a2f86");
      base.addColorStop(1, "#241040");
      octx.fillStyle = base;
      octx.beginPath();
      octx.arc(OC, cy, R, 0, 6.2832);
      octx.fill();

      octx.save();
      octx.beginPath();
      octx.arc(OC, cy, R, 0, 6.2832);
      octx.clip();
      for (const b of orbBlobs) {
        const ang = 6.2832 * b.sw * time + b.ph;
        const rad = OR * (0.25 + 0.3 * Math.sin(6.2832 * b.fx * time + b.ph));
        const bx = OC + Math.cos(ang) * rad;
        const by = cy + Math.sin(ang * 0.9 + 1.2) * rad * 0.85;
        const g = octx.createRadialGradient(bx, by, 0, bx, by, b.r);
        g.addColorStop(0, `rgba(${b.col},${b.a})`);
        g.addColorStop(1, `rgba(${b.col},0)`);
        octx.fillStyle = g;
        octx.fillRect(0, 0, OS, OS);
      }
      octx.restore();

      const rg = octx.createRadialGradient(OC, cy, R * 0.8, OC, cy, R * 1.0);
      rg.addColorStop(0, "rgba(255,190,230,0)");
      rg.addColorStop(0.82, "rgba(255,190,230,0)");
      rg.addColorStop(1, "rgba(255,205,240,0.6)");
      octx.fillStyle = rg;
      octx.beginPath();
      octx.arc(OC, cy, R, 0, 6.2832);
      octx.fill();

      const spx = OC - R * 0.36;
      const spy = cy - R * 0.42;
      const sp = octx.createRadialGradient(spx, spy, 0, spx, spy, R * 0.28);
      sp.addColorStop(0, "rgba(255,255,255,0.85)");
      sp.addColorStop(1, "rgba(255,255,255,0)");
      octx.fillStyle = sp;
      octx.beginPath();
      octx.arc(spx, spy, R * 0.28, 0, 6.2832);
      octx.fill();
    }

    if (orbReduced) {
      drawOrb(0);
    } else {
      const orbLoop = (t) => {
        drawOrb(t);
        requestAnimationFrame(orbLoop);
      };
      requestAnimationFrame(orbLoop);
    }
    }
  }
}

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

const heroPills = $$(".hero-pills .pill");
if (window.matchMedia("(pointer: fine)").matches) {
  heroPills.forEach((el) => {
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", (e.clientX - r.left).toFixed(1) + "px");
      el.style.setProperty("--my", (e.clientY - r.top).toFixed(1) + "px");
    });
  });
}
if (heroPills.length && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  const blobs = [
    { fx: 0.11, fy: 0.061, ax: 0.2, ay: 0.28, ph: 0.7, cx: 0.32, cy: 0.55 },
    { fx: 0.089, fy: 0.043, ax: 0.24, ay: 0.26, ph: 3.9, cx: 0.58, cy: 0.45 },
    { fx: 0.067, fy: 0.097, ax: 0.18, ay: 0.3, ph: 5.2, cx: 0.7, cy: 0.6 },
  ];
  const t0 = performance.now();
  const tick = (now) => {
    const t = (now - t0) / 1000;
    heroPills.forEach((el, pi) => {
      blobs.forEach((b, i) => {
        const off = pi * 2.4;
        const bx = b.cx + b.ax * Math.sin(2 * Math.PI * b.fx * t + b.ph + off);
        const by = b.cy + b.ay * Math.sin(2 * Math.PI * b.fy * t + b.ph * 1.7 + off);
        el.style.setProperty(`--f${i + 1}x`, (bx * 100).toFixed(2) + "%");
        el.style.setProperty(`--f${i + 1}y`, (by * 100).toFixed(2) + "%");
      });
    });
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

renderCurrentScenario();
