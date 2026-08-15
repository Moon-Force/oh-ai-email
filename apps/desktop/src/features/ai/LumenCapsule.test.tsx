import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LumenCapsule from "./LumenCapsule";
import { useAiSettings } from "./settingsStore";
import AppThemeProvider from "../../theme/AppThemeProvider";
import * as router from "./router";

vi.mock("./router", async () => {
  const actual = await vi.importActual<typeof import("./router")>("./router");
  return {
    ...actual,
    cancelRequest: vi.fn(async () => true),
    summarize: vi.fn(async () => "【摘要】要点：Q3 launch"),
    draftReply: vi.fn(async () => "你好，这是回复草稿。"),
    quickReplyDraft: vi.fn(async ({ replyType }: { replyType: string }) => `快捷回复：${replyType}`),
    extractActionItems: vi.fn(async () => ({
      tags: ["需回复", "有截止日期"],
      actionItems: ["审核设计稿", "安排会议"],
      deadline: "周五下午5点",
      mode: "cloud" as const,
    })),
    summarizeThread: vi.fn(async () => ({
      summary: "本次邮件线索关于项目上线排期进行了讨论并达成共识。",
      timeline: [
        { sender: "张三", date: "08-10 10:00", point: "发起关于上线排期的讨论" },
        { sender: "李四", date: "08-10 14:30", point: "建议推迟两天并增加测试环节" },
        { sender: "王五", date: "08-11 09:00", point: "确认最终排期为8月15日" },
      ],
      mode: "cloud" as const,
    })),
    suggestSplit: vi.fn(async () => ({
      split: "important" as const,
      reason: "包含高管明确的直接待办事项",
      confidence: "high" as const,
      mode: "cloud" as const,
    })),
    translateText: vi.fn(async () => "翻译：这是中文翻译结果。"),
    rewriteTone: vi.fn(async (t: string) => `改写：${t}`),
    ensureCloudPrivacyAck: () => true,
    ackCloudPrivacy: vi.fn(async () => undefined),
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  useAiSettings.setState({
    mode: "cloud",
    hasCloudApiKey: true,
    cloudPrivacyAck: true,
  });
});

function wrap(ui: React.ReactElement) {
  return <AppThemeProvider mode="light">{ui}</AppThemeProvider>;
}

test("idle capsule shows AI chip and expands on summary", async () => {
  const user = userEvent.setup();
  render(wrap(<LumenCapsule body="hello world about Q3 launch assets" />));
  expect(screen.getByText("AI")).toBeInTheDocument();
  await user.click(screen.getByText("总结"));
  expect(await screen.findByText(/【摘要】/)).toBeInTheDocument();
  expect(screen.getByText("复制")).toBeInTheDocument();
  expect(screen.getByTestId("lumen-capsule")).toHaveAttribute("data-state", "expanded");
});

test("shows quick reply chips and inserts draft on click", async () => {
  const user = userEvent.setup();
  const onInsertDraft = vi.fn();
  render(
    wrap(
      <LumenCapsule
        body="Let's meet tomorrow"
        subject="Project sync"
        from="boss@example.com"
        onInsertDraft={onInsertDraft}
      />,
    ),
  );

  expect(screen.getByTestId("quick-reply-chips")).toBeInTheDocument();
  expect(screen.getByText("收到谢谢")).toBeInTheDocument();
  expect(screen.getByText("确认推进")).toBeInTheDocument();
  expect(screen.getByText("稍后回复")).toBeInTheDocument();
  expect(screen.getByText("礼貌婉拒")).toBeInTheDocument();

  await user.click(screen.getByText("收到谢谢"));

  expect(router.quickReplyDraft).toHaveBeenCalledWith(
    expect.objectContaining({ replyType: "ack" }),
    expect.anything(),
  );
  expect(onInsertDraft).toHaveBeenCalledWith(
    "快捷回复：ack",
    "Re: Project sync",
    "boss@example.com",
  );
});

test("can cancel ongoing request in thinking state", async () => {
  let resolveSummarize: (v: string) => void = () => {};
  vi.mocked(router.summarize).mockImplementationOnce(
    () =>
      new Promise<string>((resolve) => {
        resolveSummarize = resolve;
      }),
  );

  const user = userEvent.setup();
  render(wrap(<LumenCapsule body="hello world" />));
  await user.click(screen.getByText("总结"));

  expect(screen.getByTestId("lumen-capsule")).toHaveAttribute("data-state", "thinking");
  const cancelBtn = screen.getByRole("button", { name: "取消 AI 请求" });
  expect(cancelBtn).toBeInTheDocument();

  await user.click(cancelBtn);
  expect(router.cancelRequest).toHaveBeenCalled();
  expect(screen.getByTestId("lumen-capsule")).toHaveAttribute("data-state", "idle");

  // Late resolution does not break state
  resolveSummarize("late result");
});

test("draft path shows 插入草稿", async () => {
  const user = userEvent.setup();
  render(wrap(<LumenCapsule body="need a reply" from="a@b.com" subject="Hi" />));
  await user.click(screen.getByText("写回复"));
  expect(await screen.findByText("插入草稿")).toBeInTheDocument();
});

test("local mode badge", () => {
  useAiSettings.setState({ mode: "local" });
  render(wrap(<LumenCapsule body="x" />));
  expect(screen.getByText("本机")).toBeInTheDocument();
});

test("blocks summary when no cloud key", async () => {
  const user = userEvent.setup();
  useAiSettings.setState({ mode: "cloud", hasCloudApiKey: false });
  render(wrap(<LumenCapsule body="x" />));
  await user.click(screen.getByText("总结"));
  expect(await screen.findByText(/未配置云端/)).toBeInTheDocument();
  expect(screen.getByTestId("lumen-capsule")).toHaveAttribute("data-state", "idle");
});

test("can cancel ongoing tone rewrite in thinking state and restore expanded state", async () => {
  let resolveRewrite: (v: string) => void = () => {};
  vi.mocked(router.rewriteTone).mockImplementationOnce(
    () =>
      new Promise<string>((resolve) => {
        resolveRewrite = resolve;
      }),
  );

  const user = userEvent.setup();
  render(wrap(<LumenCapsule body="hello world" />));
  await user.click(screen.getByText("总结"));
  expect(await screen.findByText(/【摘要】/)).toBeInTheDocument();

  await user.click(screen.getByText("更短一点"));
  expect(screen.getByTestId("lumen-capsule")).toHaveAttribute("data-state", "thinking");

  const cancelBtn = screen.getByRole("button", { name: "取消 AI 请求" });
  await user.click(cancelBtn);

  expect(router.cancelRequest).toHaveBeenCalled();
  // Returns to expanded state because text already exists
  expect(screen.getByTestId("lumen-capsule")).toHaveAttribute("data-state", "expanded");
  expect(screen.getByText(/【摘要】/)).toBeInTheDocument();

  resolveRewrite("late rewrite");
});

test("can extract action items, display intent tags, and check off items", async () => {
  const user = userEvent.setup();
  render(wrap(<LumenCapsule body="Please review designs by Friday 5pm and set up meeting" />));
  expect(screen.getByText("行动项")).toBeInTheDocument();

  await user.click(screen.getByText("行动项"));

  expect(await screen.findByText("行动项与意图")).toBeInTheDocument();
  expect(screen.getByText("需回复")).toBeInTheDocument();
  expect(screen.getByText("截止: 周五下午5点")).toBeInTheDocument();
  expect(screen.getByText("审核设计稿")).toBeInTheDocument();
  expect(screen.getByText("安排会议")).toBeInTheDocument();
  expect(screen.getByText("复制行动项")).toBeInTheDocument();

  const checkboxes = screen.getAllByRole("checkbox");
  expect(checkboxes).toHaveLength(2);
  expect(checkboxes[0]).not.toBeChecked();

  await user.click(checkboxes[0]);
  expect(checkboxes[0]).toBeChecked();
});

test("handles ABORTED error gracefully without displaying error message", async () => {
  vi.mocked(router.summarize).mockRejectedValueOnce(
    new router.AiRequestError("ABORTED", "Request aborted"),
  );

  const user = userEvent.setup();
  render(wrap(<LumenCapsule body="hello world" />));
  await user.click(screen.getByText("总结"));

  // Should return to idle without error message
  expect(screen.getByTestId("lumen-capsule")).toHaveAttribute("data-state", "idle");
  expect(screen.queryByText(/Request aborted/)).not.toBeInTheDocument();
});

test("shows 线程摘要 button when multiple threadMessages exist and renders timeline on click", async () => {
  const user = userEvent.setup();
  const threadMessages = [
    { sender: "张三", date: "08-10 10:00", body: "发起关于上线排期的讨论" },
    { sender: "李四", date: "08-10 14:30", body: "建议推迟两天并增加测试环节" },
    { sender: "王五", date: "08-11 09:00", body: "确认最终排期为8月15日" },
  ];

  render(
    wrap(
      <LumenCapsule
        subject="上线排期讨论"
        body="确认最终排期为8月15日"
        threadMessages={threadMessages}
      />,
    ),
  );

  const threadBtn = screen.getByTestId("thread-summary-button");
  expect(threadBtn).toBeInTheDocument();
  expect(threadBtn).toHaveTextContent("线程摘要");

  await user.click(threadBtn);

  expect(router.summarizeThread).toHaveBeenCalledWith(
    threadMessages,
    "上线排期讨论",
    expect.anything(),
  );

  expect(await screen.findByText("线索时间线摘要")).toBeInTheDocument();
  expect(screen.getByTestId("thread-overall-summary")).toBeInTheDocument();
  expect(screen.getByText(/本次邮件线索关于项目上线排期进行了讨论/)).toBeInTheDocument();

  expect(screen.getByTestId("thread-timeline-list")).toBeInTheDocument();
  expect(screen.getAllByTestId("timeline-item")).toHaveLength(3);
  expect(screen.getByText("张三")).toBeInTheDocument();
  expect(screen.getByText("08-10 10:00")).toBeInTheDocument();
  expect(screen.getByText("发起关于上线排期的讨论")).toBeInTheDocument();
  expect(screen.getByText("李四")).toBeInTheDocument();
  expect(screen.getByText("王五")).toBeInTheDocument();
  expect(screen.getByText("复制摘要")).toBeInTheDocument();
});

test("shows 建议分箱 button and applies split only upon user confirmation", async () => {
  const user = userEvent.setup();
  const onApplySplit = vi.fn();

  render(
    wrap(
      <LumenCapsule
        subject="重要会议"
        body="请务必参会讨论上线事宜"
        from="director@corp.com"
        onApplySplit={onApplySplit}
      />,
    ),
  );

  const suggestBtn = screen.getByTestId("suggest-split-button");
  expect(suggestBtn).toBeInTheDocument();
  expect(suggestBtn).toHaveTextContent("建议分箱");

  await user.click(suggestBtn);

  expect(router.suggestSplit).toHaveBeenCalled();
  expect(await screen.findByText("AI 分箱建议")).toBeInTheDocument();
  expect(screen.getByText(/包含高管明确的直接待办事项/)).toBeInTheDocument();

  // Split must NOT be applied automatically
  expect(onApplySplit).not.toHaveBeenCalled();

  // Click adopt button to apply
  const applyBtn = screen.getByTestId("apply-split-button");
  expect(applyBtn).toHaveTextContent(/采纳移至重要/);
  await user.click(applyBtn);

  expect(onApplySplit).toHaveBeenCalledWith("important");
});

test("shows 翻译 button and displays translated text", async () => {
  const user = userEvent.setup();

  render(
    wrap(
      <LumenCapsule
        subject="Meeting Agenda"
        body="Here is the agenda for tomorrow's team sync."
      />,
    ),
  );

  const translateBtn = screen.getByTestId("translate-button");
  expect(translateBtn).toBeInTheDocument();
  expect(translateBtn).toHaveTextContent("翻译");

  await user.click(translateBtn);

  expect(router.translateText).toHaveBeenCalled();
  expect(await screen.findByText("邮件翻译")).toBeInTheDocument();
  expect(screen.getByText(/这是中文翻译结果/)).toBeInTheDocument();
  expect(screen.getByText("复制")).toBeInTheDocument();
});



