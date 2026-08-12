import { useEffect, useRef, useState } from "react";
import {
  Alert,
  AppBar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Skeleton,
  Stack,
  TextField,
  Toolbar,
  Typography,
} from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import CloseIcon from "@mui/icons-material/Close";
import InsertDriveFileOutlinedIcon from "@mui/icons-material/InsertDriveFileOutlined";
import { mailSend, mailSaveDraft, hasDesktopApi } from "../../lib/ipc";
import { useAccountsStore } from "../accounts/store";
import { useMailStore } from "../mail/store";
import type { MailMessage } from "../mail/types";
import { useToastStore } from "../shell/toastStore";
import RichTextEditor from "./RichTextEditor";
import {
  fileToAttachment,
  formatBytes,
  totalAttachmentBytes,
  validateAttachmentBatch,
  type LocalAttachment,
} from "./attachments";
import { buildReplyQuote } from "./quote";

export { buildReplyQuote };

function plainToHtml(text: string): string {
  if (!text.trim()) return "";
  const esc = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  return `<p>${esc.replace(/\n/g, "<br>")}</p>`;
}

type Props = {
  onSend?: (v: { to: string; subject: string; body: string }) => void;
  onClose?: () => void;
  initialTo?: string;
  initialSubject?: string;
  initialBody?: string;
};

