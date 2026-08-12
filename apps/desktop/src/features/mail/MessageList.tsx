import type { CSSProperties } from "react";
import {
  Box,
  List,
  ListItemButton,
  ListItemText,
  Typography,
  Chip,
} from "@mui/material";
import { useMailStore } from "./store";
import { searchMessages } from "./search";
import EmptyState from "../shell/EmptyState";

export default function MessageList() {
  const selectedId = useMailStore((s) => s.selectedId);
  const select = useMailStore((s) => s.select);
  const markRead = useMailStore((s) => s.markRead);
  const searchQuery = useMailStore((s) => s.searchQuery);
  const setComposeOpen = useMailStore((s) => s.setComposeOpen);
  const split = useMailStore((s) => s.split);
  const activeFolderId = useMailStore((s) => s.activeFolderId);
  const allMessages = useMailStore((s) => s.messages);

  const messages = (() => {
    let list = allMessages.filter((m) => m.folderId === activeFolderId);
    if (split !== "all") list = list.filter((m) => m.split === split);
    return searchMessages(list, searchQuery);
  })();

  const isSearching = searchQuery.trim().length > 0;
  const paneKey = `${activeFolderId}:${split}:${searchQuery.trim()}`;
  const splitLabel = split === "important" ? "重要" : split === "other" ? "其他" : "全部";
  const folderLabel =
    activeFolderId === "inbox"
      ? "收件箱"
      : activeFolderId === "sent"
        ? "已发送"
        : activeFolderId === "drafts"
          ? "草稿"
          : activeFolderId === "archive"
            ? "归档"
            : "垃圾箱";

  if (messages.length === 0) {
    return (
      <Box data-testid="message-list" data-pane-key={paneKey} sx={{ height: "100%" }}>
        <EmptyState
          title={isSearching ? "没有匹配的邮件" : `${folderLabel}是空的`}
          description={
            isSearching
              ? `没有找到与「${searchQuery.trim()}」相关的邮件。`
              : "切换目录或写一封新邮件试试。"
          }
          onCompose={() => setComposeOpen(true)}
          onSync={isSearching ? undefined : () => undefined}
        />
      </Box>
    );
  }

  return (
    <Box
      data-testid="message-list"
      data-pane-key={paneKey}
      sx={{ height: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}
    >
      <Box sx={{ px: 1.5, py: 1, display: "flex", alignItems: "center", gap: 1 }}>
        <Chip size="small" color="primary" label={splitLabel} />
        <Typography variant="caption" color="text.secondary">
          {folderLabel} · {messages.length} 封
          {isSearching ? ` · 搜索「${searchQuery.trim()}」` : ""}
        </Typography>
      </Box>
      <List dense sx={{ flex: 1, overflow: "auto", py: 0 }} aria-label="邮件列表">
        {messages.map((m, i) => {
          const selected = selectedId === m.id;
          return (
            <ListItemButton
              key={m.id}
              selected={selected}
              alignItems="flex-start"
              className="pane-row-stagger"
              style={{ ["--row-i" as string]: Math.min(i, 12) } as CSSProperties}
              onClick={() => {
                select(m.id);
                markRead(m.id);
              }}
              sx={{
                borderLeft: 3,
                borderColor: m.unread ? "primary.main" : "transparent",
                py: 1.25,
                transition: (t) =>
                  t.transitions.create(["background-color", "border-color"], {
                    duration: t.transitions.duration.shorter,
                  }),
              }}
            >
              <ListItemText
                primary={
                  <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1 }}>
                    <Typography
                      variant="body2"
                      noWrap
                      component="span"
                      sx={{ fontWeight: m.unread ? 700 : 500 }}
                    >
                      {m.fromName}
                      <Typography component="span" variant="caption" color="text.secondary">
                        {" "}
                        · {domainOf(m.from)}
                      </Typography>
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                      {m.date}
                    </Typography>
                  </Box>
                }
                secondary={
                  <>
                    <Typography
                      variant="body2"
                      color="text.primary"
                      noWrap
                      sx={{ fontWeight: m.unread ? 600 : 400 }}
                    >
                      {m.subject}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      noWrap
                      sx={{ display: "block" }}
                    >
                      {m.snippet}
                    </Typography>
                  </>
                }
                slotProps={{ secondary: { component: "div" } }}
              />
            </ListItemButton>
          );
        })}
      </List>
    </Box>
  );
}

function domainOf(email: string): string {
  const at = email.indexOf("@");
  return at >= 0 ? email.slice(at + 1) : email;
}
