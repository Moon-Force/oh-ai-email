import { useState } from "react";
import {
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import { summarize, draftReply, rewriteTone } from "./router";
import { useAiSettings } from "./settingsStore";

type CapsuleState = "idle" | "thinking" | "expanded";
type ResultKind = "summary" | "draft";

type Props = {
  body: string;
  onInsertDraft?: (text: string) => void;
};

export default function LumenCapsule({ body, onInsertDraft }: Props) {
  const mode = useAiSettings((s) => s.mode);
  const [state, setState] = useState<CapsuleState>("idle");
  const [text, setText] = useState("");
  const [kind, setKind] = useState<ResultKind>("summary");
  const [error, setError] = useState<string | null>(null);

  async function runSummary() {
    setError(null);
    setState("thinking");
    setKind("summary");
    try {
      const s = await summarize(body, mode);
      setText(s);
      setState("expanded");
    } catch {
      setError("摘要失败，请稍后重试");
      setState("idle");
    }
  }

  async function runDraft() {
    setError(null);
    setState("thinking");
    setKind("draft");
    try {
      const d = await draftReply(body, mode);
      setText(d);
      setState("expanded");
    } catch {
      setError("写回复失败，请稍后重试");
      setState("idle");
    }
  }

  async function runTone(tone: "shorter" | "formal") {
    setError(null);
    setState("thinking");
    try {
      const next = await rewriteTone(text || body, tone);
      setText(next);
      setState("expanded");
    } catch {
      setError("改写失败，请稍后重试");
      setState("expanded");
    }
  }

  function close() {
    setState("idle");
    setText("");
    setError(null);
  }

  if (state === "idle") {
    return (
      <Paper
        elevation={3}
        data-testid="lumen-capsule"
        data-state="idle"
        sx={{
          display: "inline-flex",
          alignItems: "center",
          gap: 1,
          px: 1.5,
          py: 1,
          borderRadius: 999,
          border: 1,
          borderColor: "divider",
        }}
      >
        <AutoAwesomeIcon color="primary" fontSize="small" />
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          询问 AI
        </Typography>
        <Button size="small" onClick={runSummary}>
          总结这封
        </Button>
        <Button size="small" color="inherit" onClick={runDraft}>
          写回复
        </Button>
        <Chip size="small" label={mode === "local" ? "本机" : "云端"} color="primary" variant="outlined" />
        {error && (
          <Typography variant="caption" color="error">
            {error}
          </Typography>
        )}
      </Paper>
    );
  }

  if (state === "thinking") {
    return (
      <Paper
        elevation={3}
        data-testid="lumen-capsule"
        data-state="thinking"
        aria-busy
        sx={{ display: "inline-flex", alignItems: "center", gap: 1.5, px: 2, py: 1.25, borderRadius: 999 }}
      >
        <CircularProgress size={18} />
        <Typography variant="body2">思考中…</Typography>
      </Paper>
    );
  }

  return (
    <Paper
      elevation={4}
      data-testid="lumen-capsule"
      data-state="expanded"
      sx={{ p: 2, minWidth: 320, maxWidth: 420, borderRadius: 3 }}
    >
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <AutoAwesomeIcon color="primary" fontSize="small" />
          <Typography variant="subtitle2" color="primary">
            {kind === "summary" ? "摘要" : "草稿回复"}
          </Typography>
          <Chip
            size="small"
            label={mode === "local" ? "本机" : "云端"}
            color="primary"
            variant="outlined"
            sx={{ ml: "auto" }}
          />
        </Stack>
        <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", maxHeight: 200, overflow: "auto" }}>
          {text}
        </Typography>
        {error && (
          <Typography variant="caption" color="error">
            {error}
          </Typography>
        )}
        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
          {kind === "draft" && (
            <>
              <Button size="small" variant="outlined" onClick={() => runTone("shorter")}>
                更短一点
              </Button>
              <Button size="small" variant="outlined" onClick={() => runTone("formal")}>
                更正式
              </Button>
              <Button
                size="small"
                variant="contained"
                onClick={() => {
                  onInsertDraft?.(text);
                  void navigator.clipboard?.writeText(text);
                }}
              >
                插入草稿
              </Button>
            </>
          )}
          {kind === "summary" && (
            <Button size="small" variant="contained" onClick={() => void navigator.clipboard?.writeText(text)}>
              复制
            </Button>
          )}
          <Button size="small" onClick={close}>
            关闭
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}