export default function Composer({
  onSend,
  onClose,
  initialTo = "",
  initialSubject = "",
  initialBody = "",
}: Props) {
  const [to, setTo] = useState(initialTo);
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState(initialSubject);
  const [html, setHtml] = useState(() => (initialBody ? plainToHtml(initialBody) : ""));
  const [plain, setPlain] = useState(initialBody);
  const [attachments, setAttachments] = useState<LocalAttachment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  /** Mount TipTap after compose enter animation (transform parent blanks ProseMirror). */
  const [editorReady, setEditorReady] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const delay = reduced ? 0 : 360;
    const t = window.setTimeout(() => setEditorReady(true), delay);
    return () => window.clearTimeout(t);
  }, []);

  const activeAccountId = useAccountsStore((s) => s.activeAccountId);
  const accounts = useAccountsStore((s) => s.accounts);
  const fromEmail = accounts.find((a) => a.id === activeAccountId)?.email ?? accounts[0]?.email;
  const hydrate = useMailStore((s) => s.hydrate);
  const setFolder = useMailStore((s) => s.setFolder);
  const select = useMailStore((s) => s.select);
  const setView = useMailStore((s) => s.setView);
  const setComposeOpen = useMailStore((s) => s.setComposeOpen);
  const showToast = useToastStore((s) => s.showToast);

  function goToDraft(localMessageId: string) {
    setView("mail");
    setFolder("drafts");
    select(localMessageId);
    setComposeOpen(false);
    onClose?.();
  }

  /** Browser / unit-test path: inject a local draft row into the mail store. */
  function saveDraftInStore(opts: {
    to: string;
    cc: string;
    subject: string;
    bodyText: string;
    bodyHtml: string;
  }): string {
    const accountId = activeAccountId ?? accounts[0]?.id ?? "local";
    const from = fromEmail ?? "me@local";
    const now = Date.now();
    const state = useMailStore.getState();
    let draftsFolder = state.folders.find((f) => f.role === "drafts");
    if (!draftsFolder) {
      draftsFolder = { id: "role:drafts", role: "drafts", name: "草稿", unread: 0 };
      useMailStore.setState({ folders: [...state.folders, draftsFolder] });
    }
    const id = `local-draft:${accountId}:${now}`;
    const toLabel = opts.to.trim() || "(未填收件人)";
    const snippetBase = opts.bodyText.replace(/\s+/g, " ").trim().slice(0, 160) || opts.subject || "(无主题)";
    const msg: MailMessage = {
      id,
      accountId,
      folderId: draftsFolder.id,
      folderRole: "drafts",
      uid: -now,
      from,
      fromName: from.split("@")[0] || from,
      subject: opts.subject.trim() || "(无主题)",
      snippet: opts.cc.trim()
        ? `草稿 · 至 ${toLabel}；抄送 ${opts.cc.trim()} · ${snippetBase}`
        : `草稿 · 至 ${toLabel} · ${snippetBase}`,
      date: "刚刚",
      dateMs: now,
      unread: false,
      split: "important",
      html: opts.bodyHtml || undefined,
    };
    useMailStore.setState((s) => ({ messages: [msg, ...s.messages] }));
    return id;
  }

  async function onPickFiles(list: FileList | null) {
    if (!list?.length) return;
    const files = Array.from(list);
    const batchErr = validateAttachmentBatch(
      attachments,
      files.map((f) => ({ size: f.size, name: f.name })),
    );
    if (batchErr) {
      setError(batchErr);
      showToast(batchErr, "error");
      return;
    }
    try {
      const next: LocalAttachment[] = [];
      for (const f of files) {
        next.push(await fileToAttachment(f));
      }
      setAttachments((prev) => [...prev, ...next]);
      setError(null);
      showToast(`已添加 ${next.length} 个附件`, "info", 2000);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      showToast(msg, "error");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }

  async function send() {
    setError(null);
    if (!to.includes("@")) {
      const msg = "收件人不正确";
      setError(msg);
      showToast(msg, "error");
      return;
    }
    if (!fromEmail && hasDesktopApi()) {
      const msg = "请先添加邮箱账号再发送";
      setError(msg);
      showToast(msg, "error");
      return;
    }

    const bodyText = plain.trim() || stripHtmlQuick(html);
    const bodyHtml = html.trim() && html !== "<p></p>" ? html : plainToHtml(bodyText);

    setSending(true);
    try {
      if (!hasDesktopApi()) {
        showToast(
          attachments.length
            ? `已发送（预览模拟）· ${attachments.length} 个附件`
            : "已发送（预览模拟，未走 SMTP）",
          "success",
        );
        onSend?.({ to, subject, body: bodyText });
        return;
      }

      const accountId = activeAccountId ?? accounts[0]?.id;
      const result = await mailSend({
        accountId,
        to,
        cc: cc.trim() || undefined,
        subject,
        body: bodyText,
        html: bodyHtml,
        attachments: attachments.map(({ filename, contentType, contentBase64, size }) => ({
          filename,
          contentType,
          contentBase64,
          size,
        })),
      });
      if (!result.ok) {
        setError(result.error);
        showToast(`发送失败：${result.error}`, "error", 7000);
        return;
      }

      await hydrate(accountId);
      setFolder("sent");
      if (result.localMessageId) select(result.localMessageId);

      const where = result.appendedToServer ? "已写入服务器已发送" : "已写入本地已发送";
      const attNote = attachments.length ? ` · ${attachments.length} 个附件` : "";
      showToast(`发送成功 · 已投递到 ${to}${attNote}（${where}）`, "success", 5000);
      onSend?.({ to, subject, body: bodyText });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      showToast(`发送失败：${msg}`, "error", 7000);
    } finally {
      setSending(false);
    }
  }

  async function saveDraft() {
    setError(null);
    const bodyText = plain.trim() || stripHtmlQuick(html);
    const bodyHtml = html.trim() && html !== "<p></p>" ? html : plainToHtml(bodyText);

    setSaving(true);
    try {
      if (!hasDesktopApi()) {
        const id = saveDraftInStore({ to, cc, subject, bodyText, bodyHtml });
        goToDraft(id);
        showToast("草稿已保存", "success", 3000);
        return;
      }

      if (!fromEmail) {
        const msg = "请先添加邮箱账号再存草稿";
        setError(msg);
        showToast(msg, "error");
        return;
      }

      const accountId = activeAccountId ?? accounts[0]?.id;
      const result = await mailSaveDraft({
        accountId,
        to,
        cc: cc.trim() || undefined,
        subject,
        body: bodyText,
        html: bodyHtml,
      });
      if (!result.ok) {
        setError(result.error);
        showToast(`存草稿失败：${result.error}`, "error", 7000);
        return;
      }

      await hydrate(accountId);
      goToDraft(result.localMessageId);
      const where = result.appendedToServer ? "已同步到服务器草稿箱" : "已写入本地草稿";
      showToast(`草稿已保存（${where}）`, "success", 4000);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      showToast(`存草稿失败：${msg}`, "error", 7000);
    } finally {
      setSaving(false);
    }
  }

  const totalBytes = totalAttachmentBytes(attachments);

  return (
    <Box data-testid="composer" sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <AppBar position="static" color="default" elevation={0} sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Toolbar variant="dense" sx={{ gap: 1 }}>
          <Button startIcon={<ArrowBackIcon />} onClick={onClose} aria-label="关闭写信" disabled={sending}>
            返回
          </Button>
          <Typography variant="subtitle1" sx={{ flex: 1 }}>
            写新邮件
            {fromEmail ? (
              <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                发件人 {fromEmail}
              </Typography>
            ) : null}
          </Typography>
          <Button
            startIcon={<AttachFileIcon />}
            onClick={() => fileInputRef.current?.click()}
            disabled={sending}
          >
            附件
          </Button>
          <Button
            onClick={() => void saveDraft()}
            disabled={saving || sending}
            startIcon={saving ? <CircularProgress size={14} color="inherit" /> : undefined}
          >
            {saving ? "保存中…" : "存草稿"}
          </Button>
          <Button onClick={onClose} disabled={sending}>
            丢弃
          </Button>
          <Button
            variant="contained"
            endIcon={sending ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
            onClick={() => void send()}
            disabled={sending}
          >
            {sending ? "发送中…" : "发送"}
          </Button>
        </Toolbar>
      </AppBar>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        hidden
        data-testid="attachment-input"
        onChange={(e) => void onPickFiles(e.target.files)}
      />

      <Stack spacing={1.5} sx={{ p: 2, flex: 1, overflow: "auto", minHeight: 0 }}>
        <TextField
          label="收件人"
          placeholder="添加收件人…"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          fullWidth
          size="small"
          slotProps={{ htmlInput: { "aria-label": "收件人" } }}
        />
        <TextField
          label="抄送"
          placeholder="可选"
          value={cc}
          onChange={(e) => setCc(e.target.value)}
          fullWidth
          size="small"
          slotProps={{ htmlInput: { "aria-label": "抄送" } }}
        />
        <TextField
          label="主题"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          fullWidth
          size="small"
          slotProps={{ htmlInput: { "aria-label": "主题" } }}
        />

        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: "block" }}>
            正文（富文本）
          </Typography>
          {editorReady ? (
            <RichTextEditor
              valueHtml={html}
              disabled={sending}
              onChange={(nextHtml, nextPlain) => {
                setHtml(nextHtml);
                setPlain(nextPlain);
              }}
            />
          ) : (
            <Box
              data-testid="rich-text-editor-skeleton"
              sx={{
                border: 1,
                borderColor: "divider",
                borderRadius: 2,
                p: 1.5,
                minHeight: 200,
              }}
            >
              <Skeleton variant="rounded" height={28} sx={{ mb: 1, maxWidth: 280 }} />
              <Skeleton variant="rounded" height={140} />
            </Box>
          )}
        </Box>

        <Box>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 0.75 }}>
            <Typography variant="caption" color="text.secondary">
              附件
              {attachments.length > 0
                ? ` · ${attachments.length} 个 · ${formatBytes(totalBytes)}`
                : " · 可添加多个文件"}
            </Typography>
            <Button
              size="small"
              startIcon={<AttachFileIcon />}
              onClick={() => fileInputRef.current?.click()}
              disabled={sending}
            >
              添加附件
            </Button>
          </Stack>
          {attachments.length === 0 ? (
            <Typography variant="body2" color="text.disabled">
              尚未添加附件
            </Typography>
          ) : (
            <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
              {attachments.map((a) => (
                <Chip
                  key={a.id}
                  icon={<InsertDriveFileOutlinedIcon />}
                  label={`${a.filename} (${formatBytes(a.size)})`}
                  onDelete={sending ? undefined : () => removeAttachment(a.id)}
                  deleteIcon={<CloseIcon fontSize="small" />}
                  variant="outlined"
                  sx={{ maxWidth: "100%" }}
                />
              ))}
            </Stack>
          )}
        </Box>

        {error && (
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        {sending && (
          <Alert severity="info" icon={<CircularProgress size={18} />}>
            正在通过 SMTP 发送
            {attachments.length ? `（含 ${attachments.length} 个附件）` : ""}…
          </Alert>
        )}
      </Stack>
    </Box>
  );
}

function stripHtmlQuick(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
