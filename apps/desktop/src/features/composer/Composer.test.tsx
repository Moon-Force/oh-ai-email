import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Composer from "./Composer";
import { buildReplyQuote } from "./quote";
import AppThemeProvider from "../../theme/AppThemeProvider";
import AppToast from "../shell/AppToast";
import { useToastStore } from "../shell/toastStore";
import { useMailStore } from "../mail/store";

function wrap(ui: React.ReactElement) {
  return (
    <AppThemeProvider mode="light">
      <AppToast />
      {ui}
    </AppThemeProvider>
  );
}

beforeEach(() => {
  useToastStore.setState({ toast: null });
});

test("buildReplyQuote", () => {
  expect(buildReplyQuote("a@b.com", "hi\nthere")).toBe("On behalf of a@b.com:\n> hi\n> there");
});

test("validates recipient and shows error toast", async () => {
  const user = userEvent.setup();
  const onSend = vi.fn();
  render(wrap(<Composer onSend={onSend} />));
  await user.click(screen.getByRole("button", { name: "发送" }));
  expect(await screen.findByTestId("app-toast")).toHaveTextContent("收件人不正确");
  expect(useToastStore.getState().toast?.severity).toBe("error");
});

test("sends and shows success toast", async () => {
  const user = userEvent.setup();
  const onSend = vi.fn();
  render(wrap(<Composer onSend={onSend} />));
  await user.type(screen.getByLabelText("收件人"), "x@y.com");
  // TipTap body is optional for send
  await user.click(screen.getByRole("button", { name: "发送" }));
  expect(await screen.findByTestId("app-toast")).toBeInTheDocument();
  expect(await screen.findByText(/已发送/)).toBeInTheDocument();
  expect(onSend).toHaveBeenCalledWith(expect.objectContaining({ to: "x@y.com" }));
  expect(useToastStore.getState().toast?.severity).toBe("success");
});

test("save draft shows toast and stores local draft", async () => {
  const user = userEvent.setup();
  const onClose = vi.fn();
  useMailStore.setState({
    folders: [
      { id: "role:inbox", role: "inbox", name: "收件箱", unread: 0 },
      { id: "role:drafts", role: "drafts", name: "草稿", unread: 0 },
    ],
    messages: [],
    activeFolderId: "inbox",
    composeOpen: true,
    view: "mail",
  });
  render(wrap(<Composer onClose={onClose} initialSubject="草稿主题" />));
  await user.type(screen.getByLabelText("收件人"), "draft@example.com");
  await user.click(screen.getByRole("button", { name: "存草稿" }));
  expect(await screen.findByText(/草稿已保存/)).toBeInTheDocument();
  expect(useToastStore.getState().toast?.severity).toBe("success");
  expect(onClose).toHaveBeenCalled();
  const state = useMailStore.getState();
  expect(state.activeFolderId).toBe("drafts");
  expect(state.composeOpen).toBe(false);
  expect(state.messages.some((m) => m.subject === "草稿主题" && m.folderRole === "drafts")).toBe(
    true
  );
});

test("shows rich text editor and attachment controls", async () => {
  render(wrap(<Composer />));
  expect(screen.getByTestId("attachment-input")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "添加附件" })).toBeInTheDocument();
  // Editor mounts after compose enter animation delay
  expect(await screen.findByTestId("rich-text-editor", {}, { timeout: 2000 })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "粗体" })).toBeInTheDocument();
});

test("shows pre-send check dialog when attachment is missing and proceeds on confirmation", async () => {
  const user = userEvent.setup();
  const onSend = vi.fn();
  render(
    wrap(
      <Composer
        onSend={onSend}
        initialTo="client@example.com"
        initialSubject="设计稿请查收"
        initialBody="请查收附件中的最新方案。"
      />
    )
  );

  await user.click(screen.getByRole("button", { name: "发送" }));

  // Should show the pre-send check dialog instead of sending immediately
  expect(await screen.findByTestId("presend-check-dialog")).toBeInTheDocument();
  expect(screen.getByText("发信前检查提醒")).toBeInTheDocument();
  expect(screen.getByText("可能遗漏附件")).toBeInTheDocument();
  expect(onSend).not.toHaveBeenCalled();

  // Click "仍然发送" to force send
  await user.click(screen.getByTestId("presend-proceed-btn"));
  expect(onSend).toHaveBeenCalledWith(
    expect.objectContaining({
      to: "client@example.com",
      subject: "设计稿请查收",
    })
  );
});

test("can dismiss pre-send check dialog to return and edit", async () => {
  const user = userEvent.setup();
  const onSend = vi.fn();
  render(
    wrap(
      <Composer
        onSend={onSend}
        initialTo="client@example.com"
        initialSubject="修改收款账户"
        initialBody="请汇款到新账号。"
      />
    )
  );

  await user.click(screen.getByRole("button", { name: "发送" }));

  expect(await screen.findByTestId("presend-check-dialog")).toBeInTheDocument();
  expect(screen.getByText("涉及资金/转账敏感信息")).toBeInTheDocument();

  // Click "返回修改"
  await user.click(screen.getByText("返回修改"));
  await waitFor(() => {
    expect(screen.queryByTestId("presend-check-dialog")).not.toBeInTheDocument();
  });
  expect(onSend).not.toHaveBeenCalled();
});

test("opens AI write dialog and shows voice input button", async () => {
  const user = userEvent.setup();
  render(wrap(<Composer />));
  await user.click(screen.getByRole("button", { name: "AI 根据提示生成" }));
  expect(screen.getByText("根据提示生成正文")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "语音输入" })).toBeInTheDocument();
});
