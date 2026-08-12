import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Settings from "./Settings";
import { useAiSettings } from "../ai/settingsStore";
import AppThemeProvider from "../../theme/AppThemeProvider";

beforeEach(() => {
  useAiSettings.setState({
    mode: "cloud",
    provider: "OpenAI 兼容",
    model: "gpt-4o-mini",
    preferLocalWhenAvailable: false,
  });
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
