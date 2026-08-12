import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LumenCapsule from "./LumenCapsule";
import { useAiSettings } from "./settingsStore";
import AppThemeProvider from "../../theme/AppThemeProvider";

beforeEach(() => {
  useAiSettings.setState({ mode: "cloud" });
});

function wrap(ui: React.ReactElement) {
  return <AppThemeProvider mode="light">{ui}</AppThemeProvider>;
}

test("idle capsule shows 询问 AI and expands on summary", async () => {
  const user = userEvent.setup();
  render(wrap(<LumenCapsule body="hello world about Q3 launch assets" />));
  expect(screen.getByText("询问 AI")).toBeInTheDocument();
  await user.click(screen.getByText("总结这封"));
  expect(await screen.findByText(/【摘要】/)).toBeInTheDocument();
  expect(screen.getByText("复制")).toBeInTheDocument();
  expect(screen.getByTestId("lumen-capsule")).toHaveAttribute("data-state", "expanded");
});

test("draft path shows 插入草稿", async () => {
  const user = userEvent.setup();
  render(wrap(<LumenCapsule body="need a reply" />));
  await user.click(screen.getByText("写回复"));
  expect(await screen.findByText("插入草稿")).toBeInTheDocument();
});

test("local mode badge", () => {
  useAiSettings.setState({ mode: "local" });
  render(wrap(<LumenCapsule body="x" />));
  expect(screen.getByText("本机")).toBeInTheDocument();
});
