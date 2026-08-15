import { useState } from "react";
import {
  Button,
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
  draftReply,
  ensureCloudPrivacyAck,
  rewriteTone,
  summarize,
} from "./router";
import { useAiSettings } from "./settingsStore";
import { useMailStore } from "../mail/store";
import { useToastStore } from "../shell/toastStore";

type CapsuleState = "idle" | "thinking" | "expanded";
type ResultKind = "summary" | "draft";

type Props = {
  subject?: string;
  from?: string;
  body: string;
  /** Reply target when inserting draft */
  replyTo?: string;
};

export default function LumenCapsule({ subject, from, body, replyTo }: Props) {
  const mode = useAiSettings((s) => s.mode);
  const hasCloudApiKey = useAiSettings((s) => s.hasCloudApiKey);
  const openCompose = useMailStore((s) => s.openCompose);
  const setView = useMailStore((s) => s.setView);
  const showToast = useToastStore((s) => s.showToast);

  const [state, setState] = useState<CapsuleState>("idle");
  const [text, setText] = useState("");
  const [kind, setKind] = useState<ResultKind>("summary");
  const [error, setError] = useState<string | null>(null);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<"summary" | "draft" | null>(null);

  function guideSettings(msg: string) {
    setError(msg);
    showToast(msg, "error", 5000);
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
    setPendingAction(null);
    setError(null);
    setState("thinking");
    setKind("summary");
    try {
      const s = await summarize({ subject, from, body }, mode);
      setText(s);
      setState("expanded");
    } catch (e) {
      const msg = e instanceof AiRequestError ? e.message : "摘要失败，请稍后重试";
      setError(msg);
      setState("idle");
      showToast(msg, "error", 6000);
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
    setPendingAction(null);
    setError(null);
    setState("thinking");
    setKind("draft");
    try {
      const d = await draftReply({ subject, from, body }, mode);
      setText(d);
      setState("expanded");
    } catch (e) {
      const msg = e instanceof AiRequestError ? e.message : "写回复失败，请稍后重试";
      setError(msg);
      setState("idle");
      showToast(msg, "error", 6000);
    }
  }

  async function runTone(tone: "shorter" | "formal" | "expand") {
    setError(null);
    setState("thinking");
    try {
      const next = await rewriteTone(text || body, tone, mode);
      setText(next);
      setKind("draft");
      setState("expanded");
    } catch (e) {
      const msg = e instanceof AiRequestError ? e.message : "改写失败，请稍后重试";
      setError(msg);
      setState("expanded");
      showToast(msg, "error", 6000);
    }
  }

  function insertDraft() {
    const reSubject = subject?.trim()
      ? subject.trim().toLowerCase().startsWith("re:")
        ? subject.trim()
        : `Re: ${subject.trim()}`
      : "Re:";
    openCompose({
      to: replyTo || from || "",
      subject: reSubject,
      body: text,
    });
    showToast("已插入写信，请确认后发送", "success", 3000);
  }

  function close() {
    setState("idle");
    setText("");
    setError(null);
  }

  async function acceptPrivacy() {
    await ackCloudPrivacy();
    setPrivacyOpen(false);
    if (pendingAction === "summary") void runSummary();
    else if (pendingAction === "draft") void runDraft();
  }

  if (state === "idle") {
    return (
      <>
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
          py: 0.75,
          borderRadius: 999,
          bgcolor: "background.paper",
        }}
      >
        <CircularProgress size={16} />
        <Typography variant="caption">思考中…</Typography>
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
          maxHeight: "min(42vh, 320px)",
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
              {kind === "summary" ? "摘要" : "草稿回复"}
            </Typography>
            <Chip
              size="small"
              label={mode === "local" ? "本机" : "云端"}
              color="primary"
              variant="outlined"
              sx={{ ml: "auto", height: 22 }}
            />
          </Stack>
          <Typography
            variant="body2"
            sx={{ whiteSpace: "pre-wrap", flex: 1, minHeight: 0, overflow: "auto", pr: 0.5 }}
          >
            {text}
          </Typography>
          {error && (
            <Typography variant="caption" color="error">
              {error}
            </Typography>
          )}
          <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap", gap: 0.5, flexShrink: 0 }}>
            <Button size="small" variant="outlined" onClick={() => void runTone("shorter")}>
              更短一点
            </Button>
            <Button size="small" variant="outlined" onClick={() => void runTone("formal")}>
              更正式
            </Button>
            <Button size="small" variant="outlined" onClick={() => void runTone("expand")}>
              扩写
            </Button>
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
