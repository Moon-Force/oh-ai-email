// Theme toggle
const themeBtn = document.getElementById("theme-toggle");
let currentTheme = localStorage.getItem("theme") || "dark";
document.documentElement.setAttribute("data-theme", currentTheme);

themeBtn?.addEventListener("click", () => {
  currentTheme = currentTheme === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", currentTheme);
  localStorage.setItem("theme", currentTheme);
  updateThemeIcon();
});

function updateThemeIcon() {
  if (themeBtn) {
    themeBtn.textContent = currentTheme === "dark" ? "☀️" : "🌙";
  }
}
updateThemeIcon();

// Interactive AI Capsule Demo
const demoOutputs = {
  summary:
    "【AI 摘要】\n1. 针对本季度企业邮箱大容量存储与附件审计功能，技术团队已完成灰度测试。\n2. 预计下周二下午 15:00 组织跨部门上线评审会议。\n3. 需要您确认附件敏感词审计规则清单。",
  reply:
    "【快捷回复草稿】\n李总您好，\n收到关于本季度邮箱升级与审计规则的方案。我们已审核相关清单，原则上同意推进。下周二下午 15:00 的评审会议我将准时参会。\n\n祝好，\nTeam",
  action:
    "【行动项提取】\n• [待办] 确认附件敏感词审计规则清单（截止：周五前）\n• [日程] 参加跨部门上线评审会（时间：下周二 15:00）\n• [跟进] 确认灰度测试集群性能指标报告",
  translate:
    "【English Translation】\nHello Team,\nThe grayscale testing for enterprise mailbox high-capacity storage and attachment auditing is complete. The cross-department review is scheduled for next Tuesday at 15:00. Please confirm the sensitive word rule list.",
};

const outputEl = document.getElementById("capsule-output-text");
const buttons = document.querySelectorAll(".capsule-btn");

let typeTimer = null;
function typewrite(text) {
  if (!outputEl) return;
  if (typeTimer) clearInterval(typeTimer);
  outputEl.textContent = "";
  let i = 0;
  typeTimer = setInterval(() => {
    if (i < text.length) {
      outputEl.textContent += text.charAt(i);
      i++;
    } else {
      clearInterval(typeTimer);
    }
  }, 12);
}

buttons.forEach((btn) => {
  btn.addEventListener("click", () => {
    buttons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const key = btn.getAttribute("data-action");
    if (demoOutputs[key]) {
      typewrite(demoOutputs[key]);
    }
  });
});

// Initial typewrite
if (outputEl) {
  typewrite(demoOutputs.summary);
}
