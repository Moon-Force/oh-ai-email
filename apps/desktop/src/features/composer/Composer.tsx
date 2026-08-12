import { useState } from "react";
import {
  Box,
  Button,
  Stack,
  TextField,
  Typography,
  AppBar,
  Toolbar,
  Alert,
} from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

export function buildReplyQuote(from: string, body: string) {
  return `On behalf of ${from}:\n> ${body.replace(/\n/g, "\n> ")}`;
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
  const [body, setBody] = useState(initialBody);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function send() {
    if (!to.includes("@")) {
      setStatus("收件人不正确");
      return;
    }
    setStatus("已发送（本地模拟）");
    onSend?.({ to, subject, body });
  }

  function saveDraft() {
    setSaving(true);
    setStatus("草稿已保存（本地）");
    setTimeout(() => setSaving(false), 200);
  }

  return (
    <Box data-testid="composer" sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <AppBar position="static" color="default" elevation={0} sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Toolbar variant="dense" sx={{ gap: 1 }}>
          <Button startIcon={<ArrowBackIcon />} onClick={onClose} aria-label="关闭写信">
            返回
          </Button>
          <Typography variant="subtitle1" sx={{ flex: 1 }}>
            写新邮件
          </Typography>
          <Button onClick={saveDraft} disabled={saving}>
            存草稿
          </Button>
          <Button onClick={onClose}>丢弃</Button>
          <Button variant="contained" endIcon={<SendIcon />} onClick={send}>
            发送
          </Button>
        </Toolbar>
      </AppBar>
      <Stack spacing={2} sx={{ p: 2, flex: 1, overflow: "auto" }}>
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
        <TextField
          label="正文"
          placeholder="写点什么…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          fullWidth
          multiline
          minRows={10}
          slotProps={{ htmlInput: { "aria-label": "正文" } }}
        />
        {status && (
          <Alert severity={status.includes("不正确") ? "error" : "success"}>{status}</Alert>
        )}
      </Stack>
    </Box>
  );
}

