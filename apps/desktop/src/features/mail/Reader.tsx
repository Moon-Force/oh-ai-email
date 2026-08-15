import { useEffect, useState } from "react";
import {
  Avatar,
  Box,
  Button,
  Chip,
  Stack,
  Typography,
  Divider,
  Paper,
  Tooltip,
  useTheme,
} from "@mui/material";
import ReplyIcon from "@mui/icons-material/Reply";
import ArchiveIcon from "@mui/icons-material/Archive";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import LabelOutlinedIcon from "@mui/icons-material/LabelOutlined";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import DownloadIcon from "@mui/icons-material/Download";
import { useMailStore, ambientFromSender } from "./store";
import { useToastStore } from "../shell/toastStore";
import LumenCapsule from "../ai/LumenCapsule";
import PaneTransition from "../shell/PaneTransition";
import { mailOpenAttachment, mailSaveAttachment } from "../../lib/ipc";
import type { MailAttachment } from "./types";

export default function Reader() {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const messages = useMailStore((s) => s.messages);
  const selectedId = useMailStore((s) => s.selectedId);
  const openCompose = useMailStore((s) => s.openCompose);
  const setMessageSplit = useMailStore((s) => s.setMessageSplit);
  const showToast = useToastStore((s) => s.showToast);
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
  const attachments = msg.attachments ?? [];

  const normalizedSubj = normalizeSubject(msg.subject);
  const threadMessages = normalizedSubj
    ? messages
        .filter((m) => normalizeSubject(m.subject) === normalizedSubj)
        .sort((a, b) => a.dateMs - b.dateMs)
        .map((m) => ({
          sender: m.fromName || m.from,
          date: m.date,
          body: `${m.snippet}\n${stripHtml(m.html ?? "")}`.trim(),
        }))
    : undefined;

  return (
    <PaneTransition paneKey={msg.id} variant="reader">
      <Box
        data-testid="reader"
        sx={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
          position: "relative",
          // Reserve thin strip for AI dock; body uses the rest
          pb: "52px",
        }}
      >
        <Stack
          direction="row"
          spacing={1.5}
          sx={{ px: 2, pt: 2, pb: 1.5, alignItems: "flex-start", flexShrink: 0 }}
        >
          <Avatar sx={{ bgcolor: "primary.main" }}>{initial}</Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h6" sx={{ fontSize: "1.05rem" }}>
              {msg.subject}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {msg.fromName} &lt;{msg.from}&gt; · {msg.date}
            </Typography>
          </Box>
          <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", flexShrink: 0 }}>
            <Tooltip title={msg.split === "important" ? "当前：重要" : "标为重要"}>
              <Chip
                size="small"
                data-testid="split-important"
                icon={msg.split === "important" ? <StarIcon /> : <StarBorderIcon />}
                label="重要"
                color={msg.split === "important" ? "primary" : "default"}
                variant={msg.split === "important" ? "filled" : "outlined"}
                onClick={() => {
                  if (msg.split === "important") return;
                  setMessageSplit(msg.id, "important");
                  showToast("已标为重要", "success", 2200);
                }}
                aria-label="标为重要"
                aria-pressed={msg.split === "important"}
              />
            </Tooltip>
            <Tooltip title={msg.split === "other" ? "当前：其他" : "标为其他"}>
              <Chip
                size="small"
                data-testid="split-other"
                icon={<LabelOutlinedIcon />}
                label="其他"
                color={msg.split === "other" ? "primary" : "default"}
                variant={msg.split === "other" ? "filled" : "outlined"}
                onClick={() => {
                  if (msg.split === "other") return;
                  setMessageSplit(msg.id, "other");
                  showToast("已标为其他", "success", 2200);
                }}
                aria-label="标为其他"
                aria-pressed={msg.split === "other"}
              />
            </Tooltip>
            <Button
              size="small"
              variant="outlined"
              startIcon={<ReplyIcon />}
              onClick={() =>
                openCompose({
                  to: msg.from,
                  subject: msg.subject.toLowerCase().startsWith("re:")
                    ? msg.subject
                    : `Re: ${msg.subject}`,
                  body: "",
                })
              }
            >
              回复
            </Button>
            <Button size="small" variant="text" startIcon={<ArchiveIcon />}>
              归档
            </Button>
          </Stack>
        </Stack>

        <Divider sx={{ flexShrink: 0 }} />

        {attachments.length > 0 && (
          <Box
            data-testid="reader-attachments"
            sx={{ px: 2, py: 1, borderBottom: 1, borderColor: "divider", flexShrink: 0 }}
          >
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.75 }}>
              附件 · {attachments.length} 个
            </Typography>
            <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
              {attachments.map((a) => (
                <AttachmentChip key={a.id} attachment={a} />
              ))}
            </Stack>
          </Box>
        )}

        {/* Mail body: fills remaining height */}
        <Box
          className="mail-body-frame"
          sx={{
            flex: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            px: 2,
            py: 1.5,
            overflow: "hidden",
          }}
        >
          <Paper
            variant="outlined"
            sx={{
              flex: 1,
              minHeight: 0,
              p: 0,
              borderRadius: 2,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              bgcolor: isDark ? "background.paper" : "#FFFFFF",
            }}
          >
            <iframe
              title="mail-body"
              sandbox="allow-same-origin"
              srcDoc={wrapMailHtml(bodyHtml, isDark)}
              style={{ flex: 1, width: "100%", height: "100%", minHeight: 0, border: 0 }}
            />
          </Paper>
        </Box>

        {/* AI dock: overlay so expanded panel does not shrink the body */}
        <Box
          sx={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 2,
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "flex-end",
            px: 1.5,
            pb: 1,
            pt: 0.5,
            pointerEvents: "none",
            background: (t) =>
              `linear-gradient(to top, ${t.palette.background.paper} 55%, transparent)`,
          }}
        >
          <Box sx={{ pointerEvents: "auto", maxWidth: "min(100%, 440px)" }}>
            <LumenCapsule
              subject={msg.subject}
              from={msg.from}
              replyTo={msg.from}
              body={`${msg.snippet}\n${stripHtml(msg.html ?? "")}`}
              threadMessages={threadMessages}
              onInsertDraft={(draftText, replySubject, replyTo) => {
                openCompose({
                  to: replyTo,
                  subject: replySubject,
                  body: draftText,
                });
              }}
            />
          </Box>
        </Box>
      </Box>
    </PaneTransition>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentChip({ attachment }: { attachment: MailAttachment }) {
  const showToast = useToastStore((s) => s.showToast);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const r = await mailSaveAttachment(attachment.id);
      if (!r.ok) {
        if (r.error !== "已取消") showToast(`保存失败：${r.error}`, "error");
        return;
      }
      showToast(`已保存：${r.path}`, "success", 4000);
    } finally {
      setBusy(false);
    }
  }

  async function open() {
    setBusy(true);
    try {
      const r = await mailOpenAttachment(attachment.id);
      if (!r.ok) showToast(`打开失败：${r.error}`, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Chip
      icon={<AttachFileIcon />}
      label={`${attachment.filename} (${formatBytes(attachment.size)})`}
      variant="outlined"
      disabled={busy}
      onClick={() => void open()}
      onDelete={() => void save()}
      deleteIcon={
        <Tooltip title="另存为…">
          <DownloadIcon />
        </Tooltip>
      }
      sx={{ maxWidth: "100%" }}
      title="单击打开，右侧下载另存为"
    />
  );
}

function normalizeSubject(s?: string): string {
  if (!s) return "";
  return s.replace(/^(\s*(re|fwd|fw|回复|转发)\s*[:：]\s*)+/i, "").trim().toLowerCase();
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
  return `<!DOCTYPE html><html style="color-scheme:${scheme};height:100%"><head><meta charset="utf-8"/><style>
    html,body{height:100%;margin:0;background:${bg};color:${color};color-scheme:${scheme}}
    body{margin:12px 16px;font-family:Roboto,Segoe UI,system-ui,sans-serif;font-size:14px;line-height:1.55}
    a{color:${link}}
    img{max-width:100%;height:auto}
    p,li,td,th,div,span{color:inherit}
  </style></head><body>${body}</body></html>`;
}
