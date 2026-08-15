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

