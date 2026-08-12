import type { ReactNode } from "react";
import {
  Badge,
  Box,
  Button,
  Divider,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Typography,
} from "@mui/material";
import InboxIcon from "@mui/icons-material/Inbox";
import SendIcon from "@mui/icons-material/Send";
import DraftsIcon from "@mui/icons-material/Drafts";
import ArchiveIcon from "@mui/icons-material/Archive";
import DeleteIcon from "@mui/icons-material/Delete";
import StarIcon from "@mui/icons-material/Star";
import LabelIcon from "@mui/icons-material/Label";
import AllInboxIcon from "@mui/icons-material/AllInbox";
import AddIcon from "@mui/icons-material/Add";
import SettingsIcon from "@mui/icons-material/Settings";
import { useMailStore } from "../mail/store";
import type { MailFolderId } from "../mail/types";
import { useAccountsStore } from "../accounts/store";

const MAILBOXES: {
  id: MailFolderId;
  label: string;
  icon: ReactNode;
}[] = [
  { id: "inbox", label: "收件箱", icon: <InboxIcon fontSize="small" /> },
  { id: "sent", label: "已发送", icon: <SendIcon fontSize="small" /> },
  { id: "drafts", label: "草稿", icon: <DraftsIcon fontSize="small" /> },
  { id: "archive", label: "归档", icon: <ArchiveIcon fontSize="small" /> },
  { id: "trash", label: "垃圾箱", icon: <DeleteIcon fontSize="small" /> },
];

export default function Sidebar() {
  const activeFolderId = useMailStore((s) => s.activeFolderId);
  const setFolder = useMailStore((s) => s.setFolder);
  const split = useMailStore((s) => s.split);
  const setSplit = useMailStore((s) => s.setSplit);
  const setView = useMailStore((s) => s.setView);
  const messages = useMailStore((s) => s.messages);
  const accounts = useAccountsStore((s) => s.accounts);

  function unreadInFolder(id: MailFolderId) {
    return messages.filter((m) => m.folderId === id && m.unread).length;
  }

  return (
    <Box
      component="aside"
      data-testid="sidebar"
      sx={{
        width: 260,
        flexShrink: 0,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        borderRight: 1,
        borderColor: "divider",
        bgcolor: "background.paper",
      }}
    >
      <Box sx={{ px: 2, py: 2, display: "flex", alignItems: "center", gap: 1 }}>
        <Typography variant="h6" color="primary">
          oh-ai-email
        </Typography>
      </Box>

      <List
        dense
        subheader={<ListSubheader component="div">分箱</ListSubheader>}
        sx={{ pt: 0 }}
        aria-label="分箱"
      >
        <ListItemButton
          selected={split === "important"}
          onClick={() => {
            setSplit("important");
            setView("mail");
          }}
        >
          <ListItemIcon>
            <StarIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="重要" />
          <Badge badgeContent={7} color="primary" />
        </ListItemButton>
        <ListItemButton
          selected={split === "other"}
          onClick={() => {
            setSplit("other");
            setView("mail");
          }}
        >
          <ListItemIcon>
            <LabelIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="其他" />
        </ListItemButton>
        <ListItemButton
          selected={split === "all"}
          onClick={() => {
            setSplit("all");
            setView("mail");
          }}
        >
          <ListItemIcon>
            <AllInboxIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="全部" />
        </ListItemButton>
      </List>

      <Divider />

      <List
        dense
        subheader={<ListSubheader component="div">邮箱</ListSubheader>}
        sx={{ flex: 1, overflow: "auto", pt: 0 }}
        aria-label="邮箱文件夹"
      >
        {MAILBOXES.map((box) => {
          const unread = unreadInFolder(box.id);
          return (
            <ListItemButton
              key={box.id}
              selected={activeFolderId === box.id}
              onClick={() => {
                setFolder(box.id);
                setView("mail");
              }}
            >
              <ListItemIcon>{box.icon}</ListItemIcon>
              <ListItemText primary={box.label} />
              {unread > 0 && <Badge badgeContent={unread} color="primary" />}
            </ListItemButton>
          );
        })}
      </List>

      <Box sx={{ p: 1.5, display: "flex", flexDirection: "column", gap: 1 }}>
        {accounts[0] && (
          <Typography variant="caption" color="text.secondary" noWrap title={accounts[0].email}>
            {accounts[0].email}
          </Typography>
        )}
        <Button
          fullWidth
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={() => setView("add-account")}
        >
          添加账号
        </Button>
        <Button
          fullWidth
          variant="text"
          startIcon={<SettingsIcon />}
          onClick={() => setView("settings")}
        >
          设置
        </Button>
      </Box>
    </Box>
  );
}
