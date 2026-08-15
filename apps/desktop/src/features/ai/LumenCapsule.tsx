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
  suggestSplit,
  summarize,
  summarizeThread,
  translateText,
  type ActionItemsData,
  type SuggestSplitData,
  type ThreadSummaryData,
} from "./router";
import { useAiSettings } from "./settingsStore";
import { useMailStore } from "../mail/store";
import { useToastStore } from "../shell/toastStore";

type CapsuleState = "idle" | "thinking" | "expanded";
type ResultKind = "summary" | "draft" | "actionItems" | "threadSummary" | "suggestSplit" | "translation";

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
  /** Current split of this message */
  currentSplit?: "important" | "other";
  /** Chronological messages in thread if available */
  threadMessages?: { sender: string; date?: string; body: string }[];
  /** Reply target when inserting draft */
  replyTo?: string;
  onInsertDraft?: (draftText: string, replySubject: string, replyTo: string) => void;
  /** Explicit user confirmation to apply split suggestion */
  onApplySplit?: (split: "important" | "other") => void;
};

export default function LumenCapsule({
  subject,
  from,
  body,
  currentSplit,
  threadMessages,
  replyTo,
  onInsertDraft,
  onApplySplit,
}: Props) {
  const mode = useAiSettings((s) => s.mode);
  const hasCloudApiKey = useAiSettings((s) => s.hasCloudApiKey);
  const openCompose = useMailStore((s) => s.openCompose);
  const setView = useMailStore((s) => s.setView);
  const showToast = useToastStore((s) => s.showToast);

  const [state, setState] = useState<CapsuleState>("idle");
  const [text, setText] = useState("");
  const [actionItemsData, setActionItemsData] = useState<ActionItemsData | null>(null);
  const [threadSummaryData, setThreadSummaryData] = useState<ThreadSummaryData | null>(null);
  const [suggestSplitData, setSuggestSplitData] = useState<SuggestSplitData | null>(null);
  const [checkedItems, setCheckedItems] = useState<Record<number, boolean>>({});
  const [kind, setKind] = useState<ResultKind>("summary");
  const [error, setError] = useState<string | null>(null);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<
    "summary" | "draft" | "actionItems" | "threadSummary" | "suggestSplit" | "translation" | { type: "quick"; replyType: string } | null
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
    if (text || actionItemsData || threadSummaryData || suggestSplitData) {
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

  async function runThreadSummary() {
    const msgs =
      threadMessages && threadMessages.length > 0
        ? threadMessages
        : [{ sender: from || "未知发件人", date: undefined, body }];

    if (mode === "cloud" && !hasCloudApiKey) {
      guideSettings("未配置云端 API Key，请到设置 → AI 中填写");
      return;
    }
    if (mode === "cloud" && !ensureCloudPrivacyAck()) {
      setPendingAction("threadSummary");
      setPrivacyOpen(true);
      return;
    }
    const reqId = createAiRequestId();
    activeReqIdRef.current = reqId;
    setPendingAction(null);
    setError(null);
    setState("thinking");
    setKind("threadSummary");
    try {
      const res = await summarizeThread(msgs, subject, { mode, requestId: reqId });
      if (activeReqIdRef.current !== reqId) return;
      setThreadSummaryData(res);
      setState("expanded");
    } catch (e) {
      if (activeReqIdRef.current !== reqId) {
        return;
      }
      if (e instanceof AiRequestError && e.code === "ABORTED") {
        setState(text || actionItemsData || threadSummaryData || suggestSplitData ? "expanded" : "idle");
        return;
      }
      const msg = e instanceof AiRequestError ? e.message : "线索摘要失败，请稍后重试";
      setError(msg);
      setState("idle");
      showToast(msg, "error", 6000);
    } finally {
      if (activeReqIdRef.current === reqId) {
        activeReqIdRef.current = null;
      }
    }
  }

  async function runSuggestSplit() {
    if (mode === "cloud" && !hasCloudApiKey) {
      guideSettings("未配置云端 API Key，请到设置 → AI 中填写");
      return;
    }
    if (mode === "cloud" && !ensureCloudPrivacyAck()) {
      setPendingAction("suggestSplit");
      setPrivacyOpen(true);
      return;
    }
    const reqId = createAiRequestId();
    activeReqIdRef.current = reqId;
    setPendingAction(null);
    setError(null);
    setState("thinking");
    setKind("suggestSplit");
    try {
      const res = await suggestSplit({ subject, from, body }, { mode, requestId: reqId });
      if (activeReqIdRef.current !== reqId) return;
      setSuggestSplitData(res);
      setState("expanded");
    } catch (e) {
      if (activeReqIdRef.current !== reqId) {
        return;
      }
      if (e instanceof AiRequestError && e.code === "ABORTED") {
        setState(text || actionItemsData || threadSummaryData || suggestSplitData ? "expanded" : "idle");
        return;
      }
      const msg = e instanceof AiRequestError ? e.message : "分箱建议分析失败，请稍后重试";
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
        setState(text || actionItemsData || threadSummaryData || suggestSplitData ? "expanded" : "idle");
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
        setState(text || actionItemsData || threadSummaryData || suggestSplitData ? "expanded" : "idle");
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
    setThreadSummaryData(null);
    setSuggestSplitData(null);
    setCheckedItems({});
    setError(null);
  }

  async function runTranslate(targetLang: "zh" | "en" = "zh") {
    if (mode === "cloud" && !hasCloudApiKey) {
      guideSettings("未配置云端 API Key，请到设置 → AI 中填写");
      return;
    }
    if (mode === "cloud" && !ensureCloudPrivacyAck()) {
      setPendingAction("translation");
      setPrivacyOpen(true);
      return;
    }
    const reqId = createAiRequestId();
    activeReqIdRef.current = reqId;
    setPendingAction(null);
    setError(null);
    setState("thinking");
    setKind("translation");
    try {
      const res = await translateText(body, targetLang, { mode, requestId: reqId });
      if (activeReqIdRef.current !== reqId) return;
      setText(res);
      setState("expanded");
    } catch (e) {
      if (activeReqIdRef.current !== reqId) {
        return;
      }
      if (e instanceof AiRequestError && e.code === "ABORTED") {
        setState(text || actionItemsData || threadSummaryData || suggestSplitData ? "expanded" : "idle");
        return;
      }
      const msg = e instanceof AiRequestError ? e.message : "翻译失败，请稍后重试";
      setError(msg);
      setState("idle");
      showToast(msg, "error", 6000);
    } finally {
      if (activeReqIdRef.current === reqId) {
        activeReqIdRef.current = null;
      }
    }
  }

  async function acceptPrivacy() {
    await ackCloudPrivacy();
    setPrivacyOpen(false);
    if (pendingAction === "summary") void runSummary();
    else if (pendingAction === "draft") void runDraft();
    else if (pendingAction === "actionItems") void runActionItems();
    else if (pendingAction === "threadSummary") void runThreadSummary();
    else if (pendingAction === "suggestSplit") void runSuggestSplit();
    else if (pendingAction === "translation") void runTranslate();
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
            {Boolean(threadMessages && threadMessages.length > 1) && (
              <Button
                size="small"
                color="inherit"
                onClick={() => void runThreadSummary()}
                sx={{ minWidth: 0, px: 1 }}
                data-testid="thread-summary-button"
              >
                线程摘要
              </Button>
            )}
            <Button size="small" color="inherit" onClick={() => void runDraft()} sx={{ minWidth: 0, px: 1 }}>
              写回复
            </Button>
            <Button size="small" color="inherit" onClick={() => void runActionItems()} sx={{ minWidth: 0, px: 1 }}>
              行动项
            </Button>
            <Button
              size="small"
              color="inherit"
              onClick={() => void runSuggestSplit()}
              sx={{ minWidth: 0, px: 1 }}
              data-testid="suggest-split-button"
            >
              建议分箱
            </Button>
            <Button
              size="small"
              color="inherit"
              onClick={() => void runTranslate()}
              sx={{ minWidth: 0, px: 1 }}
              data-testid="translate-button"
            >
              翻译
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
          maxHeight: "min(46vh, 380px)",
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
              {kind === "summary"
                ? "摘要"
                : kind === "draft"
                  ? "草稿回复"
                  : kind === "actionItems"
                    ? "行动项与意图"
                    : kind === "threadSummary"
                      ? "线索时间线摘要"
                      : kind === "suggestSplit"
                        ? "AI 分箱建议"
                        : "邮件翻译"}
            </Typography>
            <Chip
              size="small"
              label={mode === "local" ? "本机" : "云端"}
              color="primary"
              variant="outlined"
              sx={{ ml: "auto", height: 22 }}
            />
          </Stack>

          {kind === "suggestSplit" ? (
            <Stack spacing={1.5} sx={{ flex: 1, minHeight: 0, overflow: "auto", pr: 0.5 }}>
              {suggestSplitData && (
                <Paper
                  variant="outlined"
                  data-testid="suggest-split-card"
                  sx={{
                    p: 1.5,
                    borderRadius: 2,
                    bgcolor: (t) =>
                      t.palette.mode === "dark" ? "rgba(255, 255, 255, 0.04)" : "rgba(0, 0, 0, 0.02)",
                    borderColor: "divider",
                  }}
                >
                  <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1, flexWrap: "wrap", gap: 0.5 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      建议分箱:
                    </Typography>
                    <Chip
                      size="small"
                      data-testid="suggested-split-chip"
                      label={suggestSplitData.split === "important" ? "重要" : "其他"}
                      color={suggestSplitData.split === "important" ? "primary" : "default"}
                      variant="filled"
                      sx={{ fontWeight: 600, height: 24 }}
                    />
                    {suggestSplitData.confidence && (
                      <Chip
                        size="small"
                        label={`置信度: ${
                          suggestSplitData.confidence === "high"
                            ? "高"
                            : suggestSplitData.confidence === "medium"
                              ? "中"
                              : "低"
                        }`}
                        variant="outlined"
                        sx={{ height: 20, "& .MuiChip-label": { px: 0.5, fontSize: "0.65rem" } }}
                      />
                    )}
                  </Stack>

                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ fontWeight: 600, display: "block", mb: 0.25 }}
                  >
                    分析依据
                  </Typography>
                  <Typography variant="body2" sx={{ fontSize: "0.85rem", color: "text.primary" }}>
                    {suggestSplitData.reason}
                  </Typography>

                  {currentSplit && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                      当前分箱：{currentSplit === "important" ? "重要" : "其他"}
                      {currentSplit === suggestSplitData.split ? " (当前已是推荐分箱)" : ""}
                    </Typography>
                  )}
                </Paper>
              )}
            </Stack>
          ) : kind === "threadSummary" ? (
            <Stack spacing={1.25} sx={{ flex: 1, minHeight: 0, overflow: "auto", pr: 0.5 }}>
              {threadSummaryData?.summary && (
                <Paper
                  variant="outlined"
                  data-testid="thread-overall-summary"
                  sx={{
                    p: 1,
                    borderRadius: 1.5,
                    bgcolor: (t) =>
                      t.palette.mode === "dark" ? "rgba(255, 255, 255, 0.04)" : "rgba(0, 0, 0, 0.02)",
                    borderColor: "divider",
                  }}
                >
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ fontWeight: 600, display: "block", mb: 0.25 }}
                  >
                    总体概述
                  </Typography>
                  <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", fontSize: "0.85rem" }}>
                    {threadSummaryData.summary}
                  </Typography>
                </Paper>
              )}

              <Box sx={{ flex: 1, minHeight: 0 }}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontWeight: 600, display: "block", mb: 0.75 }}
                >
                  时间线脉络
                </Typography>
                {!threadSummaryData?.timeline || threadSummaryData.timeline.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    暂无详细时间线记录
                  </Typography>
                ) : (
                  <Stack spacing={1} data-testid="thread-timeline-list" sx={{ position: "relative", pl: 0.5 }}>
                    {threadSummaryData.timeline.map((item, idx) => (
                      <Box
                        key={idx}
                        data-testid="timeline-item"
                        sx={{
                          position: "relative",
                          pl: 1.25,
                          borderLeft: "2px solid",
                          borderColor: "primary.main",
                        }}
                      >
                        <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", mb: 0.25 }}>
                          <Typography variant="caption" sx={{ fontWeight: 600, color: "text.primary" }}>
                            {item.sender}
                          </Typography>
                          {item.date && (
                            <Chip
                              size="small"
                              label={item.date}
                              variant="outlined"
                              sx={{ height: 18, "& .MuiChip-label": { px: 0.5, fontSize: "0.65rem" } }}
                            />
                          )}
                        </Stack>
                        <Typography variant="body2" sx={{ fontSize: "0.8rem", color: "text.secondary" }}>
                          {item.point}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                )}
              </Box>
            </Stack>
          ) : kind === "actionItems" ? (
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
            {kind !== "actionItems" && kind !== "threadSummary" && kind !== "suggestSplit" && (
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
            {kind === "suggestSplit" && suggestSplitData && (
              <Button
                size="small"
                variant="contained"
                data-testid="apply-split-button"
                onClick={() => {
                  if (onApplySplit) {
                    onApplySplit(suggestSplitData.split);
                  }
                  showToast(
                    `已采纳建议并标记为「${suggestSplitData.split === "important" ? "重要" : "其他"}」`,
                    "success",
                    3000,
                  );
                  close();
                }}
              >
                {suggestSplitData.split === "important" ? "采纳移至重要" : "采纳移至其他"}
              </Button>
            )}
            {kind === "threadSummary" && threadSummaryData && (
              <Button
                size="small"
                variant="contained"
                onClick={() => {
                  const timelineText = threadSummaryData.timeline
                    .map((t) => `- [${t.date ? `${t.date} ` : ""}${t.sender}]: ${t.point}`)
                    .join("\n");
                  const copyContent = `【线索摘要】\n${threadSummaryData.summary}\n\n【时间线】\n${timelineText}`;
                  void navigator.clipboard?.writeText(copyContent);
                  showToast("已复制线索时间线摘要", "info", 2000);
                }}
              >
                复制摘要
              </Button>
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
            {(kind === "summary" || kind === "translation") && (
              <Button
                size="small"
                variant="contained"
                onClick={() => {
                  void navigator.clipboard?.writeText(text);
                  showToast(kind === "translation" ? "已复制译文" : "已复制摘要", "info", 2000);
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
