import type { ReactNode } from "react";
import {
  Badge,
  Box,
  Divider,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Tooltip,
  Typography,
} from "@mui/material";
import InboxIcon from "@mui/icons-material/Inbox";
import SendIcon from "@mui/icons-material/Send";
import DraftsIcon from "@mui/icons-material/Drafts";
import ArchiveIcon from "@mui/icons-material/Archive";
import DeleteIcon from "@mui/icons-material/Delete";
import SnoozeIcon from "@mui/icons-material/Snooze";
import StarIcon from "@mui/icons-material/Star";
import LabelIcon from "@mui/icons-material/Label";
import AllInboxIcon from "@mui/icons-material/AllInbox";
import PersonAddAlt1Icon from "@mui/icons-material/PersonAddAlt1";
import SettingsIcon from "@mui/icons-material/Settings";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import ContactsIcon from "@mui/icons-material/Contacts";
import { useMailStore } from "../mail/store";
import type { MailFolderId } from "../mail/types";
import { useAccountsStore } from "../accounts/store";
import { useCalendarStore } from "../calendar/calendarStore";
import { useContactsStore } from "../contacts/contactsStore";

const MAILBOXES: {
  id: MailFolderId;
  label: string;
  icon: ReactNode;
}[] = [
  { id: "inbox", label: "收件箱", icon: <InboxIcon fontSize="small" /> },
  { id: "snoozed", label: "稍后处理", icon: <SnoozeIcon fontSize="small" /> },
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
  const view = useMailStore((s) => s.view);
  const setView = useMailStore((s) => s.setView);
  const composeOpen = useMailStore((s) => s.composeOpen);
  const setComposeOpen = useMailStore((s) => s.setComposeOpen);
  const unreadInFolder = useMailStore((s) => s.unreadInFolder);
  const messages = useMailStore((s) => s.messages);
  const accounts = useAccountsStore((s) => s.accounts);

  const todayEvents = useCalendarStore((s) => s.todayEvents);
  const contacts = useContactsStore((s) => s.contacts);

  const importantUnread = messages.filter((m) => m.split === "important" && m.unread).length;
  const todayCount = todayEvents().length;
  const contactsCount = contacts.length;

  /** Leave compose so folder/settings navigation is visible again. */
  function leaveCompose() {
    setComposeOpen(false);
  }

  function goMail() {
    leaveCompose();
    setView("mail");
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
        bgcolor: (t) => (t.palette.mode === "dark" ? "#0C0F15" : "#F8FAFC"),
      }}
    >
      <Box sx={{ px: 2.5, py: 2, display: "flex", alignItems: "center", gap: 1 }}>
        <Typography variant="h6" color="primary" sx={{ fontWeight: 700, letterSpacing: "-0.02em" }}>
          oh-ai-email
        </Typography>
      </Box>

      {/* 核心应用视图 */}
      <List dense sx={{ pt: 0, pb: 1 }}>
        <ListItemButton
          selected={view === "mail" && !composeOpen}
          onClick={goMail}
          sx={{ borderRadius: 1.5, mx: 1 }}
        >
          <ListItemIcon sx={{ minWidth: 32 }}>
            <InboxIcon
              fontSize="small"
              color={view === "mail" && !composeOpen ? "primary" : "inherit"}
            />
          </ListItemIcon>
          <ListItemText primary="邮件" />
        </ListItemButton>

        <ListItemButton
          selected={view === "calendar"}
          onClick={() => {
            leaveCompose();
            setView("calendar");
          }}
          sx={{ borderRadius: 1.5, mx: 1 }}
        >
          <ListItemIcon sx={{ minWidth: 32 }}>
            <CalendarMonthIcon
              fontSize="small"
              color={view === "calendar" ? "primary" : "inherit"}
            />
          </ListItemIcon>
          <ListItemText primary="日历日程" />
          {todayCount > 0 && <Badge badgeContent={todayCount} color="primary" />}
        </ListItemButton>

        <ListItemButton
          selected={view === "contacts"}
          onClick={() => {
            leaveCompose();
            setView("contacts");
          }}
          sx={{ borderRadius: 1.5, mx: 1 }}
        >
          <ListItemIcon sx={{ minWidth: 32 }}>
            <ContactsIcon fontSize="small" color={view === "contacts" ? "primary" : "inherit"} />
          </ListItemIcon>
          <ListItemText primary="通讯录" />
          {contactsCount > 0 && (
            <Typography variant="caption" color="text.secondary">
              {contactsCount}
            </Typography>
          )}
        </ListItemButton>
      </List>

      <Divider />

      <List
        dense
        subheader={
          <ListSubheader
            component="div"
            sx={{
              bgcolor: "transparent",
              color: "text.secondary",
              fontWeight: 600,
              fontSize: "0.7rem",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              lineHeight: "28px",
            }}
          >
            分箱
          </ListSubheader>
        }
        sx={{ pt: 0 }}
        aria-label="分箱"
      >
        <ListItemButton
          selected={split === "important"}
          onClick={() => {
            setSplit("important");
            goMail();
          }}
        >
          <ListItemIcon>
            <StarIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="重要" />
          {importantUnread > 0 && <Badge badgeContent={importantUnread} color="primary" />}
        </ListItemButton>
        <ListItemButton
          selected={split === "other"}
          onClick={() => {
            setSplit("other");
            goMail();
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
            goMail();
          }}
        >
          <ListItemIcon>
            <AllInboxIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="全部" />
        </ListItemButton>
      </List>

      <Divider sx={{ my: 0.5 }} />

      <List
        dense
        subheader={
          <ListSubheader
            component="div"
            sx={{
              bgcolor: "transparent",
              color: "text.secondary",
              fontWeight: 600,
              fontSize: "0.7rem",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              lineHeight: "28px",
            }}
          >
            邮箱
          </ListSubheader>
        }
        sx={{ flex: 1, overflow: "auto", pt: 0 }}
        aria-label="邮箱文件夹"
      >
        {MAILBOXES.map((box) => {
          const unread = unreadInFolder(box.id as MailFolderId);
          return (
            <ListItemButton
              key={box.id}
              selected={activeFolderId === box.id}
              onClick={() => {
                setFolder(box.id);
                goMail();
              }}
            >
              <ListItemIcon>{box.icon}</ListItemIcon>
              <ListItemText primary={box.label} />
              {unread > 0 && <Badge badgeContent={unread} color="primary" />}
            </ListItemButton>
          );
        })}
      </List>

      <Box
        sx={{
          px: 1.5,
          py: 1,
          display: "flex",
          alignItems: "center",
          gap: 0.5,
          borderTop: 1,
          borderColor: "divider",
        }}
      >
        {accounts[0] && (
          <Typography
            variant="caption"
            color="text.secondary"
            noWrap
            title={accounts[0].email}
            sx={{ flex: 1, minWidth: 0, mr: 0.5 }}
          >
            {accounts[0].email}
          </Typography>
        )}
        {!accounts[0] && <Box sx={{ flex: 1 }} />}
        <Tooltip title="添加账号">
          <IconButton
            size="small"
            aria-label="添加账号"
            onClick={() => {
              leaveCompose();
              setView("add-account");
            }}
          >
            <PersonAddAlt1Icon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="设置">
          <IconButton
            size="small"
            aria-label="设置"
            onClick={() => {
              leaveCompose();
              setView("settings");
            }}
          >
            <SettingsIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
}
