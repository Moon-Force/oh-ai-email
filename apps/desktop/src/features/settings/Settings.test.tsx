import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Settings from "./Settings";
import { useAiSettings } from "../ai/settingsStore";
import { usePrefsStore } from "./prefsStore";
import AppThemeProvider from "../../theme/AppThemeProvider";

vi.mock("../../lib/ipc", () => ({
  aiGetSettings: vi.fn(async () => ({
    mode: "cloud" as const,
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
    ollamaHost: "http://127.0.0.1:11434",
    ollamaModel: "llama3.2",
    cloudPrivacyAck: false,
    preferLocalWhenAvailable: false,
    hasCloudApiKey: false,
  })),
  aiSaveSettings: vi.fn(async (p: { mode?: string }) => ({
    mode: (p.mode as "cloud" | "local") ?? "cloud",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
    ollamaHost: "http://127.0.0.1:11434",
    ollamaModel: "llama3.2",
    cloudPrivacyAck: false,
    preferLocalWhenAvailable: false,
    hasCloudApiKey: false,
  })),
  aiProbeOllama: vi.fn(async () => ({ ok: false as const, error: "down" })),
  aiProbeCloud: vi.fn(async () => ({ ok: false as const, error: "no key" })),
  prefsGet: vi.fn(async () => ({ syncIntervalMin: 5 })),
  prefsSave: vi.fn(async (p: { syncIntervalMin?: number }) => ({
    syncIntervalMin: p.syncIntervalMin ?? 5,
  })),
}));

beforeEach(() => {
  useAiSettings.setState({
    mode: "cloud",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
    ollamaHost: "http://127.0.0.1:11434",
    ollamaModel: "llama3.2",
    preferLocalWhenAvailable: false,
    hasCloudApiKey: false,
    apiKeyDraft: "",
    cloudPrivacyAck: false,
    hydrated: true,
  });
  usePrefsStore.setState({ syncIntervalMin: 5, hydrated: true });
});

function wrap(ui: React.ReactElement) {
  return <AppThemeProvider mode="light">{ui}</AppThemeProvider>;
}

test("switches AI mode to local", async () => {
  const user = userEvent.setup();
  const onTheme = vi.fn();
  render(wrap(<Settings theme="light" onThemeChange={onTheme} />));
  await user.click(screen.getByRole("button", { name: "本机" }));
  expect(useAiSettings.getState().mode).toBe("local");
  await user.click(screen.getByRole("button", { name: "保存更改" }));
  expect(await screen.findByText("已保存")).toBeInTheDocument();
});

test("general tab toggles theme", async () => {
  const user = userEvent.setup();
  const onTheme = vi.fn();
  render(wrap(<Settings theme="light" onThemeChange={onTheme} />));
  await user.click(screen.getByText("通用"));
  await user.click(screen.getByRole("button", { name: "深色" }));
  expect(onTheme).toHaveBeenCalledWith("dark");
});

test("AI tab shows privacy data routing and audit section", () => {
  render(wrap(<Settings theme="light" onThemeChange={vi.fn()} />));
  expect(screen.getByTestId("settings-ai")).toBeInTheDocument();
  expect(screen.getByText(/数据去向/)).toBeInTheDocument();
  expect(screen.getByTestId("ai-audit-section")).toBeInTheDocument();
  expect(screen.getByText(/AI 调用与隐私审计/)).toBeInTheDocument();
});

test("general tab can change auto-sync interval", async () => {
  const user = userEvent.setup();
  render(wrap(<Settings theme="light" onThemeChange={vi.fn()} />));
  await user.click(screen.getByText("通用"));
  expect(screen.getByTestId("settings-general")).toBeInTheDocument();
  await user.click(screen.getByLabelText("自动同步频率"));
  await user.click(await screen.findByRole("option", { name: "每 15 分钟" }));
  expect(usePrefsStore.getState().syncIntervalMin).toBe(15);
  await user.click(screen.getByRole("button", { name: "保存通用设置" }));
  expect(await screen.findByText("已保存")).toBeInTheDocument();
});
