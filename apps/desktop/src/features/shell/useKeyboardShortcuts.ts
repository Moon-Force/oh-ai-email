import { useEffect } from "react";
import { useMailStore } from "../mail/store";
import { useAgentStore } from "../ai/agentStore";

export type ShortcutAction = {
  key: string;
  label: string;
  description: string;
  category: "导航" | "动作" | "系统";
};

export const KEYBOARD_SHORTCUTS: ShortcutAction[] = [
  {
    key: "J / ↓",
    label: "下一封邮件",
    description: "在邮件列表中向下选择下一封邮件",
    category: "导航",
  },
  {
    key: "K / ↑",
    label: "上一封邮件",
    description: "在邮件列表中向上选择上一封邮件",
    category: "导航",
  },
  { key: "R", label: "回复邮件", description: "针对当前选中的邮件调起回复撰写", category: "动作" },
  { key: "C", label: "新建邮件", description: "打开写信窗口撰写新邮件", category: "动作" },
  { key: "/", label: "聚焦搜索", description: "快速聚焦到顶栏搜索框", category: "导航" },
  { key: "A", label: "智能体助手", description: "展开或收起 AI 智能体抽屉", category: "动作" },
  { key: "?", label: "快捷键指南", description: "打开或关闭快捷键说明面板", category: "系统" },
  {
    key: "Esc",
    label: "关闭 / 清除",
    description: "清空搜索框、关闭写信或退出弹窗",
    category: "系统",
  },
];

function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  return (
    tagName === "input" ||
    tagName === "textarea" ||
    target.isContentEditable ||
    target.getAttribute("role") === "textbox"
  );
}

export function useKeyboardShortcuts({
  onToggleShortcuts,
  onFocusSearch,
}: {
  onToggleShortcuts?: () => void;
  onFocusSearch?: () => void;
}) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented) return;

      // Handle Escape anywhere
      if (event.key === "Escape") {
        const mailStore = useMailStore.getState();
        if (mailStore.composeOpen) {
          mailStore.setComposeOpen(false);
          return;
        }
        if (mailStore.searchQuery) {
          mailStore.setSearchQuery("");
          return;
        }
        const agentStore = useAgentStore.getState();
        if (agentStore.open) {
          agentStore.closeDrawer();
          return;
        }
        return;
      }

      // If user is typing in an input field, do not trigger single-key actions
      if (isEditableTarget(event.target)) {
        return;
      }

      // Ignore if modifier keys are pressed (except Shift for '?')
      if (event.ctrlKey || event.altKey || event.metaKey) {
        return;
      }

      const key = event.key.toLowerCase();
      const mailStore = useMailStore.getState();
      const visible = mailStore.visibleMessages();
      const currentIndex = visible.findIndex((m) => m.id === mailStore.selectedId);

      switch (key) {
        case "j":
        case "arrowdown": {
          event.preventDefault();
          if (visible.length === 0) return;
          const nextIndex = currentIndex < 0 ? 0 : Math.min(currentIndex + 1, visible.length - 1);
          mailStore.select(visible[nextIndex]?.id ?? null);
          break;
        }

        case "k":
        case "arrowup": {
          event.preventDefault();
          if (visible.length === 0) return;
          const prevIndex = currentIndex < 0 ? 0 : Math.max(currentIndex - 1, 0);
          mailStore.select(visible[prevIndex]?.id ?? null);
          break;
        }

        case "r": {
          if (mailStore.selectedId) {
            event.preventDefault();
            const currentMsg = visible.find((m) => m.id === mailStore.selectedId);
            if (currentMsg) {
              mailStore.openCompose({
                to: currentMsg.from,
                subject: currentMsg.subject.startsWith("Re:")
                  ? currentMsg.subject
                  : `Re: ${currentMsg.subject}`,
                body: "",
              });
            }
          }
          break;
        }

        case "c": {
          event.preventDefault();
          mailStore.openCompose();
          break;
        }

        case "/": {
          event.preventDefault();
          onFocusSearch?.();
          break;
        }

        case "a": {
          event.preventDefault();
          const agentStore = useAgentStore.getState();
          if (agentStore.open) {
            agentStore.closeDrawer();
          } else {
            agentStore.openDrawer();
          }
          break;
        }

        case "?": {
          event.preventDefault();
          onToggleShortcuts?.();
          break;
        }

        default:
          break;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onToggleShortcuts, onFocusSearch]);
}
