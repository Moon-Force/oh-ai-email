import { useEffect, useState } from "react";
import {
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import ReplyIcon from "@mui/icons-material/Reply";
import ArchiveIcon from "@mui/icons-material/Archive";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import LabelOutlinedIcon from "@mui/icons-material/LabelOutlined";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import DownloadIcon from "@mui/icons-material/Download";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import PushPinIcon from "@mui/icons-material/PushPin";
import PushPinOutlinedIcon from "@mui/icons-material/PushPinOutlined";
import NotificationsOffIcon from "@mui/icons-material/NotificationsOff";
import NotificationsNoneIcon from "@mui/icons-material/NotificationsNone";
import ScheduleIcon from "@mui/icons-material/Schedule";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import PersonAddAlt1Icon from "@mui/icons-material/PersonAddAlt1";
import { useMailStore, ambientFromSender } from "./store";
import { useToastStore } from "../shell/toastStore";
import { useCalendarStore } from "../calendar/calendarStore";
import { useContactsStore } from "../contacts/contactsStore";
import LumenCapsule from "../ai/LumenCapsule";
import { TypewriterText } from "../ai/TypewriterText";
import { analyzeAttachment } from "../ai/router";
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
  const togglePin = useMailStore((s) => s.togglePin);
  const toggleMute = useMailStore((s) => s.toggleMute);
  const snoozeMessage = useMailStore((s) => s.snoozeMessage);
  const [snoozeAnchor, setSnoozeAnchor] = useState<null | HTMLElement>(null);
  const showToast = useToastStore((s) => s.showToast);
  const contacts = useContactsStore((s) => s.contacts);
  const openContactCreate = useContactsStore((s) => s.openCreateDialog);
  const openCalendarCreate = useCalendarStore((s) => s.openCreateDialog);
  const msg = messages.find((m) => m.id === selectedId);

  const handleSnooze = (preset: "evening" | "tomorrow" | "weekend" | "next_week" | "clear") => {
    if (!msg) return;
    setSnoozeAnchor(null);
    if (preset === "clear") {
      snoozeMessage(msg.id, null);
      showToast("已取消推迟，邮件已放回收件箱", "success", 2500);
      return;
    }
    const d = new Date();
    if (preset === "evening") {
      d.setHours(18, 0, 0, 0);
      if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
    } else if (preset === "tomorrow") {
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0);
    } else if (preset === "weekend") {
      const day = d.getDay();
      const diff = (6 - day + 7) % 7 || 7;
      d.setDate(d.getDate() + diff);
      d.setHours(9, 0, 0, 0);
    } else if (preset === "next_week") {
      const day = d.getDay();
      const diff = (8 - day) % 7 || 7;
      d.setDate(d.getDate() + diff);
      d.setHours(9, 0, 0, 0);
    }
    snoozeMessage(msg.id, d.getTime());
    showToast(
      `已推迟处理至 ${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
      "success",
      3000
    );
  };

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

  const isSenderInContacts = msg
    ? contacts.some((c) => c.email.toLowerCase() === msg.from.toLowerCase())
    : false;

  const hasIcsAttachment = msg?.attachments
    ? msg.attachments.some(
        (a) =>
          a.filename.toLowerCase().endsWith(".ics") ||
          a.contentType.toLowerCase().includes("calendar")
      )
    : false;

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
        <Box sx={{ px: 2, pt: 2, pb: 1.5, flexShrink: 0 }}>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: "flex-start" }}>
            <Avatar sx={{ bgcolor: "primary.main", flexShrink: 0 }}>{initial}</Avatar>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                variant="h6"
                sx={{
                  fontSize: "1.05rem",
                  lineHeight: 1.35,
                  wordBreak: "break-word",
                  overflowWrap: "break-word",
                  whiteSpace: "normal",
                }}
              >
                {msg.subject}
              </Typography>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
                <Typography variant="caption" color="text.secondary">
                  {msg.fromName} &lt;{msg.from}&gt; · {msg.date}
                </Typography>
                {!isSenderInContacts && (
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<PersonAddAlt1Icon sx={{ fontSize: 13 }} />}
                    onClick={() =>
                      openContactCreate({
                        name: msg.fromName || msg.from.split("@")[0],
                        email: msg.from,
                      })
                    }
                    sx={{
                      py: 0,
                      px: 0.75,
                      minHeight: 20,
                      fontSize: "0.68rem",
                      textTransform: "none",
                      borderRadius: 1,
                    }}
                  >
                    + 加为联系人
                  </Button>
                )}
              </Stack>
            </Box>
          </Stack>
          <Stack
            direction="row"
            spacing={0.75}
            useFlexGap
            sx={{ alignItems: "center", flexWrap: "wrap", mt: 1.25 }}
          >
            <Tooltip title="将该邮件转为日程安排">
              <Button
                size="small"
                variant="outlined"
                startIcon={<CalendarMonthIcon fontSize="small" />}
                onClick={() => {
                  openCalendarCreate({
                    title: msg.subject || "邮件日程",
                    description: `${msg.fromName ? `发件人: ${msg.fromName} <${msg.from}>\n\n` : ""}${msg.snippet || msg.subject || ""}`,
                    sourceMessageId: msg.id,
                    sourceMessageSubject: msg.subject,
                    startTime: new Date(Date.now() + 3600_000).toISOString(),
                    endTime: new Date(Date.now() + 7200_000).toISOString(),
                  });
                }}
              >
                转为日程
              </Button>
            </Tooltip>

            <Tooltip title={msg.split === "important" ? "当前：重要" : "标为重要"}>
              <Chip
                size="small"
                data-testid="split-important"
                icon={
                  msg.split === "important" ? (
                    <StarIcon sx={{ "&&": { color: "#FFFFFF" } }} />
                  ) : (
                    <StarBorderIcon />
                  )
                }
                label="重要"
                color={msg.split === "important" ? "primary" : "default"}
                variant={msg.split === "important" ? "filled" : "outlined"}
                sx={
                  msg.split === "important"
                    ? {
                        bgcolor: "primary.main",
                        color: "#FFFFFF",
                        fontWeight: 600,
                        "&:hover": { bgcolor: "primary.dark" },
                      }
                    : undefined
                }
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
            <Tooltip title={msg.isPinned ? "取消置顶" : "置顶邮件"}>
              <IconButton
                size="small"
                color={msg.isPinned ? "warning" : "default"}
                onClick={() => {
                  togglePin(msg.id);
                  showToast(msg.isPinned ? "已取消置顶" : "已置顶该邮件", "success", 2000);
                }}
                aria-label="置顶"
              >
                {msg.isPinned ? (
                  <PushPinIcon fontSize="small" sx={{ transform: "rotate(45deg)" }} />
                ) : (
                  <PushPinOutlinedIcon fontSize="small" />
                )}
              </IconButton>
            </Tooltip>
            <Tooltip title={msg.isMuted ? "取消静音（恢复通知）" : "静音此邮件（不再弹通知）"}>
              <IconButton
                size="small"
                color={msg.isMuted ? "error" : "default"}
                onClick={() => {
                  toggleMute(msg.id);
                  showToast(msg.isMuted ? "已取消静音" : "已静音该邮件", "info", 2000);
                }}
                aria-label="静音"
              >
                {msg.isMuted ? (
                  <NotificationsOffIcon fontSize="small" />
                ) : (
                  <NotificationsNoneIcon fontSize="small" />
                )}
              </IconButton>
            </Tooltip>
            <Tooltip title="稍后处理 (Snooze)">
              <Button
                size="small"
                variant={msg.snoozedUntil && msg.snoozedUntil > Date.now() ? "contained" : "text"}
                color={msg.snoozedUntil && msg.snoozedUntil > Date.now() ? "info" : "primary"}
                startIcon={<ScheduleIcon />}
                onClick={(e) => setSnoozeAnchor(e.currentTarget)}
              >
                {msg.snoozedUntil && msg.snoozedUntil > Date.now() ? "已推迟" : "稍后"}
              </Button>
            </Tooltip>
            <Menu
              anchorEl={snoozeAnchor}
              open={Boolean(snoozeAnchor)}
              onClose={() => setSnoozeAnchor(null)}
            >
              <MenuItem onClick={() => handleSnooze("evening")}>今天下午 (18:00)</MenuItem>
              <MenuItem onClick={() => handleSnooze("tomorrow")}>明天上午 (09:00)</MenuItem>
              <MenuItem onClick={() => handleSnooze("weekend")}>本周末 (周六 09:00)</MenuItem>
              <MenuItem onClick={() => handleSnooze("next_week")}>下周一 (09:00)</MenuItem>
              {msg.snoozedUntil != null && msg.snoozedUntil > Date.now() && (
                <MenuItem onClick={() => handleSnooze("clear")} sx={{ color: "error.main" }}>
                  取消推迟 (放回收件箱)
                </MenuItem>
              )}
            </Menu>
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
        </Box>

        <Divider sx={{ flexShrink: 0 }} />

        {hasIcsAttachment && (
          <Paper
            variant="outlined"
            sx={{
              mx: 2,
              my: 1.25,
              p: 1.5,
              borderRadius: 2,
              bgcolor: (t) =>
                t.palette.mode === "dark" ? "rgba(37,99,235,0.12)" : "rgba(37,99,235,0.06)",
              borderColor: "primary.main",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexShrink: 0,
            }}
          >
            <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
              <CalendarMonthIcon color="primary" />
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  检测到日程 / 会议邀请文件 (.ics)
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  点击可一键将该会议直接录入并同步至您的本地日历
                </Typography>
              </Box>
            </Stack>
            <Button
              size="small"
              variant="contained"
              onClick={() => {
                openCalendarCreate({
                  title: msg.subject,
                  description: `${msg.fromName ? `发件人: ${msg.fromName} <${msg.from}>\n\n` : ""}${msg.snippet || msg.subject}`,
                  sourceMessageId: msg.id,
                  sourceMessageSubject: msg.subject,
                  startTime: new Date(Date.now() + 3600_000).toISOString(),
                  endTime: new Date(Date.now() + 7200_000).toISOString(),
                });
              }}
            >
              一键写入日历
            </Button>
          </Paper>
        )}

        {attachments.length > 0 && (
          <Box
            data-testid="reader-attachments"
            sx={{ px: 2, py: 1, borderBottom: 1, borderColor: "divider", flexShrink: 0 }}
          >
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: "block", mb: 0.75 }}
            >
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
          <Box sx={{ pointerEvents: "auto", maxWidth: "100%", width: "fit-content" }}>
            <LumenCapsule
              subject={msg.subject}
              from={msg.from}
              replyTo={msg.from}
              body={`${msg.snippet}\n${stripHtml(msg.html ?? "")}`}
              currentSplit={msg.split}
              threadMessages={threadMessages}
              onInsertDraft={(draftText, replySubject, replyTo) => {
                openCompose({
                  to: replyTo,
                  subject: replySubject,
                  body: draftText,
                });
              }}
              onApplySplit={(split) => setMessageSplit(msg.id, split)}
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
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

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

  async function analyze() {
    setAnalyzing(true);
    try {
      const res = await analyzeAttachment({
        filename: attachment.filename,
        contentType: attachment.contentType,
      });
      setAnalysisResult(res);
      setDialogOpen(true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "附件分析失败", "error");
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
      <Chip
        icon={<AttachFileIcon />}
        label={`${attachment.filename} (${formatBytes(attachment.size)})`}
        variant="outlined"
        disabled={busy || analyzing}
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
      <Tooltip title="AI 提取附件要点">
        <IconButton
          size="small"
          color="primary"
          disabled={analyzing}
          onClick={() => void analyze()}
          aria-label="AI 提炼附件"
          sx={{ p: 0.5 }}
        >
          {analyzing ? <CircularProgress size={16} /> : <AutoAwesomeIcon fontSize="small" />}
        </IconButton>
      </Tooltip>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <AutoAwesomeIcon color="primary" fontSize="small" />
          附件智能提炼 · {attachment.filename}
        </DialogTitle>
        <DialogContent dividers>
          <TypewriterText
            variant="body2"
            sx={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}
            text={analysisResult || ""}
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              if (analysisResult) {
                void navigator.clipboard.writeText(analysisResult);
                showToast("已复制提炼要点", "success", 2000);
              }
            }}
          >
            复制要点
          </Button>
          <Button variant="contained" onClick={() => setDialogOpen(false)}>
            关闭
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

function normalizeSubject(s?: string): string {
  if (!s) return "";
  return s
    .replace(/^(\s*(re|fwd|fw|回复|转发)\s*[:：]\s*)+/i, "")
    .trim()
    .toLowerCase();
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

/** Theme-locked styles with robust dark mode color inversion and sleek modern scrollbars */
function wrapMailHtml(body: string, isDark: boolean): string {
  const color = isDark ? "#F8FAFC" : "#0F172A";
  const bg = isDark ? "#13171F" : "#FFFFFF";
  const link = isDark ? "#60A5FA" : "#2563EB";
  const scheme = isDark ? "dark" : "light";

  const darkInversionCss = isDark
    ? `
    html, body {
      background-color: ${bg} !important;
      color: ${color} !important;
      color-scheme: dark;
    }
    body {
      color: ${color} !important;
    }
    p, li, td, th, div, span, font, b, strong, em, i, h1, h2, h3, h4, h5, h6 {
      color: inherit !important;
      border-color: rgba(255, 255, 255, 0.1) !important;
    }
    *[style*="background"], *[style*="BACKGROUND"], *[bgcolor], *[BGCOLOR] {
      background-color: transparent !important;
    }
    table {
      border-collapse: collapse;
      max-width: 100% !important;
    }
    blockquote {
      border-left: 3px solid #3B82F6 !important;
      margin: 12px 0 !important;
      padding: 4px 12px !important;
      color: #94A3B8 !important;
      background-color: rgba(255, 255, 255, 0.03) !important;
      border-radius: 0 4px 4px 0;
    }
    pre, code {
      background-color: #1A1F2B !important;
      color: #F8FAFC !important;
      border-radius: 4px;
      padding: 2px 6px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }
    hr {
      border: 0;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      margin: 16px 0;
    }
    `
    : `
    html, body {
      background-color: ${bg};
      color: ${color};
      color-scheme: light;
    }
    blockquote {
      border-left: 3px solid #2563EB;
      margin: 12px 0;
      padding: 4px 12px;
      color: #64748B;
      background-color: rgba(15, 23, 42, 0.03);
      border-radius: 0 4px 4px 0;
    }
    pre, code {
      background-color: #F1F5F9;
      color: #0F172A;
      border-radius: 4px;
      padding: 2px 6px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }
    `;

  return `<!DOCTYPE html><html style="color-scheme:${scheme};height:100%"><head><meta charset="utf-8"/><style>
    html {
      height: 100%;
      margin: 0;
      padding: 0;
      overflow-x: hidden;
      overflow-y: auto;
    }
    body {
      min-height: 100%;
      margin: 0;
      padding: 20px 24px;
      box-sizing: border-box;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 14.5px;
      line-height: 1.65;
      word-break: break-word;
      overflow-wrap: break-word;
      max-width: 100%;
    }
    /* Modern sleek micro-scrollbar matching app theme */
    ::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }
    ::-webkit-scrollbar-track {
      background: transparent;
    }
    ::-webkit-scrollbar-thumb {
      background: ${isDark ? "rgba(255, 255, 255, 0.18)" : "rgba(15, 23, 42, 0.18)"};
      border-radius: 4px;
    }
    ::-webkit-scrollbar-thumb:hover {
      background: ${isDark ? "rgba(255, 255, 255, 0.3)" : "rgba(15, 23, 42, 0.35)"};
    }
    a {
      color: ${link} !important;
      text-decoration: underline;
    }
    img, video, canvas, svg {
      max-width: 100% !important;
      height: auto !important;
      border-radius: 6px;
    }
    table {
      max-width: 100% !important;
      border-collapse: collapse;
    }
    ${darkInversionCss}
  </style></head><body>${body}</body></html>`;
}
