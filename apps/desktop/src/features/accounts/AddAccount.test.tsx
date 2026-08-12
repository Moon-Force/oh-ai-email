import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AddAccount from "./AddAccount";
import AppThemeProvider from "../../theme/AppThemeProvider";

function wrap(ui: React.ReactElement) {
  return <AppThemeProvider mode="light">{ui}</AppThemeProvider>;
}

test("selecting QQ fills IMAP/SMTP presets", async () => {
  const user = userEvent.setup();
  render(wrap(<AddAccount />));
  const picker = screen.getByTestId("provider-picker");
  await user.click(within(picker).getByText("QQ 邮箱"));
  expect(screen.getByText(/imap\.qq\.com:993/i)).toBeInTheDocument();
  expect(screen.getByText(/smtp\.qq\.com:465/i)).toBeInTheDocument();
});

test("typing 163 email auto-selects provider", async () => {
  const user = userEvent.setup();
  render(wrap(<AddAccount />));
  await user.type(screen.getByPlaceholderText("you@qq.com"), "demo@163.com");
  expect(screen.getByText(/imap\.163\.com:993/i)).toBeInTheDocument();
  expect(screen.getByRole("option", { name: "163 邮箱", selected: true })).toBeInTheDocument();
});

test("validates and adds with password", async () => {
  const user = userEvent.setup();
  render(wrap(<AddAccount />));
  await user.click(within(screen.getByTestId("provider-picker")).getByText("QQ 邮箱"));
  await user.type(screen.getByPlaceholderText("you@qq.com"), "a@qq.com");
  await user.type(screen.getByPlaceholderText(/授权码/), "auth-code-123");
  await user.click(screen.getByText("添加"));
  expect(await screen.findByText(/已添加/)).toBeInTheDocument();
});

test("shows error for bad email", async () => {
  const user = userEvent.setup();
  render(wrap(<AddAccount />));
  await user.type(screen.getByPlaceholderText("you@qq.com"), "bad");
  await user.type(screen.getByPlaceholderText(/授权码/), "x");
  await user.click(screen.getByText("测试连接"));
  expect(await screen.findByText(/邮箱格式不正确/)).toBeInTheDocument();
});
