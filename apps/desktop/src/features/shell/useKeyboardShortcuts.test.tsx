import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useKeyboardShortcuts } from "./useKeyboardShortcuts";
import ShortcutsDialog from "./ShortcutsDialog";
import AppThemeProvider from "../../theme/AppThemeProvider";
import { useMailStore } from "../mail/store";
import { useAgentStore } from "../ai/agentStore";

function TestShortcutComponent({
  onToggleShortcuts,
  onFocusSearch,
}: {
  onToggleShortcuts?: () => void;
  onFocusSearch?: () => void;
}) {
  useKeyboardShortcuts({ onToggleShortcuts, onFocusSearch });
  return (
    <div>
      <input data-testid="test-input" />
      <div data-testid="test-display">App Content</div>
    </div>
  );
}

describe("useKeyboardShortcuts and ShortcutsDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useMailStore.setState({
      activeFolderId: "inbox",
      split: "important",
      folders: [{ id: "f-1", role: "inbox", name: "收件箱", unread: 1 }],
      messages: [
        {
          id: "msg-1",
          accountId: "acc-1",
          folderId: "f-1",
          folderRole: "inbox",
          uid: 1,
          from: "alice@example.com",
          fromName: "Alice",
          subject: "First Email",
          snippet: "Snippet 1",
          date: "10:00",
          dateMs: 2000,
          unread: true,
          split: "important",
          attachments: [],
        },
        {
          id: "msg-2",
          accountId: "acc-1",
          folderId: "f-1",
          folderRole: "inbox",
          uid: 2,
          from: "bob@example.com",
          fromName: "Bob",
          subject: "Second Email",
          snippet: "Snippet 2",
          date: "11:00",
          dateMs: 1000,
          unread: false,
          split: "important",
          attachments: [],
        },
      ],
      selectedId: "msg-1",
      composeOpen: false,
      searchQuery: "",
    });
    useAgentStore.setState({
      open: false,
    });
  });

  it("navigates next and previous email on J and K keys", () => {
    render(
      <AppThemeProvider mode="light">
        <TestShortcutComponent />
      </AppThemeProvider>
    );

    // Press 'j' -> moves to msg-2
    fireEvent.keyDown(window, { key: "j" });
    expect(useMailStore.getState().selectedId).toBe("msg-2");

    // Press 'k' -> moves back to msg-1
    fireEvent.keyDown(window, { key: "k" });
    expect(useMailStore.getState().selectedId).toBe("msg-1");
  });

  it("opens compose on 'c' and reply on 'r'", () => {
    render(
      <AppThemeProvider mode="light">
        <TestShortcutComponent />
      </AppThemeProvider>
    );

    // Press 'r' -> opens compose with prefilled reply
    fireEvent.keyDown(window, { key: "r" });
    expect(useMailStore.getState().composeOpen).toBe(true);
    expect(useMailStore.getState().composeSeed).toEqual({
      to: "alice@example.com",
      subject: "Re: First Email",
      body: "",
    });

    // Close compose
    useMailStore.setState({ composeOpen: false, composeSeed: null });

    // Press 'c' -> opens compose empty
    fireEvent.keyDown(window, { key: "c" });
    expect(useMailStore.getState().composeOpen).toBe(true);
  });

  it("triggers search focus on '/' and toggles shortcuts on '?'", () => {
    const onFocusSearch = vi.fn();
    const onToggleShortcuts = vi.fn();

    render(
      <AppThemeProvider mode="light">
        <TestShortcutComponent
          onFocusSearch={onFocusSearch}
          onToggleShortcuts={onToggleShortcuts}
        />
      </AppThemeProvider>
    );

    fireEvent.keyDown(window, { key: "/" });
    expect(onFocusSearch).toHaveBeenCalled();

    fireEvent.keyDown(window, { key: "?" });
    expect(onToggleShortcuts).toHaveBeenCalled();
  });

  it("does not trigger shortcuts when typing inside an input", () => {
    render(
      <AppThemeProvider mode="light">
        <TestShortcutComponent />
      </AppThemeProvider>
    );

    const input = screen.getByTestId("test-input");
    input.focus();

    fireEvent.keyDown(input, { key: "j" });
    // Still msg-1 because focus is inside input
    expect(useMailStore.getState().selectedId).toBe("msg-1");
  });

  it("renders ShortcutsDialog and closes on close button click", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <AppThemeProvider mode="light">
        <ShortcutsDialog open={true} onClose={onClose} />
      </AppThemeProvider>
    );

    expect(screen.getByText("键盘快捷键指南")).toBeInTheDocument();
    expect(screen.getByText("下一封邮件")).toBeInTheDocument();
    expect(screen.getByText("回复邮件")).toBeInTheDocument();

    const closeBtn = screen.getByRole("button", { name: "关闭快捷键指南" });
    await user.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });
});
