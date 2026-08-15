import { useEffect, useRef, useState } from "react";
import {
  Alert,
  AppBar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Menu,
  MenuItem,
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
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import { mailSend, mailSaveDraft, hasDesktopApi } from "../../lib/ipc";
import { useAccountsStore } from "../accounts/store";
import { useMailStore } from "../mail/store";
import type { MailMessage } from "../mail/types";
import { useToastStore } from "../shell/toastStore";
import {
  AiRequestError,
  cancelRequest,
  composeFromPrompt,
  createAiRequestId,
  rewriteTone,
} from "../ai/router";
import { useAiSettings } from "../ai/settingsStore";
import RichTextEditor from "./RichTextEditor";
import {
  fileToAttachment,
  formatBytes,
  totalAttachmentBytes,
  validateAttachmentBatch,
  type LocalAttachment,
} from "./attachments";
import { runPreSendCheck, type PreSendIssue } from "./preSendCheck";
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
  const composeSeed = useMailStore((s) => s.composeSeed);
  const setComposeSeed = useMailStore((s) => s.setComposeSeed);
  const seedTo = composeSeed?.to ?? initialTo;
  const seedSubject = composeSeed?.subject ?? initialSubject;
  const seedBody = composeSeed?.body ?? initialBody;

  const [to, setTo] = useState(seedTo);
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState(seedSubject);
  const [html, setHtml] = useState(() => (seedBody ? plainToHtml(seedBody) : ""));
  const [plain, setPlain] = useState(seedBody);
  const [attachments, setAttachments] = useState<LocalAttachment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);
  const [promptText, setPromptText] = useState("");
  const [toneMenuEl, setToneMenuEl] = useState<null | HTMLElement>(null);
  const [preSendIssues, setPreSendIssues] = useState<PreSendIssue[]>([]);
  const [preSendDialogOpen, setPreSendDialogOpen] = useState(false);
  /** Bump to remount TipTap after external AI body replace. */
  const [editorEpoch, setEditorEpoch] = useState(0);
  /** Mount TipTap after compose enter animation (transform parent blanks ProseMirror). */
  const [editorReady, setEditorReady] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const aiReqIdRef = useRef<string | null>(null);

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const delay = reduced ? 0 : 360;
    const t = window.setTimeout(() => setEditorReady(true), delay);
    return () => window.clearTimeout(t);
  }, []);

  // Consume seed once so reopening compose doesn't stick forever
  useEffect(() => {
    if (composeSeed) setComposeSeed(null);
  }, [composeSeed, setComposeSeed]);

  const activeAccountId = useAccountsStore((s) => s.activeAccountId);
  const accounts = useAccountsStore((s) => s.accounts);
  const fromEmail = accounts.find((a) => a.id === activeAccountId)?.email ?? accounts[0]?.email;
  const hydrate = useMailStore((s) => s.hydrate);
  const setFolder = useMailStore((s) => s.setFolder);
  const select = useMailStore((s) => s.select);
  const setView = useMailStore((s) => s.setView);
  const setComposeOpen = useMailStore((s) => s.setComposeOpen);
  const showToast = useToastStore((s) => s.showToast);
  const mode = useAiSettings((s) => s.mode);
  const hasCloudApiKey = useAiSettings((s) => s.hasCloudApiKey);

  function applyAiBody(text: string) {
    setPlain(text);
    setHtml(plainToHtml(text));
    setEditorEpoch((n) => n + 1);
  }

  async function cancelOngoingAi() {
    const id = aiReqIdRef.current;
    aiReqIdRef.current = null;
    if (id) {
      await cancelRequest(id);
    }
    setAiBusy(false);
    showToast("已取消 AI 请求", "info", 2000);
  }

  async function runComposePrompt() {
    const p = promptText.trim();
    if (!p) {
      showToast("请输入写作提示", "error");
      return;
    }
    if (mode === "cloud" && !hasCloudApiKey) {
      showToast("未配置云端 API Key，请到设置 → AI", "error");
      return;
    }
    const reqId = createAiRequestId();
    aiReqIdRef.current = reqId;
    setAiBusy(true);
    try {
      const out = await composeFromPrompt(p, plain, { mode, requestId: reqId });
      if (aiReqIdRef.current !== reqId) return;
      applyAiBody(out);
      setPromptOpen(false);
      setPromptText("");
      showToast("已生成正文，请检查后发送", "success", 3000);
    } catch (e) {
      if (aiReqIdRef.current !== reqId || (e instanceof AiRequestError && e.code === "ABORTED")) {
        return;
      }
      const msg = e instanceof AiRequestError ? e.message : String(e);
      showToast(msg, "error", 6000);
    } finally {
      if (aiReqIdRef.current === reqId) {
        aiReqIdRef.current = null;
        setAiBusy(false);
      }
    }
  }

  async function runPolish(tone: "shorter" | "formal" | "expand") {
    setToneMenuEl(null);
    const src = plain.trim() || stripHtmlQuick(html);
    if (!src) {
      showToast("请先写一点正文再润色", "error");
      return;
    }
    if (mode === "cloud" && !hasCloudApiKey) {
      showToast("未配置云端 API Key，请到设置 → AI", "error");
      return;
    }
    const reqId = createAiRequestId();
    aiReqIdRef.current = reqId;
    setAiBusy(true);
    try {
      const out = await rewriteTone(src, tone, { mode, requestId: reqId });
      if (aiReqIdRef.current !== reqId) return;
      applyAiBody(out);
      showToast("已润色", "success", 2000);
    } catch (e) {
      if (aiReqIdRef.current !== reqId || (e instanceof AiRequestError && e.code === "ABORTED")) {
        return;
      }
      const msg = e instanceof AiRequestError ? e.message : String(e);
      showToast(msg, "error", 6000);
    } finally {
      if (aiReqIdRef.current === reqId) {
        aiReqIdRef.current = null;
        setAiBusy(false);
      }
    }
  }

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

  async function send(force = false) {
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

    if (!force) {
      const issues = runPreSendCheck({
        subject,
        bodyText,
        attachmentsCount: attachments.length,
      });
      if (issues.length > 0) {
        setPreSendIssues(issues);
        setPreSendDialogOpen(true);
        return;
      }
    }

    setSending(true);
    setPreSendDialogOpen(false);
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
            startIcon={<AutoAwesomeIcon />}
            onClick={() => setPromptOpen(true)}
            disabled={sending || aiBusy}
            aria-label="AI 根据提示生成"
          >
            AI 帮写
          </Button>
          <Button
            onClick={(e) => setToneMenuEl(e.currentTarget)}
            disabled={sending || aiBusy}
            aria-label="AI 润色"
          >
            {aiBusy ? "AI…" : "润色"}
          </Button>
          <Menu
            anchorEl={toneMenuEl}
            open={Boolean(toneMenuEl)}
            onClose={() => setToneMenuEl(null)}
          >
            <MenuItem onClick={() => void runPolish("shorter")}>更短一点</MenuItem>
            <MenuItem onClick={() => void runPolish("formal")}>更正式</MenuItem>
            <MenuItem onClick={() => void runPolish("expand")}>扩写</MenuItem>
          </Menu>
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
              key={editorEpoch}
              valueHtml={html}
              disabled={sending || aiBusy}
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
        {aiBusy && (
          <Alert
            severity="info"
            icon={<CircularProgress size={18} />}
            action={
              <Button color="inherit" size="small" onClick={() => void cancelOngoingAi()}>
                取消
              </Button>
            }
          >
            AI 生成中（{mode === "local" ? "本机" : "云端"}）…
          </Alert>
        )}
      </Stack>

      <Dialog
        open={promptOpen}
        onClose={() => {
          if (aiBusy) void cancelOngoingAi();
          setPromptOpen(false);
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>根据提示生成正文</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            multiline
            minRows={3}
            margin="dense"
            label="提示"
            placeholder="例如：婉拒下周会议，建议改到下个月，语气礼貌"
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            disabled={aiBusy}
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
            将写入正文供你编辑；不会自动发送。模式：{mode === "local" ? "本机 Ollama" : "云端"}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              if (aiBusy) void cancelOngoingAi();
              setPromptOpen(false);
            }}
          >
            {aiBusy ? "取消生成" : "取消"}
          </Button>
          <Button
            variant="contained"
            onClick={() => void runComposePrompt()}
            disabled={aiBusy}
            startIcon={aiBusy ? <CircularProgress size={14} color="inherit" /> : undefined}
          >
            {aiBusy ? "生成中…" : "生成"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={preSendDialogOpen}
        onClose={() => setPreSendDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        data-testid="presend-check-dialog"
      >
        <DialogTitle sx={{ pb: 1 }}>发信前检查提醒</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            系统检测到当前邮件可能存在以下需要注意的事项，请确认：
          </Typography>
          <Stack spacing={1.5}>
            {preSendIssues.map((issue, idx) => (
              <Alert
                key={idx}
                severity={issue.severity}
                variant="outlined"
                sx={{
                  "& .MuiAlert-message": { width: "100%" },
                }}
              >
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.25 }}>
                  {issue.title}
                </Typography>
                <Typography variant="body2">{issue.detail}</Typography>
              </Alert>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setPreSendDialogOpen(false)}>返回修改</Button>
          <Button
            variant="contained"
            color="primary"
            onClick={() => void send(true)}
            data-testid="presend-proceed-btn"
          >
            仍然发送
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function stripHtmlQuick(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
