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
  Collapse,
  IconButton,
  Tooltip,
} from "@mui/material";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import MailIcon from "@mui/icons-material/Mail";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import VolumeOffIcon from "@mui/icons-material/VolumeOff";
import PsychologyIcon from "@mui/icons-material/Psychology";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import CloseIcon from "@mui/icons-material/Close";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import SendIcon from "@mui/icons-material/Send";
import {
  AiRequestError,
  ackCloudPrivacy,
  cancelRequest,
  createAiRequestId,
  draftReplyDetailed,
  ensureCloudPrivacyAck,
  extractActionItems,
  extractCommitments,
  quickReplyDraft,
  rewriteTone,
  suggestSplit,
  summarizeDetailed,
  summarizeThread,
  translateText,
  type ActionItemsData,
  type CommitmentItem,
  type SuggestSplitData,
  type ThreadSummaryData,
} from "./router";
import { useAiSettings } from "./settingsStore";
import { useMailStore } from "../mail/store";
import { useToastStore } from "../shell/toastStore";
import { speakText, stopSpeaking } from "../voice/voiceService";
import { TypewriterText } from "./TypewriterText";

type CapsuleState = "idle" | "thinking" | "expanded";
type ResultKind =
  | "summary"
  | "draft"
  | "actionItems"
  | "threadSummary"
  | "suggestSplit"
  | "translation"
  | "commitments";

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
  const [commitmentsData, setCommitmentsData] = useState<CommitmentItem[]>([]);
  const [checkedItems, setCheckedItems] = useState<Record<number, boolean>>({});
  const [kind, setKind] = useState<ResultKind>("summary");
  const [reasoningContent, setReasoningContent] = useState<string | null>(null);
  const [showReasoning, setShowReasoning] = useState(false);
  const [popoutOpen, setPopoutOpen] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<
    | "summary"
    | "draft"
    | "actionItems"
    | "threadSummary"
    | "suggestSplit"
    | "translation"
    | { type: "quick"; replyType: string }
    | null
  >(null);
  const activeReqIdRef = useRef<string | null>(null);

  function runCommitments() {
    const res = extractCommitments(subject, body);
    setCommitmentsData(res.commitments);
    setKind("commitments");
    setState("expanded");
  }

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
      const res = await summarizeDetailed({ subject, from, body }, { mode, requestId: reqId });
      if (activeReqIdRef.current !== reqId) return;
      setText(res.text);
      setReasoningContent(res.reasoningContent ?? null);
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
      const res = await draftReplyDetailed({ subject, from, body }, { mode, requestId: reqId });
      if (activeReqIdRef.current !== reqId) return;
      setText(res.text);
      setReasoningContent(res.reasoningContent ?? null);
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
        setState(
          text || actionItemsData || threadSummaryData || suggestSplitData ? "expanded" : "idle"
        );
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
        setState(
          text || actionItemsData || threadSummaryData || suggestSplitData ? "expanded" : "idle"
        );
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
        { mode, requestId: reqId }
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
        setState(
          text || actionItemsData || threadSummaryData || suggestSplitData ? "expanded" : "idle"
        );
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

  async function runTone(tone: "shorter" | "formal" | "expand" | "persona") {
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
        setState(
          text || actionItemsData || threadSummaryData || suggestSplitData ? "expanded" : "idle"
        );
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
        setState(
          text || actionItemsData || threadSummaryData || suggestSplitData ? "expanded" : "idle"
        );
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
        <Stack direction="column" spacing={0.75} sx={{ alignItems: "flex-end", maxWidth: "100%" }}>
          <Paper
            elevation={4}
            data-testid="lumen-capsule"
            data-state="idle"
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 0.5,
              p: "4px 8px",
              borderRadius: 999,
              flexWrap: "nowrap",
              whiteSpace: "nowrap",
              maxWidth: "100%",
              overflowX: "auto",
              scrollbarWidth: "none",
              "&::-webkit-scrollbar": { display: "none" },
              bgcolor: (t) =>
                t.palette.mode === "dark" ? "rgba(22, 27, 36, 0.96)" : "rgba(255, 255, 255, 0.95)",
              backdropFilter: "blur(16px)",
              border: (t) =>
                t.palette.mode === "dark"
                  ? "1px solid rgba(255, 255, 255, 0.1)"
                  : "1px solid rgba(0, 0, 0, 0.08)",
              boxShadow: (t) =>
                t.palette.mode === "dark"
                  ? "0 12px 36px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05)"
                  : "0 8px 24px rgba(0, 0, 0, 0.08), 0 2px 6px rgba(0, 0, 0, 0.03)",
            }}
          >
            <Box
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 0.5,
                px: 1,
                py: 0.35,
                borderRadius: 999,
                bgcolor: (t) =>
                  t.palette.mode === "dark"
                    ? "rgba(59, 130, 246, 0.18)"
                    : "rgba(37, 99, 235, 0.08)",
                color: "primary.main",
                flexShrink: 0,
              }}
            >
              <MailIcon sx={{ fontSize: 15 }} />
              <Typography
                sx={{
                  fontWeight: 700,
                  fontSize: "0.75rem",
                  letterSpacing: "0.04em",
                  lineHeight: 1,
                }}
              >
                AI
              </Typography>
            </Box>

            <Button
              size="small"
              variant="contained"
              color="primary"
              onClick={() => void runSummary()}
              sx={{
                minWidth: "auto",
                px: 1.25,
                py: 0.4,
                height: 28,
                borderRadius: 999,
                fontSize: "0.8125rem",
                fontWeight: 600,
                whiteSpace: "nowrap",
                textTransform: "none",
                flexShrink: 0,
                boxShadow: "none",
                "&:hover": {
                  boxShadow: (t) => `0 2px 8px ${t.palette.primary.main}40`,
                },
              }}
            >
              总结
            </Button>

            {Boolean(threadMessages && threadMessages.length > 1) && (
              <Button
                size="small"
                color="inherit"
                onClick={() => void runThreadSummary()}
                data-testid="thread-summary-button"
                sx={{
                  minWidth: "auto",
                  px: 1,
                  py: 0.4,
                  height: 28,
                  borderRadius: 999,
                  fontSize: "0.8125rem",
                  fontWeight: 500,
                  whiteSpace: "nowrap",
                  textTransform: "none",
                  flexShrink: 0,
                  color: "text.primary",
                  transition: "all 0.15s ease",
                  "&:hover": {
                    bgcolor: (t) =>
                      t.palette.mode === "dark"
                        ? "rgba(255, 255, 255, 0.08)"
                        : "rgba(0, 0, 0, 0.05)",
                    color: "primary.main",
                  },
                }}
              >
                线程摘要
              </Button>
            )}

            <Button
              size="small"
              color="inherit"
              onClick={() => void runDraft()}
              sx={{
                minWidth: "auto",
                px: 1,
                py: 0.4,
                height: 28,
                borderRadius: 999,
                fontSize: "0.8125rem",
                fontWeight: 500,
                whiteSpace: "nowrap",
                textTransform: "none",
                flexShrink: 0,
                color: "text.primary",
                transition: "all 0.15s ease",
                "&:hover": {
                  bgcolor: (t) =>
                    t.palette.mode === "dark" ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.05)",
                  color: "primary.main",
                },
              }}
            >
              写回复
            </Button>

            <Button
              size="small"
              color="inherit"
              onClick={() => void runActionItems()}
              sx={{
                minWidth: "auto",
                px: 1,
                py: 0.4,
                height: 28,
                borderRadius: 999,
                fontSize: "0.8125rem",
                fontWeight: 500,
                whiteSpace: "nowrap",
                textTransform: "none",
                flexShrink: 0,
                color: "text.primary",
                transition: "all 0.15s ease",
                "&:hover": {
                  bgcolor: (t) =>
                    t.palette.mode === "dark" ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.05)",
                  color: "primary.main",
                },
              }}
            >
              行动项
            </Button>

            <Button
              size="small"
              color={commitmentsData.length > 0 ? "warning" : "inherit"}
              onClick={() => void runCommitments()}
              data-testid="commitments-button"
              sx={{
                minWidth: "auto",
                px: 1,
                py: 0.4,
                height: 28,
                borderRadius: 999,
                fontSize: "0.8125rem",
                fontWeight: commitmentsData.length > 0 ? 600 : 500,
                whiteSpace: "nowrap",
                textTransform: "none",
                flexShrink: 0,
                color: commitmentsData.length > 0 ? "warning.main" : "text.primary",
                transition: "all 0.15s ease",
                "&:hover": {
                  bgcolor: (t) =>
                    t.palette.mode === "dark" ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.05)",
                },
              }}
            >
              承诺追踪{commitmentsData.length > 0 ? ` (${commitmentsData.length})` : ""}
            </Button>

            <Button
              size="small"
              color="inherit"
              onClick={() => void runSuggestSplit()}
              data-testid="suggest-split-button"
              sx={{
                minWidth: "auto",
                px: 1,
                py: 0.4,
                height: 28,
                borderRadius: 999,
                fontSize: "0.8125rem",
                fontWeight: 500,
                whiteSpace: "nowrap",
                textTransform: "none",
                flexShrink: 0,
                color: "text.primary",
                transition: "all 0.15s ease",
                "&:hover": {
                  bgcolor: (t) =>
                    t.palette.mode === "dark" ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.05)",
                  color: "primary.main",
                },
              }}
            >
              建议分箱
            </Button>

            <Button
              size="small"
              color="inherit"
              onClick={() => void runTranslate()}
              data-testid="translate-button"
              sx={{
                minWidth: "auto",
                px: 1,
                py: 0.4,
                height: 28,
                borderRadius: 999,
                fontSize: "0.8125rem",
                fontWeight: 500,
                whiteSpace: "nowrap",
                textTransform: "none",
                flexShrink: 0,
                color: "text.primary",
                transition: "all 0.15s ease",
                "&:hover": {
                  bgcolor: (t) =>
                    t.palette.mode === "dark" ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.05)",
                  color: "primary.main",
                },
              }}
            >
              翻译
            </Button>

            <Chip
              size="small"
              label={mode === "local" ? "本机" : "云端"}
              color="primary"
              variant="outlined"
              sx={{
                height: 22,
                borderRadius: 999,
                flexShrink: 0,
                borderColor: (t) =>
                  t.palette.mode === "dark"
                    ? "rgba(100, 149, 237, 0.3)"
                    : "rgba(25, 118, 210, 0.25)",
                bgcolor: (t) =>
                  t.palette.mode === "dark"
                    ? "rgba(100, 149, 237, 0.08)"
                    : "rgba(25, 118, 210, 0.04)",
                "& .MuiChip-label": { px: 0.75, fontSize: "0.7rem", fontWeight: 500 },
              }}
            />

            {error && (
              <Chip
                size="small"
                color="error"
                label={
                  error.includes("未配置云端")
                    ? "未配置云端 Key · 去设置"
                    : `${error.slice(0, 10)}… · 去设置`
                }
                onClick={() => setView("settings")}
                sx={{
                  height: 22,
                  borderRadius: 999,
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  flexShrink: 0,
                  cursor: "pointer",
                  "& .MuiChip-label": { px: 0.75 },
                }}
                title={error}
              />
            )}
          </Paper>

          <Stack
            direction="row"
            spacing={0.75}
            data-testid="quick-reply-chips"
            sx={{ flexWrap: "nowrap", justifyContent: "flex-end", gap: 0.75 }}
          >
            {QUICK_REPLY_OPTIONS.map((opt) => (
              <Chip
                key={opt.key}
                size="small"
                label={opt.label}
                onClick={() => void runQuickReply(opt.key)}
                variant="outlined"
                sx={{
                  bgcolor: (t) =>
                    t.palette.mode === "dark"
                      ? "rgba(24, 28, 36, 0.85)"
                      : "rgba(255, 255, 255, 0.9)",
                  backdropFilter: "blur(8px)",
                  cursor: "pointer",
                  fontSize: "0.75rem",
                  fontWeight: 500,
                  height: 26,
                  borderRadius: 999,
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                  border: (t) =>
                    t.palette.mode === "dark"
                      ? "1px solid rgba(255, 255, 255, 0.1)"
                      : "1px solid rgba(0, 0, 0, 0.08)",
                  boxShadow: "0 2px 6px rgba(0, 0, 0, 0.03)",
                  transition: "all 0.15s ease-in-out",
                  "&:hover": {
                    bgcolor: "primary.main",
                    color: "primary.contrastText",
                    borderColor: "primary.main",
                    transform: "translateY(-1px)",
                    boxShadow: "0 4px 10px rgba(0, 0, 0, 0.1)",
                  },
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
    const kindLabel =
      kind === "summary"
        ? "智能摘要"
        : kind === "draft"
          ? "回复草稿"
          : kind === "actionItems"
            ? "行动项分析"
            : kind === "commitments"
              ? "承诺追踪"
              : kind === "threadSummary"
                ? "时间线摘要"
                : kind === "suggestSplit"
                  ? "分箱建议"
                  : "多语言翻译";

    return (
      <Paper
        elevation={8}
        data-testid="lumen-capsule"
        data-state="thinking"
        aria-busy
        sx={{
          p: 1.75,
          width: { xs: "100%", sm: 380 },
          maxWidth: "100%",
          maxHeight: "min(46vh, 380px)",
          borderRadius: 2.5,
          bgcolor: "background.paper",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          border: 1,
          borderColor: (t) =>
            t.palette.mode === "dark" ? "rgba(59, 130, 246, 0.3)" : "rgba(37, 99, 235, 0.25)",
          boxShadow: (t) =>
            t.palette.mode === "dark"
              ? "0 12px 32px rgba(0, 0, 0, 0.5), 0 0 16px rgba(59, 130, 246, 0.12)"
              : "0 12px 32px rgba(0, 0, 0, 0.08), 0 0 16px rgba(37, 99, 235, 0.08)",
        }}
      >
        <Stack spacing={1.5} sx={{ minHeight: 0, flex: 1 }}>
          {/* Header */}
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexShrink: 0 }}>
            <Box
              sx={{
                width: 24,
                height: 24,
                borderRadius: "50%",
                bgcolor: "primary.main",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <AutoAwesomeIcon sx={{ fontSize: 14, color: "#fff" }} />
            </Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "primary.main" }}>
              AI 正在生成{kindLabel}...
            </Typography>
            <Chip
              size="small"
              label={mode === "local" ? "本机" : "云端"}
              color="primary"
              variant="outlined"
              sx={{ ml: "auto", height: 22 }}
            />
            <Button
              size="small"
              color="inherit"
              onClick={() => void handleCancel()}
              sx={{ minWidth: 0, px: 0.75, py: 0.25, fontSize: "0.75rem", borderRadius: 1 }}
              aria-label="取消 AI 请求"
            >
              取消
            </Button>
          </Stack>

          {/* Thinking Process Body */}
          <Box
            sx={{
              flex: 1,
              minHeight: 110,
              display: "flex",
              flexDirection: "column",
              gap: 1.25,
              p: 1.5,
              borderRadius: 2,
              bgcolor: (t) =>
                t.palette.mode === "dark" ? "rgba(255, 255, 255, 0.03)" : "rgba(15, 23, 42, 0.02)",
              border: 1,
              borderColor: "divider",
              overflow: "hidden",
            }}
          >
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <CircularProgress size={14} thickness={5} />
              <Typography variant="caption" sx={{ fontWeight: 600, color: "text.primary" }}>
                AI 深度思考推理中...
              </Typography>
            </Stack>

            {/* Thinking step indicator animation */}
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75, my: "auto" }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <Box
                  sx={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    bgcolor: "success.main",
                  }}
                />
                <Typography variant="caption" color="text.secondary">
                  1. 解析邮件正文与发件人语境
                </Typography>
              </Stack>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <Box
                  sx={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    bgcolor: "primary.main",
                  }}
                />
                <Typography variant="caption" sx={{ color: "primary.main", fontWeight: 600 }}>
                  2. 提炼核心要点与深度逻辑推理
                </Typography>
              </Stack>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center", opacity: 0.6 }}>
                <Box
                  sx={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    bgcolor: "text.disabled",
                  }}
                />
                <Typography variant="caption" color="text.secondary">
                  3. 组织结构并准备最终输出
                </Typography>
              </Stack>
            </Box>

            {/* Shimmer loading bar */}
            <Box
              sx={{
                height: 3,
                width: "100%",
                borderRadius: 2,
                overflow: "hidden",
                bgcolor: "divider",
                position: "relative",
                "&::after": {
                  content: '""',
                  position: "absolute",
                  top: 0,
                  left: 0,
                  bottom: 0,
                  width: "45%",
                  bgcolor: "primary.main",
                  borderRadius: 2,
                  animation: "shimmer 1.8s infinite ease-in-out",
                },
              }}
            />
          </Box>
        </Stack>
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
                    : kind === "commitments"
                      ? "承诺追踪 (Commitments)"
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
            <Tooltip title="在独立小窗中展开">
              <IconButton
                size="small"
                onClick={() => setPopoutOpen(true)}
                data-testid="popout-ai-modal-button"
                sx={{ p: 0.5, color: "text.secondary", "&:hover": { color: "primary.main" } }}
                aria-label="在独立小窗中展开"
              >
                <OpenInNewIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
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
                      t.palette.mode === "dark"
                        ? "rgba(255, 255, 255, 0.04)"
                        : "rgba(0, 0, 0, 0.02)",
                    borderColor: "divider",
                  }}
                >
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ alignItems: "center", mb: 1, flexWrap: "wrap", gap: 0.5 }}
                  >
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
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: "block", mt: 1 }}
                    >
                      当前分箱：{currentSplit === "important" ? "重要" : "其他"}
                      {currentSplit === suggestSplitData.split ? " (当前已是推荐分箱)" : ""}
                    </Typography>
                  )}
                </Paper>
              )}
            </Stack>
          ) : kind === "commitments" ? (
            <Box
              sx={{ flex: 1, minHeight: 0, overflow: "auto", pr: 0.5 }}
              data-testid="commitments-section"
            >
              {commitmentsData.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  正文中未检测到明确的双方承诺或截止日期。
                </Typography>
              ) : (
                <Stack spacing={1} data-testid="commitments-list">
                  {commitmentsData.map((c, idx) => (
                    <Paper
                      key={idx}
                      variant="outlined"
                      data-testid="commitment-card"
                      sx={{
                        p: 1.25,
                        borderRadius: 2,
                        bgcolor: (t) =>
                          c.direction === "i_promised"
                            ? t.palette.mode === "dark"
                              ? "rgba(46, 125, 50, 0.12)"
                              : "rgba(46, 125, 50, 0.06)"
                            : t.palette.mode === "dark"
                              ? "rgba(237, 108, 2, 0.12)"
                              : "rgba(237, 108, 2, 0.06)",
                        borderColor: (t) =>
                          c.direction === "i_promised"
                            ? t.palette.success.main
                            : t.palette.warning.main,
                      }}
                    >
                      <Stack
                        direction="row"
                        spacing={0.75}
                        sx={{ alignItems: "center", mb: 0.5, flexWrap: "wrap", gap: 0.5 }}
                      >
                        <Chip
                          size="small"
                          data-testid="commitment-direction-chip"
                          label={c.direction === "i_promised" ? "我方承诺" : "对方承诺"}
                          color={c.direction === "i_promised" ? "success" : "warning"}
                          variant="filled"
                          sx={{
                            fontWeight: 600,
                            height: 22,
                            "& .MuiChip-label": { px: 0.75, fontSize: "0.7rem" },
                          }}
                        />
                        {c.deadline && (
                          <Chip
                            size="small"
                            data-testid="commitment-deadline-chip"
                            label={`截止: ${c.deadline}`}
                            color="error"
                            variant="outlined"
                            sx={{
                              height: 22,
                              "& .MuiChip-label": { px: 0.75, fontSize: "0.7rem" },
                            }}
                          />
                        )}
                      </Stack>
                      <Typography
                        variant="body2"
                        sx={{ fontSize: "0.85rem", color: "text.primary" }}
                      >
                        {c.text}
                      </Typography>
                    </Paper>
                  ))}
                </Stack>
              )}
            </Box>
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
                      t.palette.mode === "dark"
                        ? "rgba(255, 255, 255, 0.04)"
                        : "rgba(0, 0, 0, 0.02)",
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
                  <Stack
                    spacing={1}
                    data-testid="thread-timeline-list"
                    sx={{ position: "relative", pl: 0.5 }}
                  >
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
                        <Stack
                          direction="row"
                          spacing={0.75}
                          sx={{ alignItems: "center", mb: 0.25 }}
                        >
                          <Typography
                            variant="caption"
                            sx={{ fontWeight: 600, color: "text.primary" }}
                          >
                            {item.sender}
                          </Typography>
                          {item.date && (
                            <Chip
                              size="small"
                              label={item.date}
                              variant="outlined"
                              sx={{
                                height: 18,
                                "& .MuiChip-label": { px: 0.5, fontSize: "0.65rem" },
                              }}
                            />
                          )}
                        </Stack>
                        <Typography
                          variant="body2"
                          sx={{ fontSize: "0.8rem", color: "text.secondary" }}
                        >
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
                    else if (t.includes("截止") || t.toLowerCase().includes("deadline"))
                      color = "error";
                    else if (t.includes("待办") || t.toLowerCase().includes("action"))
                      color = "primary";
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
            <Box sx={{ flex: 1, minHeight: 0, overflow: "auto", pr: 0.5 }}>
              {reasoningContent && (
                <Paper
                  variant="outlined"
                  sx={{ p: 1, mb: 1, bgcolor: "action.hover", borderRadius: 1.5 }}
                >
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      cursor: "pointer",
                    }}
                    onClick={() => setShowReasoning(!showReasoning)}
                  >
                    <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
                      <PsychologyIcon fontSize="small" color="primary" />
                      <Typography variant="caption" sx={{ fontWeight: 600 }}>
                        AI 思考过程 (DeepSeek R1)
                      </Typography>
                    </Stack>
                    <IconButton size="small">
                      {showReasoning ? (
                        <ExpandLessIcon fontSize="small" />
                      ) : (
                        <ExpandMoreIcon fontSize="small" />
                      )}
                    </IconButton>
                  </Box>
                  <Collapse in={showReasoning}>
                    <Box
                      component="pre"
                      sx={{
                        mt: 0.5,
                        p: 0.75,
                        fontFamily: "monospace",
                        fontSize: "0.72rem",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                        maxHeight: 140,
                        overflowY: "auto",
                        bgcolor: "background.paper",
                        borderRadius: 1,
                        border: 1,
                        borderColor: "divider",
                      }}
                    >
                      {reasoningContent}
                    </Box>
                  </Collapse>
                </Paper>
              )}
              <TypewriterText variant="body2" sx={{ whiteSpace: "pre-wrap" }} text={text} />
            </Box>
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
                <Button size="small" variant="outlined" onClick={() => void runTone("persona")}>
                  ✦ 以我的风格
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
                    3000
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
            <Button
              size="small"
              color={isSpeaking ? "secondary" : "inherit"}
              startIcon={
                isSpeaking ? <VolumeOffIcon fontSize="small" /> : <VolumeUpIcon fontSize="small" />
              }
              onClick={() => {
                if (isSpeaking) {
                  stopSpeaking();
                  setIsSpeaking(false);
                } else {
                  setIsSpeaking(true);
                  speakText(
                    text || body,
                    () => setIsSpeaking(false),
                    () => setIsSpeaking(false)
                  );
                }
              }}
              data-testid="read-aloud-button"
            >
              {isSpeaking ? "停止朗读" : "朗读"}
            </Button>
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
      <AiPopoutModal
        open={popoutOpen}
        onClose={() => setPopoutOpen(false)}
        subject={subject ?? ""}
        kind={kind}
        text={text}
        reasoningContent={reasoningContent}
        mode={mode}
        actionItemsData={actionItemsData}
        threadSummaryData={threadSummaryData}
        suggestSplitData={suggestSplitData}
        commitmentsData={commitmentsData}
        checkedItems={checkedItems}
        setCheckedItems={setCheckedItems}
        onTone={(tone) => void runTone(tone)}
        onInsertDraft={onInsertDraft ? insertDraft : undefined}
        onApplySplit={onApplySplit ? (s) => onApplySplit(s) : undefined}
        isSpeaking={isSpeaking}
        onToggleSpeech={() => {
          if (isSpeaking) {
            stopSpeaking();
            setIsSpeaking(false);
          } else {
            setIsSpeaking(true);
            speakText(
              text || body,
              () => setIsSpeaking(false),
              () => setIsSpeaking(false)
            );
          }
        }}
      />
    </>
  );
}

