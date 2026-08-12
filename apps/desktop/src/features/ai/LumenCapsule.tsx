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
        <Button size="small" onClick={runSummary} sx={{ minWidth: 0, px: 1 }}>
          总结
        </Button>
        <Button size="small" color="inherit" onClick={runDraft} sx={{ minWidth: 0, px: 1 }}>
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

  // Expanded floats upward over the mail body (parent is absolute dock)
  return (
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
          {kind === "draft" && (
            <>
              <Button size="small" variant="outlined" onClick={() => void runTone("shorter")}>
                更短一点
              </Button>
              <Button size="small" variant="outlined" onClick={() => void runTone("formal")}>
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
