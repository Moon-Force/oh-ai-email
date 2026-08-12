import { useEffect } from "react";
import {
  Avatar,
  Box,
  Button,
  Stack,
  Typography,
  Divider,
  Paper,
  useTheme,
} from "@mui/material";
import ReplyIcon from "@mui/icons-material/Reply";
import ArchiveIcon from "@mui/icons-material/Archive";
import { useMailStore, ambientFromSender } from "./store";
import LumenCapsule from "../ai/LumenCapsule";
import PaneTransition from "../shell/PaneTransition";

export default function Reader() {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { messages, selectedId, setComposeOpen } = useMailStore();
  const msg = messages.find((m) => m.id === selectedId);

  useEffect(() => {
    if (msg) {
      document.documentElement.style.setProperty("--ambient-tint", ambientFromSender(msg.from));
    } else {
      document.documentElement.style.setProperty("--ambient-tint", "transparent");
    }
  }, [msg]);

  if (!msg) {
    return (
      <Box
        data-testid="reader-empty"
        sx={{
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "text.secondary",
          flexDirection: "column",
          gap: 1,
        }}
      >
        <Typography variant="body2">选择一封邮件阅读</Typography>
      </Box>
    );
  }

  const initial = (msg.fromName || msg.from).charAt(0).toUpperCase();
  const bodyHtml = msg.html ?? `<p>${escapeHtml(msg.snippet)}</p>`;

  return (
    <PaneTransition paneKey={msg.id} variant="reader">
      <Box
        data-testid="reader"
        sx={{ height: "100%", display: "flex", flexDirection: "column", minHeight: 0, p: 2 }}
      >
        <Stack direction="row" spacing={1.5} sx={{ mb: 2, alignItems: "flex-start" }}>
          <Avatar sx={{ bgcolor: "primary.main" }}>{initial}</Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h6" sx={{ fontSize: "1.05rem" }}>
              {msg.subject}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {msg.fromName} &lt;{msg.from}&gt; · {msg.date}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<ReplyIcon />}
              onClick={() => setComposeOpen(true)}
            >
              回复
            </Button>
            <Button size="small" variant="text" startIcon={<ArchiveIcon />}>
              归档
            </Button>
          </Stack>
        </Stack>
        <Divider />
        <Box sx={{ flex: 1, overflow: "auto", py: 2 }} className="mail-body-frame">
          <Paper
            variant="outlined"
            sx={{
              p: 0,
              overflow: "hidden",
              bgcolor: isDark ? "background.paper" : "#FFFFFF",
            }}
          >
            <iframe
              title="mail-body"
              sandbox="allow-same-origin"
              srcDoc={wrapMailHtml(bodyHtml, isDark)}
            />
          </Paper>
        </Box>
        <Box sx={{ pt: 1, display: "flex", justifyContent: "flex-end" }}>
          <LumenCapsule body={`${msg.subject}\n${msg.snippet}\n${stripHtml(msg.html ?? "")}`} />
        </Box>
      </Box>
    </PaneTransition>
  );
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Theme-locked styles: do not use prefers-color-scheme (OS dark + app light = white text on white). */
function wrapMailHtml(body: string, isDark: boolean): string {
  const color = isDark ? "#F2F4F8" : "#1A1D24";
  const bg = isDark ? "#141A22" : "#FFFFFF";
  const link = isDark ? "#5B8CFF" : "#2F6BFF";
  const scheme = isDark ? "dark" : "light";
  return `<!DOCTYPE html><html style="color-scheme:${scheme}"><head><meta charset="utf-8"/><style>
    html,body{margin:0;background:${bg};color:${color};color-scheme:${scheme}}
    body{margin:12px 16px;font-family:Roboto,Segoe UI,system-ui,sans-serif;font-size:14px;line-height:1.55}
    a{color:${link}}
    img{max-width:100%;height:auto}
    p,li,td,th,div,span{color:inherit}
  </style></head><body>${body}</body></html>`;
}
