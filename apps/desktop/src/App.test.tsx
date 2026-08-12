import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { useMailStore } from "./features/mail/store";

function resetStore() {
  useMailStore.setState({
    selectedId: "1",
    activeFolderId: "inbox",
    split: "important",
    searchQuery: "",
    view: "mail",
    composeOpen: false,
    connectionError: null,
  });
}

beforeEach(() => {
  resetStore();
  document.documentElement.setAttribute("data-theme", "light");
});

describe("App shell · MUI", () => {
  it("renders sidebar, topbar, and mail panes", () => {
    render(<App />);
    expect(screen.getByTestId("app-shell")).toBeInTheDocument();
    expect(screen.getByTestId("sidebar")).toBeInTheDocument();
    expect(screen.getByTestId("topbar")).toBeInTheDocument();
    expect(screen.getByText("oh-ai-email")).toBeInTheDocument();
    expect(screen.getAllByText("收件箱").length).toBeGreaterThan(0);
    expect(screen.getByTitle("mail-body")).toBeInTheDocument();
  });

  it("toggles light / dark theme", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByLabelText(/切换深色|切换浅色/));
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("shows Lumen Capsule", () => {
    render(<App />);
    expect(screen.getByTestId("lumen-capsule")).toBeInTheDocument();
  });

  it("opens compose from top bar", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /写新邮件/ }));
    expect(screen.getByTestId("composer")).toBeInTheDocument();
    expect(screen.getByLabelText("收件人")).toBeInTheDocument();
  });

  it("navigates to settings and AI tab", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "设置" }));
    expect(screen.getByTestId("settings")).toBeInTheDocument();
    expect(screen.getByText("AI 模式")).toBeInTheDocument();
  });

  it("filters list by search query", async () => {
    const user = userEvent.setup();
    render(<App />);
    const search = screen.getByLabelText("搜索邮件");
    await user.type(search, "定价");
    const list = screen.getByTestId("message-list");
    expect(within(list).getByText(/定价页反馈/)).toBeInTheDocument();
    expect(within(list).queryByText(/Q3 发布物料/)).not.toBeInTheDocument();
  });

  it("switches split filter to 其他", async () => {
    const user = userEvent.setup();
    render(<App />);
    const sidebar = screen.getByTestId("sidebar");
    await user.click(within(sidebar).getByText("其他"));
    expect(screen.getByText(/合同签字提醒/)).toBeInTheDocument();
  });

  it("shows connection banner when error is set", () => {
    useMailStore.setState({ connectionError: "认证失败：请检查密码或应用专用密码" });
    render(<App />);
    expect(screen.getByTestId("connection-banner")).toBeInTheDocument();
    expect(screen.getByText(/认证失败/)).toBeInTheDocument();
  });
});
