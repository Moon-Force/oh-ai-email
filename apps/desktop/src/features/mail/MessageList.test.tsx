import { render, screen, within, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MessageList from "./MessageList";
import Reader from "./Reader";
import { useMailStore } from "./store";
import AppThemeProvider from "../../theme/AppThemeProvider";

function wrap(ui: React.ReactElement) {
  return <AppThemeProvider mode="light">{ui}</AppThemeProvider>;
}

beforeEach(() => {
  useMailStore.setState({
    selectedId: "1",
    activeFolderId: "inbox",
    split: "important",
    searchQuery: "",
    view: "mail",
    composeOpen: false,
  });
});

test("renders list and selects message into reader", async () => {
  const user = userEvent.setup();
  render(
    wrap(
      <>
        <MessageList />
        <Reader />
      </>
    )
  );
  const list = screen.getByTestId("message-list");
  expect(within(list).getByText(/Q3 发布物料/)).toBeInTheDocument();
  await user.click(within(list).getByText("会议纪要"));
  expect(screen.getByTitle("mail-body")).toBeInTheDocument();
  expect(useMailStore.getState().selectedId).toBe("4");
});

test("shows empty state when no matches", () => {
  useMailStore.setState({ searchQuery: "zzz-no-match-xxx" });
  render(wrap(<MessageList />));
  expect(screen.getByTestId("empty-state")).toBeInTheDocument();
  expect(screen.getByText(/没有匹配的邮件/)).toBeInTheDocument();
});

test("list pane key updates when folder changes", () => {
  const { rerender } = render(wrap(<MessageList />));
  expect(screen.getByTestId("message-list")).toBeInTheDocument();
  act(() => {
    useMailStore.setState({ activeFolderId: "sent", selectedId: null });
  });
  rerender(wrap(<MessageList />));
  expect(screen.getByTestId("message-list").getAttribute("data-pane-key") || "").toMatch(/sent/);
});
