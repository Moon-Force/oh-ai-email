import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Composer, { buildReplyQuote } from "./Composer";
import AppThemeProvider from "../../theme/AppThemeProvider";

function wrap(ui: React.ReactElement) {
  return <AppThemeProvider mode="light">{ui}</AppThemeProvider>;
}

test("buildReplyQuote", () => {
  expect(buildReplyQuote("a@b.com", "hi\nthere")).toBe("On behalf of a@b.com:\n> hi\n> there");
});

test("validates recipient and sends", async () => {
  const user = userEvent.setup();
  const onSend = vi.fn();
  render(wrap(<Composer onSend={onSend} />));
  await user.click(screen.getByRole("button", { name: "发送" }));
  expect(await screen.findByText("收件人不正确")).toBeInTheDocument();
  await user.type(screen.getByLabelText("收件人"), "x@y.com");
  await user.click(screen.getByRole("button", { name: "发送" }));
  expect(await screen.findByText("已发送（本地模拟）")).toBeInTheDocument();
  expect(onSend).toHaveBeenCalledWith(expect.objectContaining({ to: "x@y.com" }));
});

test("save draft status", async () => {
  const user = userEvent.setup();
  render(wrap(<Composer />));
  await user.click(screen.getByRole("button", { name: "存草稿" }));
  expect(await screen.findByText(/草稿已保存/)).toBeInTheDocument();
});
