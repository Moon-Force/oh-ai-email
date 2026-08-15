import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LumenCapsule from "./LumenCapsule";
import { useAiSettings } from "./settingsStore";
import AppThemeProvider from "../../theme/AppThemeProvider";

vi.mock("./router", async () => {
  const actual = await vi.importActual<typeof import("./router")>("./router");
  return {
    ...actual,
    summarize: vi.fn(async () => "【摘要】要点：Q3 launch"),
    draftReply: vi.fn(async () => "你好，这是回复草稿。"),
    rewriteTone: vi.fn(async (t: string) => `改写：${t}`),
    ensureCloudPrivacyAck: () => true,
    ackCloudPrivacy: vi.fn(async () => undefined),
  };
});

beforeEach(() => {
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
