import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  FormControl,
  FormControlLabel,
  InputLabel,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useAiSettings } from "../ai/settingsStore";
import { SYNC_INTERVAL_OPTIONS, usePrefsStore } from "./prefsStore";
import { aiProbeCloud, aiProbeOllama } from "../../lib/ipc";
import { useToastStore } from "../shell/toastStore";

type Tab = "general" | "accounts" | "ai";

type Props = {
  onClose?: () => void;
  theme: "light" | "dark";
  onThemeChange: (t: "light" | "dark") => void;
};

export default function Settings({ onClose, theme, onThemeChange }: Props) {
  const [tab, setTab] = useState<Tab>("ai");
  const {
    mode,
    setMode,
    baseUrl,
    setBaseUrl,
    model,
    setModel,
    ollamaHost,
    setOllamaHost,
    ollamaModel,
    setOllamaModel,
    preferLocalWhenAvailable,
    setPreferLocal,
    apiKeyDraft,
    setApiKeyDraft,
    hasCloudApiKey,
    cloudPrivacyAck,
    setCloudPrivacyAck,
    hydrate,
    save,
  } = useAiSettings();
  const syncIntervalMin = usePrefsStore((s) => s.syncIntervalMin);
  const setSyncIntervalMin = usePrefsStore((s) => s.setSyncIntervalMin);
  const hydratePrefs = usePrefsStore((s) => s.hydrate);
  const savePrefs = usePrefsStore((s) => s.save);
  const [saved, setSaved] = useState(false);
  const [generalSaved, setGeneralSaved] = useState(false);
  const [probing, setProbing] = useState(false);
  const [probeMsg, setProbeMsg] = useState<string | null>(null);
  const showToast = useToastStore((s) => s.showToast);

  useEffect(() => {
    void hydrate();
    void hydratePrefs();
  }, [hydrate, hydratePrefs]);

  async function onSaveGeneral() {
    try {
      await savePrefs();
      setGeneralSaved(true);
      showToast("通用设置已保存", "success", 2500);
      setTimeout(() => setGeneralSaved(false), 1500);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      showToast(`保存失败：${msg}`, "error");
    }
  }

  async function onSave() {
    try {
      await save();
      setSaved(true);
      showToast("AI 设置已保存", "success", 2500);
      setTimeout(() => setSaved(false), 1500);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      showToast(`保存失败：${msg}`, "error");
    }
  }

  async function onProbe() {
    setProbing(true);
    setProbeMsg(null);
    try {
      if (mode === "local") {
        const r = await aiProbeOllama();
        if (r.ok) {
          const names = r.models.slice(0, 6).join(", ") || "（无模型，请 ollama pull）";
          setProbeMsg(`Ollama 可用 · 模型：${names}`);
          showToast("Ollama 连接成功", "success");
        } else {
          setProbeMsg(r.error);
          showToast(r.error, "error");
        }
      } else {
        const r = await aiProbeCloud();
        if (r.ok) {
          setProbeMsg("云端连接正常");
          showToast("云端探测成功", "success");
        } else {
          setProbeMsg(r.error);
          showToast(r.error, "error");
        }
      }
    } finally {
      setProbing(false);
    }
  }

  return (
    <Box data-testid="settings" sx={{ display: "flex", height: "100%", minHeight: 0 }}>
      <Box
        sx={{
          width: 200,
          borderRight: 1,
          borderColor: "divider",
          p: 1,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Typography variant="subtitle1" sx={{ px: 1.5, py: 1 }}>
          设置
        </Typography>
        <List dense>
          {(
            [
              ["general", "通用"],
              ["accounts", "账号"],
              ["ai", "AI"],
            ] as const
          ).map(([id, label]) => (
            <ListItemButton key={id} selected={tab === id} onClick={() => setTab(id)}>
              <ListItemText primary={label} />
            </ListItemButton>
          ))}
        </List>
        {onClose && (
          <Button startIcon={<ArrowBackIcon />} onClick={onClose} sx={{ mt: "auto" }}>
            返回收件箱
          </Button>
        )}
      </Box>

      <Box sx={{ flex: 1, p: 3, overflow: "auto" }}>
        {tab === "general" && (
          <Stack spacing={3} sx={{ maxWidth: 480 }} data-testid="settings-general">
            <Typography variant="h5">通用</Typography>
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                外观
              </Typography>
              <ToggleButtonGroup
                exclusive
                size="small"
                value={theme}
                onChange={(_, v) => v && onThemeChange(v)}
                aria-label="主题"
              >
                <ToggleButton value="light">浅色</ToggleButton>
                <ToggleButton value="dark">深色</ToggleButton>
              </ToggleButtonGroup>
            </Box>
            <FormControl fullWidth size="small">
              <InputLabel id="sync-interval-label">自动同步</InputLabel>
              <Select
                labelId="sync-interval-label"
                label="自动同步"
                value={syncIntervalMin}
                onChange={(e) => setSyncIntervalMin(Number(e.target.value))}
                inputProps={{ "aria-label": "自动同步频率" }}
              >
                {SYNC_INTERVAL_OPTIONS.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </MenuItem>
                ))}
              </Select>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.75, display: "block" }}>
                {syncIntervalMin === 0
                  ? "不会在后台拉信，只在你点同步或发信/存草稿后更新。"
                  : `后台约每 ${syncIntervalMin} 分钟同步一次当前账号（正在同步时会跳过）。`}
              </Typography>
            </FormControl>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
              <Button variant="contained" onClick={() => void onSaveGeneral()}>
                保存通用设置
              </Button>
              {generalSaved && (
                <Typography variant="caption" color="success.main">
                  已保存
                </Typography>
              )}
            </Stack>
          </Stack>
        )}

        {tab === "accounts" && (
          <Stack spacing={2} sx={{ maxWidth: 480 }}>
            <Typography variant="h5">账号</Typography>
            <Typography variant="body2" color="text.secondary">
              在侧栏使用「添加账号」管理邮箱。密码保存在系统加密存储中。
            </Typography>
          </Stack>
        )}

        {tab === "ai" && (
          <Stack spacing={2.5} sx={{ maxWidth: 560 }} data-testid="settings-ai">
            <Typography variant="h5">AI</Typography>

            <Alert severity="info">
              <strong>数据去向：</strong>
              {mode === "cloud" ? (
                <>
                  云端模式会将当前邮件的主题与正文（经清洗截断）发送到你配置的{" "}
                  <code>{baseUrl || "base URL"}</code>。附件默认不上传。API Key 仅保存在本机加密存储。
                </>
              ) : (
                <>
                  本机模式仅请求 <code>{ollamaHost || "localhost Ollama"}</code>
                  ，邮件内容不离开本机。
                </>
              )}
            </Alert>

            <Box>
              <Typography variant="subtitle2" gutterBottom>
                AI 模式
              </Typography>
              <ToggleButtonGroup
                exclusive
                size="small"
                value={mode}
                onChange={(_, v) => v && setMode(v)}
                aria-label="AI 模式"
              >
                <ToggleButton value="cloud">云端</ToggleButton>
                <ToggleButton value="local">本机</ToggleButton>
              </ToggleButtonGroup>
            </Box>

            {mode === "cloud" && (
              <>
                <TextField
                  label="Base URL（OpenAI 兼容）"
                  size="small"
                  fullWidth
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="https://api.openai.com/v1"
                  helperText="任意兼容 /v1/chat/completions 的服务"
                />
                <TextField
                  label="API Key"
                  size="small"
                  fullWidth
                  type="password"
                  value={apiKeyDraft}
                  onChange={(e) => setApiKeyDraft(e.target.value)}
                  placeholder={hasCloudApiKey ? "已保存（留空则不修改）" : "sk-…"}
                  autoComplete="off"
                />
                <TextField
                  label="模型"
                  size="small"
                  fullWidth
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="gpt-4o-mini"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={cloudPrivacyAck}
                      onChange={(e) => setCloudPrivacyAck(e.target.checked)}
                      slotProps={{ input: { "aria-label": "已了解云端隐私" } }}
                    />
                  }
                  label="我了解云端模式会将邮件正文发往所配置的服务"
                />
              </>
            )}

            {mode === "local" && (
              <>
                <TextField
                  label="Ollama 地址"
                  size="small"
                  fullWidth
                  value={ollamaHost}
                  onChange={(e) => setOllamaHost(e.target.value)}
                  placeholder="http://127.0.0.1:11434"
                />
                <TextField
                  label="Ollama 模型"
                  size="small"
                  fullWidth
                  value={ollamaModel}
                  onChange={(e) => setOllamaModel(e.target.value)}
                  placeholder="llama3.2"
                  helperText="需已 ollama pull 对应模型"
                />
              </>
            )}

            <FormControl fullWidth size="small" sx={{ display: "none" }}>
              <InputLabel>兼容</InputLabel>
              <Select label="兼容" value="openai">
                <MenuItem value="openai">OpenAI 兼容</MenuItem>
              </Select>
            </FormControl>

            <FormControlLabel
              control={
                <Switch
                  checked={preferLocalWhenAvailable}
                  onChange={(e) => setPreferLocal(e.target.checked)}
                  slotProps={{ input: { "aria-label": "可用时优先本机" } }}
                />
              }
              label="探测到 Ollama 时提示优先本机（不自动跨模式回退请求）"
            />

            {probeMsg && (
              <Alert severity={probeMsg.includes("失败") || probeMsg.includes("无法") ? "warning" : "success"}>
                {probeMsg}
              </Alert>
            )}

            <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", flexWrap: "wrap" }}>
              <Button variant="contained" onClick={() => void onSave()}>
                保存更改
              </Button>
              <Button variant="outlined" disabled={probing} onClick={() => void onProbe()}>
                {probing ? "探测中…" : mode === "local" ? "探测 Ollama" : "探测云端"}
              </Button>
              {saved && (
                <Typography variant="caption" color="success.main">
                  已保存
                </Typography>
              )}
            </Stack>
          </Stack>
        )}
      </Box>
    </Box>
  );
}
