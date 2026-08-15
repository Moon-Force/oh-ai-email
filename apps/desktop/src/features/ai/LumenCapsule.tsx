import { useRef, useState } from "react";
import {
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import {
  AiRequestError,
  ackCloudPrivacy,
  cancelRequest,
  createAiRequestId,
  draftReply,
  ensureCloudPrivacyAck,
  extractActionItems,
  quickReplyDraft,
  rewriteTone,
  summarize,
  type ActionItemsData,
} from "./router";
import { useAiSettings } from "./settingsStore";
import { useMailStore } from "../mail/store";
import { useToastStore } from "../shell/toastStore";

type CapsuleState = "idle" | "thinking" | "expanded";
type ResultKind = "summary" | "draft" | "actionItems";

export const QUICK_REPLY_OPTIONS = [
  { key: "ack", label: "收到谢谢" },
  { key: "agree", label: "确认推进" },
  { key: "defer", label: "稍后回复" },
  { key: "decline", label: "礼貌婉拒" },
] as const;

type Props = {
  subject?: string;
  from?: string;
  body: string;
  /** Reply target when inserting draft */
  replyTo?: string;
  onInsertDraft?: (draftText: string, replySubject: string, replyTo: string) => void;
};

export default function LumenCapsule({ subject, from, body, replyTo, onInsertDraft }: Props) {
  const mode = useAiSettings((s) => s.mode);
  const hasCloudApiKey = useAiSettings((s) => s.hasCloudApiKey);
  const openCompose = useMailStore((s) => s.openCompose);
  const setView = useMailStore((s) => s.setView);
  const showToast = useToastStore((s) => s.showToast);

  const [state, setState] = useState<CapsuleState>("idle");
  const [text, setText] = useState("");
  const [actionItemsData, setActionItemsData] = useState<ActionItemsData | null>(null);
  const [checkedItems, setCheckedItems] = useState<Record<number, boolean>>({});
  const [kind, setKind] = useState<ResultKind>("summary");
  const [error, setError] = useState<string | null>(null);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<
    "summary" | "draft" | "actionItems" | { type: "quick"; replyType: string } | null
  >(null);
  const activeReqIdRef = useRef<string | null>(null);

  function guideSettings(msg: string) {
    setError(msg);
    showToast(msg, "error", 5000);
  }

  async function handleCancel() {
    const id = activeReqIdRef.current;
    activeReqIdRef.current = null;
    if (id) {
      await cancelRequest(id);
    }
    if (text || actionItemsData) {
      setState("expanded");
    } else {
      setState("idle");
    }
    showToast("已取消 AI 请求", "info", 2000);
  }

  async function runSummary() {
    if (mode === "cloud" && !hasCloudApiKey) {
      guideSettings("未配置云端 API Key，请到设置 → AI 中填写");
      return;
    }
    if (mode === "cloud" && !ensureCloudPrivacyAck()) {
      setPendingAction("summary");
      setPrivacyOpen(true);
      return;
    }
    const reqId = createAiRequestId();
    activeReqIdRef.current = reqId;
    setPendingAction(null);
    setError(null);
    setState("thinking");
    setKind("summary");
    try {
      const s = await summarize({ subject, from, body }, { mode, requestId: reqId });
      if (activeReqIdRef.current !== reqId) return;
      setText(s);
      setState("expanded");
    } catch (e) {
      if (activeReqIdRef.current !== reqId) {
        return;
      }
      if (e instanceof AiRequestError && e.code === "ABORTED") {
        setState(text || actionItemsData ? "expanded" : "idle");
        return;
      }
      const msg = e instanceof AiRequestError ? e.message : "摘要失败，请稍后重试";
      setError(msg);
      setState("idle");
      showToast(msg, "error", 6000);
    } finally {
      if (activeReqIdRef.current === reqId) {
        activeReqIdRef.current = null;
      }
    }
  }

  async function runDraft() {
    if (mode === "cloud" && !hasCloudApiKey) {
      guideSettings("未配置云端 API Key，请到设置 → AI 中填写");
      return;
    }
    if (mode === "cloud" && !ensureCloudPrivacyAck()) {
      setPendingAction("draft");
      setPrivacyOpen(true);
      return;
    }
    const reqId = createAiRequestId();
    activeReqIdRef.current = reqId;
    setPendingAction(null);
    setError(null);
    setState("thinking");
    setKind("draft");
    try {
      const d = await draftReply({ subject, from, body }, { mode, requestId: reqId });
      if (activeReqIdRef.current !== reqId) return;
      setText(d);
      setState("expanded");
    } catch (e) {
      if (activeReqIdRef.current !== reqId) {
        return;
      }
      if (e instanceof AiRequestError && e.code === "ABORTED") {
        setState(text || actionItemsData ? "expanded" : "idle");
        return;
      }
      const msg = e instanceof AiRequestError ? e.message : "写回复失败，请稍后重试";
      setError(msg);
      setState("idle");
      showToast(msg, "error", 6000);
    } finally {
      if (activeReqIdRef.current === reqId) {
        activeReqIdRef.current = null;
      }
    }
  }

  async function runActionItems() {
    if (mode === "cloud" && !hasCloudApiKey) {
      guideSettings("未配置云端 API Key，请到设置 → AI 中填写");
      return;
    }
    if (mode === "cloud" && !ensureCloudPrivacyAck()) {
      setPendingAction("actionItems");
      setPrivacyOpen(true);
      return;
    }
    const reqId = createAiRequestId();
    activeReqIdRef.current = reqId;
    setPendingAction(null);
    setError(null);
    setState("thinking");
    setKind("actionItems");
    try {
      const res = await extractActionItems({ subject, from, body }, { mode, requestId: reqId });
      if (activeReqIdRef.current !== reqId) return;
      setActionItemsData(res);
      setCheckedItems({});
      setState("expanded");
    } catch (e) {
      if (activeReqIdRef.current !== reqId) {
        return;
      }
      if (e instanceof AiRequestError && e.code === "ABORTED") {
        setState(text || actionItemsData ? "expanded" : "idle");
        return;
      }
      const msg = e instanceof AiRequestError ? e.message : "提取行动项失败，请稍后重试";
      setError(msg);
      setState("idle");
      showToast(msg, "error", 6000);
    } finally {
      if (activeReqIdRef.current === reqId) {
        activeReqIdRef.current = null;
      }
    }
  }

  async function runQuickReply(replyType: string) {
    if (mode === "cloud" && !hasCloudApiKey) {
      guideSettings("未配置云端 API Key，请到设置 → AI 中填写");
      return;
    }
    if (mode === "cloud" && !ensureCloudPrivacyAck()) {
      setPendingAction({ type: "quick", replyType });
      setPrivacyOpen(true);
      return;
    }
    const reqId = createAiRequestId();
    activeReqIdRef.current = reqId;
    setPendingAction(null);
    setError(null);
    setState("thinking");
    try {
      const d = await quickReplyDraft(
        { subject, from, body, replyType },
        { mode, requestId: reqId },
      );
      if (activeReqIdRef.current !== reqId) return;
      const reSubject = subject?.trim()
        ? subject.trim().toLowerCase().startsWith("re:")
          ? subject.trim()
          : `Re: ${subject.trim()}`
        : "Re:";
      const targetTo = replyTo || from || "";

      if (onInsertDraft) {
        onInsertDraft(d, reSubject, targetTo);
      } else {
        openCompose({
          to: targetTo,
          subject: reSubject,
          body: d,
        });
      }
      showToast("已生成快捷回复并插入写信，请确认后发送", "success", 3500);
      setState("idle");
    } catch (e) {
      if (activeReqIdRef.current !== reqId) {
        return;
      }
      if (e instanceof AiRequestError && e.code === "ABORTED") {
        setState(text || actionItemsData ? "expanded" : "idle");
        return;
      }
      const msg = e instanceof AiRequestError ? e.message : "快捷回复失败，请稍后重试";
      setError(msg);
      setState("idle");
      showToast(msg, "error", 6000);
    } finally {
      if (activeReqIdRef.current === reqId) {
        activeReqIdRef.current = null;
      }
    }
  }

  async function runTone(tone: "shorter" | "formal" | "expand") {
    const reqId = createAiRequestId();
    activeReqIdRef.current = reqId;
    setError(null);
    setState("thinking");
    try {
      const next = await rewriteTone(text || body, tone, { mode, requestId: reqId });
      if (activeReqIdRef.current !== reqId) return;
      setText(next);
      setKind("draft");
      setState("expanded");
    } catch (e) {
      if (activeReqIdRef.current !== reqId) {
        return;
      }
      if (e instanceof AiRequestError && e.code === "ABORTED") {
        setState(text || actionItemsData ? "expanded" : "idle");
        return;
      }
      const msg = e instanceof AiRequestError ? e.message : "改写失败，请稍后重试";
      setError(msg);
      setState("expanded");
      showToast(msg, "error", 6000);
    } finally {
      if (activeReqIdRef.current === reqId) {
        activeReqIdRef.current = null;
      }
    }
  }

  function insertDraft() {
    const reSubject = subject?.trim()
      ? subject.trim().toLowerCase().startsWith("re:")
        ? subject.trim()
        : `Re: ${subject.trim()}`
      : "Re:";
    const targetTo = replyTo || from || "";
    if (onInsertDraft) {
      onInsertDraft(text, reSubject, targetTo);
    } else {
      openCompose({
        to: targetTo,
        subject: reSubject,
        body: text,
      });
    }
    showToast("已插入写信，请确认后发送", "success", 3000);
  }

  function close() {
    setState("idle");
    setText("");
    setActionItemsData(null);
    setCheckedItems({});
    setError(null);
  }

  async function acceptPrivacy() {
    await ackCloudPrivacy();
    setPrivacyOpen(false);
    if (pendingAction === "summary") void runSummary();
    else if (pendingAction === "draft") void runDraft();
    else if (pendingAction === "actionItems") void runActionItems();
    else if (pendingAction && typeof pendingAction === "object" && pendingAction.type === "quick") {
      void runQuickReply(pendingAction.replyType);
    }
  }

  if (state === "idle") {
    return (
      <>
        <Stack direction="column" spacing={0.75} sx={{ alignItems: "flex-end" }}>
          <Paper
            elevation={4}
            data-testid="lumen-capsule"
            data-state="idle"
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 0.75,
              px: 1.25,
              py: 0.5,
              borderRadius: 999,
              border: 1,
              borderColor: "divider",
              bgcolor: "background.paper",
            }}
          >
            <AutoAwesomeIcon color="primary" fontSize="small" />
            <Typography variant="caption" sx={{ fontWeight: 600, whiteSpace: "nowrap" }}>
              AI
            </Typography>
            <Button size="small" onClick={() => void runSummary()} sx={{ minWidth: 0, px: 1 }}>
              总结
            </Button>
            <Button size="small" color="inherit" onClick={() => void runDraft()} sx={{ minWidth: 0, px: 1 }}>
              写回复
            </Button>
            <Button size="small" color="inherit" onClick={() => void runActionItems()} sx={{ minWidth: 0, px: 1 }}>
              行动项
            </Button>
            <Chip
              size="small"
              label={mode === "local" ? "本机" : "云端"}
              color="primary"
              variant="outlined"
              sx={{ height: 22, "& .MuiChip-label": { px: 0.75, fontSize: "0.7rem" } }}
            />
            {error && (
              <Button size="small" color="error" onClick={() => setView("settings")}>
                去设置
              </Button>
            )}
            {error && (
              <Typography variant="caption" color="error" sx={{ maxWidth: 160 }} noWrap title={error}>
                {error}
              </Typography>
            )}
          </Paper>

          <Stack
            direction="row"
            spacing={0.5}
            data-testid="quick-reply-chips"
            sx={{ flexWrap: "wrap", justifyContent: "flex-end", gap: 0.5 }}
          >
            {QUICK_REPLY_OPTIONS.map((opt) => (
              <Chip
                key={opt.key}
                size="small"
                label={opt.label}
                onClick={() => void runQuickReply(opt.key)}
                variant="outlined"
                sx={{
                  bgcolor: "background.paper",
                  cursor: "pointer",
                  fontSize: "0.75rem",
                  height: 24,
                  boxShadow: 1,
                  "&:hover": { bgcolor: "action.hover" },
                }}
              />
            ))}
          </Stack>
        </Stack>
        <PrivacyDialog
          open={privacyOpen}
          onCancel={() => {
            setPrivacyOpen(false);
            setPendingAction(null);
          }}
          onAccept={() => void acceptPrivacy()}
        />
      </>
    );
  }

  if (state === "thinking") {
    return (
      <Paper
        elevation={4}
        data-testid="lumen-capsule"
        data-state="thinking"
        aria-busy
        sx={{
          display: "inline-flex",
          alignItems: "center",
          gap: 1,
          px: 1.5,
          py: 0.5,
          borderRadius: 999,
          border: 1,
          borderColor: "divider",
          bgcolor: "background.paper",
        }}
      >
        <CircularProgress size={16} />
        <Typography variant="caption" sx={{ fontWeight: 500 }}>
          思考中…
        </Typography>
        <Button
          size="small"
          color="inherit"
          onClick={() => void handleCancel()}
          sx={{ minWidth: 0, px: 0.75, py: 0.25, fontSize: "0.75rem" }}
          aria-label="取消 AI 请求"
        >
          取消
        </Button>
      </Paper>
    );
  }

  return (
    <>
      <Paper
        elevation={8}
        data-testid="lumen-capsule"
        data-state="expanded"
        sx={{
          p: 1.5,
          width: { xs: "100%", sm: 380 },
          maxWidth: "100%",
          maxHeight: "min(42vh, 340px)",
          borderRadius: 2.5,
          bgcolor: "background.paper",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <Stack spacing={1} sx={{ minHeight: 0, flex: 1 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexShrink: 0 }}>
            <AutoAwesomeIcon color="primary" fontSize="small" />
            <Typography variant="subtitle2" color="primary">
              {kind === "summary" ? "摘要" : kind === "draft" ? "草稿回复" : "行动项与意图"}
            </Typography>
            <Chip
              size="small"
              label={mode === "local" ? "本机" : "云端"}
              color="primary"
              variant="outlined"
              sx={{ ml: "auto", height: 22 }}
            />
          </Stack>

          {kind === "actionItems" ? (
            <Stack spacing={1} sx={{ flex: 1, minHeight: 0, overflow: "auto", pr: 0.5 }}>
              {actionItemsData?.tags && actionItemsData.tags.length > 0 && (
                <Stack
                  direction="row"
                  spacing={0.5}
                  sx={{ flexWrap: "wrap", gap: 0.5 }}
                  data-testid="intent-tags"
                >
                  {actionItemsData.tags.map((t) => {
                    let color: "warning" | "error" | "primary" | "default" = "default";
                    if (t.includes("回复") || t.toLowerCase().includes("reply")) color = "warning";
                    else if (t.includes("截止") || t.toLowerCase().includes("deadline")) color = "error";
                    else if (t.includes("待办") || t.toLowerCase().includes("action")) color = "primary";
                    return (
                      <Chip
                        key={t}
                        size="small"
                        label={t}
                        color={color}
                        variant="filled"
                        sx={{ height: 22, "& .MuiChip-label": { px: 0.75, fontSize: "0.7rem" } }}
                      />
                    );
                  })}
                  {actionItemsData.deadline && (
                    <Chip
                      size="small"
                      label={`截止: ${actionItemsData.deadline}`}
                      color="error"
                      variant="outlined"
                      sx={{ height: 22, "& .MuiChip-label": { px: 0.75, fontSize: "0.7rem" } }}
                    />
                  )}
                </Stack>
              )}

              <Box sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
                {!actionItemsData?.actionItems || actionItemsData.actionItems.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    未检测到明确的待办事项
                  </Typography>
                ) : (
                  <Stack spacing={0.5} data-testid="action-items-list">
                    {actionItemsData.actionItems.map((item, idx) => (
                      <Stack
                        key={idx}
                        direction="row"
                        spacing={0.5}
                        sx={{ alignItems: "flex-start", cursor: "pointer" }}
                        onClick={() => setCheckedItems((prev) => ({ ...prev, [idx]: !prev[idx] }))}
                      >
                        <Checkbox
                          size="small"
                          checked={Boolean(checkedItems[idx])}
                          sx={{ p: 0.25, mt: "1px" }}
                          aria-label={item}
                        />
                        <Typography
                          variant="body2"
                          sx={{
                            textDecoration: checkedItems[idx] ? "line-through" : "none",
                            color: checkedItems[idx] ? "text.secondary" : "text.primary",
                            wordBreak: "break-word",
                            fontSize: "0.85rem",
                          }}
                        >
                          {item}
                        </Typography>
                      </Stack>
                    ))}
                  </Stack>
                )}
              </Box>
            </Stack>
          ) : (
            <Typography
              variant="body2"
              sx={{ whiteSpace: "pre-wrap", flex: 1, minHeight: 0, overflow: "auto", pr: 0.5 }}
            >
              {text}
            </Typography>
          )}

          {error && (
            <Typography variant="caption" color="error">
              {error}
            </Typography>
          )}
          <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap", gap: 0.5, flexShrink: 0 }}>
            {kind !== "actionItems" && (
              <>
                <Button size="small" variant="outlined" onClick={() => void runTone("shorter")}>
                  更短一点
                </Button>
                <Button size="small" variant="outlined" onClick={() => void runTone("formal")}>
                  更正式
                </Button>
                <Button size="small" variant="outlined" onClick={() => void runTone("expand")}>
                  扩写
                </Button>
              </>
            )}
            {kind === "actionItems" && actionItemsData && (
              <Button
                size="small"
                variant="contained"
                onClick={() => {
                  const itemsText = actionItemsData.actionItems
                    .map((it, i) => `${checkedItems[i] ? "[x]" : "[ ]"} ${it}`)
                    .join("\n");
                  const copyContent = `${actionItemsData.tags.join(" ")}${actionItemsData.deadline ? ` (截止: ${actionItemsData.deadline})` : ""}\n${itemsText}`;
                  void navigator.clipboard?.writeText(copyContent);
                  showToast("已复制行动项", "info", 2000);
                }}
              >
                复制行动项
              </Button>
            )}
            {kind === "draft" && (
              <Button size="small" variant="contained" onClick={insertDraft}>
                插入草稿
              </Button>
            )}
            {kind === "summary" && (
              <Button
                size="small"
                variant="contained"
                onClick={() => {
                  void navigator.clipboard?.writeText(text);
                  showToast("已复制摘要", "info", 2000);
                }}
              >
                复制
              </Button>
            )}
            <Button size="small" onClick={close}>
              关闭
            </Button>
          </Stack>
        </Stack>
      </Paper>
      <PrivacyDialog
        open={privacyOpen}
        onCancel={() => {
          setPrivacyOpen(false);
          setPendingAction(null);
        }}
        onAccept={() => void acceptPrivacy()}
      />
    </>
  );
}

function PrivacyDialog(props: {
  open: boolean;
  onCancel: () => void;
  onAccept: () => void;
}) {
  return (
    <Dialog open={props.open} onClose={props.onCancel}>
      <DialogTitle>云端 AI 隐私提示</DialogTitle>
      <DialogContent>
        <DialogContentText>
          云端模式会将当前邮件的主题与正文发送到你在设置中配置的 API 地址进行处理。附件默认不会上传。本机模式则仅请求本地
          Ollama。
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={props.onCancel}>取消</Button>
        <Button variant="contained" onClick={props.onAccept} autoFocus>
          我知道了
        </Button>
      </DialogActions>
    </Dialog>
  );
}