function AiPopoutModal(props: {
  open: boolean;
  onClose: () => void;
  subject: string;
  kind: ResultKind;
  text: string;
  reasoningContent: string | null;
  mode: "local" | "cloud";
  actionItemsData: ActionItemsData | null;
  threadSummaryData: ThreadSummaryData | null;
  suggestSplitData: SuggestSplitData | null;
  commitmentsData: CommitmentItem[];
  checkedItems: Record<number, boolean>;
  setCheckedItems: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  onTone: (tone: "shorter" | "formal" | "expand" | "persona") => void;
  onInsertDraft?: () => void;
  onApplySplit?: (split: "important" | "other") => void;
  isSpeaking: boolean;
  onToggleSpeech: () => void;
}) {
  const [showReasoningModal, setShowReasoningModal] = useState(true);
  const showToast = useToastStore((s) => s.showToast);

  const titleText =
    props.kind === "summary"
      ? "AI 智能邮件摘要"
      : props.kind === "draft"
        ? "AI 生成回复草稿"
        : props.kind === "actionItems"
          ? "AI 行动项与意图分析"
          : props.kind === "commitments"
            ? "AI 承诺与截止日期追踪"
            : props.kind === "threadSummary"
              ? "AI 线索时间线全景摘要"
              : props.kind === "suggestSplit"
                ? "AI 智能分箱建议"
                : "AI 邮件多语言翻译";

  return (
    <Dialog
      open={props.open}
      onClose={props.onClose}
      maxWidth="md"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: 3,
            bgcolor: "background.paper",
            backgroundImage: "none",
            maxHeight: "85vh",
            display: "flex",
            flexDirection: "column",
            boxShadow: "0 24px 48px rgba(0, 0, 0, 0.28)",
          },
        },
      }}
    >
      <DialogTitle sx={{ px: 3, py: 2, display: "flex", alignItems: "center", gap: 1.5, borderBottom: 1, borderColor: "divider" }}>
        <AutoAwesomeIcon color="primary" />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h6" sx={{ fontSize: "1.1rem", fontWeight: 600 }}>
            {titleText}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
            关联邮件：{props.subject || "(无主题)"}
          </Typography>
        </Box>
        <Chip
          size="small"
          label={props.mode === "local" ? "本机 Ollama" : "云端模型"}
          color="primary"
          variant="outlined"
          sx={{ height: 24, fontWeight: 500 }}
        />
        <IconButton size="small" onClick={props.onClose} aria-label="关闭小窗" sx={{ ml: 1 }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 3, flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
        {/* Reasoning / Thinking process section */}
        {props.reasoningContent && (
          <Paper
            variant="outlined"
            sx={{
              p: 1.5,
              borderRadius: 2,
              bgcolor: (t) =>
                t.palette.mode === "dark" ? "rgba(59, 130, 246, 0.08)" : "rgba(37, 99, 235, 0.04)",
              borderColor: (t) =>
                t.palette.mode === "dark" ? "rgba(59, 130, 246, 0.25)" : "rgba(37, 99, 235, 0.2)",
            }}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                cursor: "pointer",
                userSelect: "none",
              }}
              onClick={() => setShowReasoningModal(!showReasoningModal)}
            >
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <PsychologyIcon color="primary" fontSize="small" />
                <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "primary.main" }}>
                  AI 深度思考推理过程 (DeepSeek-R1 / Reasoning)
                </Typography>
              </Stack>
              <IconButton size="small">
                {showReasoningModal ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
              </IconButton>
            </Box>
            <Collapse in={showReasoningModal}>
              <Box
                component="pre"
                sx={{
                  mt: 1.5,
                  p: 1.5,
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                  fontSize: "0.8rem",
                  lineHeight: 1.6,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  maxHeight: 240,
                  overflowY: "auto",
                  bgcolor: (t) => (t.palette.mode === "dark" ? "#0A0D13" : "#F8FAFC"),
                  borderRadius: 1.5,
                  border: 1,
                  borderColor: "divider",
                  color: "text.secondary",
                }}
              >
                {props.reasoningContent}
              </Box>
            </Collapse>
          </Paper>
        )}

        {/* Content body based on result kind */}
        <Box sx={{ flex: 1, minHeight: 120 }}>
          {props.kind === "suggestSplit" && props.suggestSplitData ? (
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1.5 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>建议分箱:</Typography>
                <Chip
                  label={props.suggestSplitData.split === "important" ? "重要" : "其他"}
                  color={props.suggestSplitData.split === "important" ? "primary" : "default"}
                  variant="filled"
                  sx={{ fontWeight: 600 }}
                />
              </Stack>
              <Typography variant="body1" sx={{ lineHeight: 1.7 }}>
                {props.suggestSplitData.reason}
              </Typography>
            </Paper>
          ) : props.kind === "actionItems" && props.actionItemsData ? (
            <Stack spacing={2}>
              {props.actionItemsData.tags && props.actionItemsData.tags.length > 0 && (
                <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
                  {props.actionItemsData.tags.map((tag) => (
                    <Chip key={tag} label={tag} color="primary" variant="filled" size="small" />
                  ))}
                  {props.actionItemsData.deadline && (
                    <Chip label={`截止: ${props.actionItemsData.deadline}`} color="error" variant="outlined" size="small" />
                  )}
                </Stack>
              )}
              <Stack spacing={1}>
                {props.actionItemsData.actionItems.map((item, idx) => (
                  <Paper
                    key={idx}
                    variant="outlined"
                    sx={{ p: 1.25, display: "flex", alignItems: "center", gap: 1, cursor: "pointer" }}
                    onClick={() => props.setCheckedItems((prev) => ({ ...prev, [idx]: !prev[idx] }))}
                  >
                    <Checkbox checked={Boolean(props.checkedItems[idx])} size="small" />
                    <Typography
                      variant="body2"
                      sx={{
                        textDecoration: props.checkedItems[idx] ? "line-through" : "none",
                        color: props.checkedItems[idx] ? "text.secondary" : "text.primary",
                      }}
                    >
                      {item}
                    </Typography>
                  </Paper>
                ))}
              </Stack>
            </Stack>
          ) : (
            <Paper
              variant="outlined"
              sx={{
                p: 2.5,
                borderRadius: 2,
                bgcolor: (t) => (t.palette.mode === "dark" ? "#10141D" : "#FFFFFF"),
              }}
            >
              <TypewriterText
                variant="body1"
                sx={{ whiteSpace: "pre-wrap", lineHeight: 1.8, fontSize: "0.95rem" }}
                text={props.text}
              />
            </Paper>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, borderTop: 1, borderColor: "divider", flexWrap: "wrap", gap: 1 }}>
        {props.kind !== "actionItems" && props.kind !== "threadSummary" && props.kind !== "suggestSplit" && (
          <Stack direction="row" spacing={0.75} sx={{ mr: "auto" }}>
            <Button size="small" variant="outlined" onClick={() => props.onTone("shorter")}>
              更短一点
            </Button>
            <Button size="small" variant="outlined" onClick={() => props.onTone("formal")}>
              更正式
            </Button>
            <Button size="small" variant="outlined" onClick={() => props.onTone("expand")}>
              扩写
            </Button>
            <Button size="small" variant="outlined" onClick={() => props.onTone("persona")}>
              ✦ 以我的风格
            </Button>
          </Stack>
        )}

        {props.onInsertDraft && props.kind === "draft" && (
          <Button
            variant="contained"
            startIcon={<SendIcon />}
            onClick={() => {
              props.onInsertDraft?.();
              props.onClose();
            }}
          >
            插入草稿并编辑
          </Button>
        )}

        <Button
          variant="outlined"
          startIcon={<ContentCopyIcon />}
          onClick={() => {
            void navigator.clipboard?.writeText(props.text);
            showToast("已复制到剪贴板", "success", 2000);
          }}
        >
          复制内容
        </Button>

        <Button
          color={props.isSpeaking ? "secondary" : "inherit"}
          startIcon={props.isSpeaking ? <VolumeOffIcon /> : <VolumeUpIcon />}
          onClick={props.onToggleSpeech}
        >
          {props.isSpeaking ? "停止朗读" : "朗读"}
        </Button>

        <Button onClick={props.onClose}>关闭</Button>
      </DialogActions>
    </Dialog>
  );
}

function PrivacyDialog(props: { open: boolean; onCancel: () => void; onAccept: () => void }) {
  return (
    <Dialog open={props.open} onClose={props.onCancel}>
      <DialogTitle>云端 AI 隐私提示</DialogTitle>
      <DialogContent>
        <DialogContentText>
          云端模式会将当前邮件的主题与正文发送到你在设置中配置的 API
          地址进行处理。附件默认不会上传。本机模式则仅请求本地 Ollama。
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
