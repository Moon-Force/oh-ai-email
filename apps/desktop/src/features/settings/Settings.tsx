import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  FormControl,
  FormControlLabel,
  InputLabel,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ClearIcon from "@mui/icons-material/Clear";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import MicIcon from "@mui/icons-material/Mic";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import GraphicEqIcon from "@mui/icons-material/GraphicEq";
import { useAiSettings } from "../ai/settingsStore";
import { useAiAuditStore } from "../ai/auditStore";
import { SYNC_INTERVAL_OPTIONS, usePrefsStore } from "./prefsStore";
import {
  aiListModels,
  aiProbeCloud,
  aiProbeOllama,
  aiQueryBalance,
  prefsGetAutolaunch,
  prefsSetAutolaunch,
  updaterCheck,
  type AiBalanceResult,
  type UpdateCheckResultDto,
} from "../../lib/ipc";
import { useToastStore } from "../shell/toastStore";
import { speakText, stopSpeaking, startSpeechRecognition } from "../voice/voiceService";

import SkillsTab from "./SkillsTab";

type Tab = "general" | "accounts" | "ai" | "skills";

type Props = {
  onClose?: () => void;
  theme: "light" | "dark";
  onThemeChange: (t: "light" | "dark") => void;
};

export default function Settings({ onClose, theme, onThemeChange }: Props) {
  const [tab, setTab] = useState<Tab>("ai");
  const [autoLaunch, setAutoLaunch] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateResult, setUpdateResult] = useState<UpdateCheckResultDto | null>(null);
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
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
    redactSensitiveData,
    setRedactSensitiveData,
    apiKeyDraft,
    setApiKeyDraft,
    hasCloudApiKey,
    cloudPrivacyAck,
    setCloudPrivacyAck,
    reasoningEffort,
    setReasoningEffort,
    maxTokens,
    setMaxTokens,
    timeoutSeconds,
    setTimeoutSeconds,
    sttService,
    setSttService,
    sttBaseUrl,
    setSttBaseUrl,
    sttModel,
    setSttModel,
    sttApiKeyDraft,
    setSttApiKeyDraft,
    hasSttApiKey,
    ttsService,
    setTtsService,
    ttsBaseUrl,
    setTtsBaseUrl,
    ttsModel,
    setTtsModel,
    ttsVoice,
    setTtsVoice,
    ttsApiKeyDraft,
    setTtsApiKeyDraft,
    hasTtsApiKey,
    userPersona,
    userPersonaTraits,
    setUserPersona,
    learningTone,
    learnUserTone,
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
  const [fetchingModels, setFetchingModels] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [queryingBalance, setQueryingBalance] = useState(false);
  const [balanceInfo, setBalanceInfo] = useState<AiBalanceResult | null>(null);
  const [testingTts, setTestingTts] = useState(false);
  const [testingStt, setTestingStt] = useState(false);
  const [sttTestResult, setSttTestResult] = useState<string | null>(null);
  const sttStopRef = useState<(() => void) | null>(null);
  const showToast = useToastStore((s) => s.showToast);
  const auditRecords = useAiAuditStore((s) => s.records);
  const clearAuditRecords = useAiAuditStore((s) => s.clearRecords);

  useEffect(() => {
    void hydrate();
    void hydratePrefs();
    void prefsGetAutolaunch().then(setAutoLaunch);
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
      if (mode === "cloud") {
        const r = await aiProbeCloud();
        if (r.ok) {
          showToast(`云端连通成功（${model}）`, "success");
        } else {
          showToast(r.error, "error");
        }
      } else {
        const r = await aiProbeOllama();
        if (r.ok) {
          showToast(`本地 Ollama 正常（${r.models.join(", ") || "无模型"}）`, "success");
        } else {
          showToast(r.error, "error");
        }
      }
    } finally {
      setProbing(false);
    }
  }

  async function onFetchModels() {
    setFetchingModels(true);
    try {
      const res = await aiListModels();
      if (res.ok) {
        if (res.models.length > 0) {
          setAvailableModels(res.models);
          showToast(`成功获取 ${res.models.length} 个可用模型`, "success");
        } else {
          showToast("未拉取到可用模型", "error");
        }
      } else {
        showToast(res.error, "error");
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : "获取模型失败", "error");
    } finally {
      setFetchingModels(false);
    }
  }

  async function onQueryBalance() {
    setQueryingBalance(true);
    try {
      const res = await aiQueryBalance();
      setBalanceInfo(res);
      if (res.ok) {
        showToast("余额查询成功", "success");
      } else {
        showToast(res.error, "error");
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : "查询余额失败", "error");
    } finally {
      setQueryingBalance(false);
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
              ["skills", "技能与 MCP"],
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
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ mt: 0.75, display: "block" }}
              >
                {syncIntervalMin === 0
                  ? "不会在后台拉信，只在你点同步或发信/存草稿后更新。"
                  : `后台约每 ${syncIntervalMin} 分钟同步一次当前账号（正在同步时会跳过）。`}
              </Typography>
            </FormControl>

            <Box>
              <Typography variant="subtitle2" gutterBottom>
                系统集成
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={autoLaunch}
                    onChange={async (e) => {
                      const next = e.target.checked;
                      setAutoLaunch(next);
                      const res = await prefsSetAutolaunch(next);
                      setAutoLaunch(res);
                      showToast(res ? "已开启开机自启动" : "已关闭开机自启动", "info", 2000);
                    }}
                  />
                }
                label="开机自动启动（并在后台静默常驻）"
              />
            </Box>

            <Divider />

            <Box>
              <Typography variant="subtitle2" gutterBottom>
                版本与更新
              </Typography>
              <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
                <Typography variant="body2" color="text.secondary">
                  当前版本：<strong>v{updateResult?.currentVersion || "0.2.0"}</strong>
                </Typography>
                <Button
                  size="small"
                  variant="outlined"
                  disabled={checkingUpdate}
                  onClick={async () => {
                    setCheckingUpdate(true);
                    try {
                      const res = await updaterCheck();
                      setUpdateResult(res);
                      setUpdateDialogOpen(true);
                    } catch {
                      showToast("检查更新失败，请检查网络", "error");
                    } finally {
                      setCheckingUpdate(false);
                    }
                  }}
                >
                  {checkingUpdate ? "检查中..." : "检查更新"}
                </Button>
              </Stack>
            </Box>

            <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", pt: 1 }}>
              <Button variant="contained" onClick={() => void onSaveGeneral()}>
                保存通用设置
              </Button>
              {generalSaved && (
                <Typography variant="caption" color="success.main">
                  已保存
                </Typography>
              )}
            </Stack>

            <Dialog
              open={updateDialogOpen}
              onClose={() => setUpdateDialogOpen(false)}
              maxWidth="xs"
              fullWidth
            >
              <DialogTitle>软件更新检查</DialogTitle>
              <DialogContent dividers>
                {updateResult?.updateAvailable ? (
                  <Stack spacing={1.5}>
                    <Alert severity="success">发现新版本 v{updateResult.latestVersion}！</Alert>
                    <Typography variant="subtitle2">更新说明：</Typography>
                    <Typography
                      variant="body2"
                      sx={{ whiteSpace: "pre-wrap", color: "text.secondary" }}
                    >
                      {updateResult.releaseNotes || "包含多项体验优化与功能提升。"}
                    </Typography>
                  </Stack>
                ) : (
                  <Stack spacing={1}>
                    <Typography variant="body1">
                      当前已是最新版本 (v{updateResult?.currentVersion || "0.2.0"})。
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      所有功能均已就绪。
                    </Typography>
                  </Stack>
                )}
              </DialogContent>
              <DialogActions>
                {updateResult?.updateAvailable && updateResult.releaseUrl && (
                  <Button
                    variant="contained"
                    onClick={() => {
                      if (typeof window !== "undefined" && updateResult.releaseUrl) {
                        window.open(updateResult.releaseUrl, "_blank");
                      }
                      setUpdateDialogOpen(false);
                    }}
                  >
                    前往下载
                  </Button>
                )}
                <Button onClick={() => setUpdateDialogOpen(false)}>关闭</Button>
              </DialogActions>
            </Dialog>
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
                  <code>{baseUrl || "base URL"}</code>。附件默认不上传。API Key
                  仅保存在本机加密存储。
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
              <Stack direction="row" spacing={1} sx={{ mb: 1.5, flexWrap: "wrap", gap: 0.5 }}>
                <Button
                  size="small"
                  variant={
                    baseUrl === "https://api.deepseek.com" && mode === "cloud"
                      ? "contained"
                      : "outlined"
                  }
                  onClick={() => {
                    setMode("cloud");
                    setBaseUrl("https://api.deepseek.com");
                    setModel("deepseek-chat");
                  }}
                >
                  DeepSeek
                </Button>
                <Button
                  size="small"
                  variant={
                    baseUrl === "https://api.xiaomimimo.com/v1" && mode === "cloud"
                      ? "contained"
                      : "outlined"
                  }
                  onClick={() => {
                    setMode("cloud");
                    setBaseUrl("https://api.xiaomimimo.com/v1");
                    setModel("mimo-v2.5");
                  }}
                >
                  小米 MiMo
                </Button>
                <Button
                  size="small"
                  variant={
                    baseUrl === "https://api.openai.com/v1" && mode === "cloud"
                      ? "contained"
                      : "outlined"
                  }
                  onClick={() => {
                    setMode("cloud");
                    setBaseUrl("https://api.openai.com/v1");
                    setModel("gpt-4o-mini");
                  }}
                >
                  OpenAI
                </Button>
                <Button
                  size="small"
                  variant={mode === "local" ? "contained" : "outlined"}
                  onClick={() => {
                    setMode("local");
                    setOllamaHost("http://127.0.0.1:11434");
                    setOllamaModel("llama3.2");
                  }}
                >
                  Ollama 本地
                </Button>
              </Stack>

              <ToggleButtonGroup
                exclusive
                size="small"
                value={mode}
                onChange={(_, v) => v && setMode(v)}
                aria-label="AI 模式"
              >
                <ToggleButton value="cloud">云端模式</ToggleButton>
                <ToggleButton value="local">本机模式 (Ollama)</ToggleButton>
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
                  helperText="支持 DeepSeek (https://api.deepseek.com)、小米 MiMo、OpenAI 等"
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

                <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
                  {availableModels.length > 0 ? (
                    <FormControl fullWidth size="small">
                      <InputLabel id="model-select-label">模型</InputLabel>
                      <Select
                        labelId="model-select-label"
                        value={model}
                        label="模型"
                        onChange={(e) => setModel(e.target.value)}
                      >
                        {availableModels.map((m) => (
                          <MenuItem key={m} value={m}>
                            {m}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  ) : (
                    <TextField
                      label="模型"
                      size="small"
                      fullWidth
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      placeholder="deepseek-chat / mimo-v2.5 / gpt-4o-mini"
                    />
                  )}
                  <Button
                    variant="outlined"
                    size="small"
                    sx={{ height: 40, whiteSpace: "nowrap" }}
                    disabled={fetchingModels}
                    onClick={() => void onFetchModels()}
                  >
                    {fetchingModels ? <CircularProgress size={16} /> : "拉取模型"}
                  </Button>
                </Box>

                <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                  <Button
                    variant="outlined"
                    size="small"
                    disabled={queryingBalance}
                    onClick={() => void onQueryBalance()}
                  >
                    {queryingBalance ? <CircularProgress size={16} /> : "查询余额"}
                  </Button>
                </Box>

                {balanceInfo &&
                  balanceInfo.ok &&
                  balanceInfo.balanceInfos &&
                  balanceInfo.balanceInfos.length > 0 && (
                    <Paper
                      variant="outlined"
                      sx={{ p: 1.5, bgcolor: "action.hover", borderRadius: 1.5 }}
                    >
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                        账户余额信息
                      </Typography>
                      {balanceInfo.balanceInfos.map((b, idx) => (
                        <Stack key={idx} direction="row" spacing={2} sx={{ fontSize: "0.85rem" }}>
                          <Typography variant="body2">
                            <strong>总余额：</strong>
                            {b.currency} {b.total_balance}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            赠送：{b.granted_balance}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            充值：{b.topped_up_balance}
                          </Typography>
                        </Stack>
                      ))}
                    </Paper>
                  )}

                {/* Reasoning Effort Selector */}
                <Box sx={{ mt: 1, p: 1.5, borderRadius: 1.5, bgcolor: "action.hover", border: 1, borderColor: "divider" }}>
                  <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                    思考推理强度 (Reasoning Effort)
                  </Typography>
                  <ToggleButtonGroup
                    exclusive
                    size="small"
                    value={reasoningEffort}
                    onChange={(_, v) => v && setReasoningEffort(v)}
                    aria-label="思考推理强度"
                    sx={{ mb: 1 }}
                  >
                    <ToggleButton value="low">低 (Low · 极速)</ToggleButton>
                    <ToggleButton value="medium">中 (Medium · 均衡 - 推荐)</ToggleButton>
                    <ToggleButton value="high">高 (High · 深度)</ToggleButton>
                  </ToggleButtonGroup>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                    {reasoningEffort === "low"
                      ? "⚡ 极速响应，思考紧凑精炼，适合日常短邮件快速总结与一键回复。"
                      : reasoningEffort === "high"
                        ? "🧠 深度多步推演与严谨反思，适合长线索时间线全景分析、复杂条款审核与重要邮件草拟。"
                        : "⚖️ 推荐模式：兼顾深度推理质量与响应速度，适合常规邮件分析与回复润色。"}
                  </Typography>
                </Box>

                {/* Max Tokens & Timeout Controls */}
                <Box sx={{ mt: 1, display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.5 }}>
                  <FormControl size="small" fullWidth>
                    <InputLabel id="max-tokens-label">最大输出 Token (Max Tokens)</InputLabel>
                    <Select
                      labelId="max-tokens-label"
                      value={maxTokens || 32768}
                      label="最大输出 Token (Max Tokens)"
                      onChange={(e) => setMaxTokens(Number(e.target.value))}
                    >
                      <MenuItem value={4096}>4,096 (4K · 极速轻量)</MenuItem>
                      <MenuItem value={8192}>8,192 (8K · 紧凑)</MenuItem>
                      <MenuItem value={16384}>16,384 (16K · 标配长文)</MenuItem>
                      <MenuItem value={32768}>32,768 (32K · 推荐 / 深度推演)</MenuItem>
                      <MenuItem value={65536}>65,536 (64K · 全景多邮件分析)</MenuItem>
                      <MenuItem value={131072}>131,072 (128K · 极客旗舰无损)</MenuItem>
                    </Select>
                  </FormControl>

                  <FormControl size="small" fullWidth>
                    <InputLabel id="timeout-seconds-label">单次请求超时限制</InputLabel>
                    <Select
                      labelId="timeout-seconds-label"
                      value={timeoutSeconds || 300}
                      label="单次请求超时限制"
                      onChange={(e) => setTimeoutSeconds(Number(e.target.value))}
                    >
                      <MenuItem value={60}>60 秒 (1分钟 · 短请求)</MenuItem>
                      <MenuItem value={120}>120 秒 (2分钟 · 中等)</MenuItem>
                      <MenuItem value={180}>180 秒 (3分钟)</MenuItem>
                      <MenuItem value={300}>300 秒 (5分钟 · 推荐 / 长任务)</MenuItem>
                      <MenuItem value={600}>600 秒 (10分钟 · 深度推理)</MenuItem>
                    </Select>
                  </FormControl>
                </Box>

                <FormControlLabel
                  control={
                    <Switch
                      checked={Boolean(cloudPrivacyAck)}
                      onChange={(e) => setCloudPrivacyAck(e.target.checked)}
                      slotProps={{ input: { "aria-label": "已了解云端隐私" } }}
                    />
                  }
                  label="我了解云端模式会将邮件正文发往所配置的服务"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={Boolean(redactSensitiveData)}
                      onChange={(e) => setRedactSensitiveData(e.target.checked)}
                      slotProps={{ input: { "aria-label": "敏感数据自动脱敏" } }}
                    />
                  }
                  label="发送云端前自动脱敏（邮箱、手机号、卡号替换为安全占位符）"
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
                <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
                  {availableModels.length > 0 ? (
                    <FormControl fullWidth size="small">
                      <InputLabel id="ollama-model-select-label">Ollama 模型</InputLabel>
                      <Select
                        labelId="ollama-model-select-label"
                        value={ollamaModel}
                        label="Ollama 模型"
                        onChange={(e) => setOllamaModel(e.target.value)}
                      >
                        {availableModels.map((m) => (
                          <MenuItem key={m} value={m}>
                            {m}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  ) : (
                    <TextField
                      label="Ollama 模型"
                      size="small"
                      fullWidth
                      value={ollamaModel}
                      onChange={(e) => setOllamaModel(e.target.value)}
                      placeholder="llama3.2"
                      helperText="需已 ollama pull 对应模型"
                    />
                  )}
                  <Button
                    variant="outlined"
                    size="small"
                    sx={{ height: 40, whiteSpace: "nowrap" }}
                    disabled={fetchingModels}
                    onClick={() => void onFetchModels()}
                  >
                    {fetchingModels ? <CircularProgress size={16} /> : "拉取模型"}
                  </Button>
                </Box>
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
                  checked={Boolean(preferLocalWhenAvailable)}
                  onChange={(e) => setPreferLocal(e.target.checked)}
                  slotProps={{ input: { "aria-label": "可用时优先本机" } }}
                />
              }
              label="探测到 Ollama 时提示优先本机（不自动跨模式回退请求）"
            />

            {/* Tone Persona Section */}
            <Divider sx={{ my: 1 }} />
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: "background.paper" }}>
              <Stack
                direction="row"
                spacing={1}
                sx={{ alignItems: "center", justifyContent: "space-between", mb: 1.5 }}
              >
                <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                  <AutoAwesomeIcon color="primary" fontSize="small" />
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    专属写作语气画像
                  </Typography>
                </Stack>
                <Button
                  variant="outlined"
                  size="small"
                  disabled={learningTone}
                  onClick={async () => {
                    const res = await learnUserTone();
                    if (!res.ok && res.error) {
                      setProbeMsg(res.error);
                    } else if (res.ok) {
                      showToast("已成功从发件箱提炼您的专属语气风格！", "success", 3000);
                    }
                  }}
                  startIcon={learningTone ? <CircularProgress size={14} /> : <AutoAwesomeIcon />}
                >
                  {learningTone ? "正在分析发件箱…" : "从发件箱一键学习"}
                </Button>
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                基于您在本地发件箱（Sent）中的真实邮件采样，提炼个性化写作习惯。在写信或回复时，可一键选择「以我的风格」自动生成贴合您习惯的拟人化草稿。
              </Typography>
              <TextField
                label="个性化语气画像描述"
                size="small"
                fullWidth
                multiline
                rows={2}
                value={userPersona}
                onChange={(e) => setUserPersona(e.target.value)}
                placeholder="例如：语言干练高效，语气诚恳专业，习惯先给出明确结论并分条阐述要点，结尾使用祝好。"
                helperText={
                  userPersonaTraits.length > 0
                    ? `已识别特征：${userPersonaTraits.join(" · ")}`
                    : "可直接手动修改或点击上方按钮智能从发件箱提炼"
                }
              />
            </Paper>

            {/* Voice Multimodal (STT & TTS) Section */}
            <Divider sx={{ my: 1 }} />
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: "background.paper" }} data-testid="voice-settings-section">
              <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1.5 }}>
                <GraphicEqIcon color="primary" fontSize="small" />
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  语音输入 (STT) 与语音朗读 (TTS) 配置
                </Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                支持配置 OpenAI 兼容的 Whisper / MiMo 等高品质云端语音大模型，亦支持使用系统原生 Web Speech 引擎。
              </Typography>

              {/* STT Section */}
              <Box sx={{ p: 1.5, mb: 2, borderRadius: 1.5, bgcolor: "action.hover", border: 1, borderColor: "divider" }}>
                <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1.25 }}>
                  <MicIcon color="primary" fontSize="small" />
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    语音输入 (Speech-to-Text / 听写)
                  </Typography>
                  <Chip
                    size="small"
                    label={sttService === "custom" ? "自定义模型" : "系统内置"}
                    color="primary"
                    variant="outlined"
                    sx={{ height: 20, "& .MuiChip-label": { px: 0.75, fontSize: "0.65rem" } }}
                  />
                </Stack>

                <Stack direction="row" spacing={1} sx={{ mb: 1.5, flexWrap: "wrap", gap: 0.5 }}>
                  <Button
                    size="small"
                    variant={sttService === "custom" && sttBaseUrl === "https://api.openai.com/v1" && sttModel === "whisper-1" ? "contained" : "outlined"}
                    onClick={() => {
                      setSttService("custom");
                      setSttBaseUrl("https://api.openai.com/v1");
                      setSttModel("whisper-1");
                    }}
                  >
                    OpenAI Whisper
                  </Button>
                  <Button
                    size="small"
                    variant={sttService === "custom" && sttBaseUrl === "https://api.xiaomimimo.com/v1" ? "contained" : "outlined"}
                    onClick={() => {
                      setSttService("custom");
                      setSttBaseUrl("https://api.xiaomimimo.com/v1");
                      setSttModel("mimo-asr");
                    }}
                  >
                    小米 MiMo 语音
                  </Button>
                  <Button
                    size="small"
                    variant={sttService === "browser" ? "contained" : "outlined"}
                    onClick={() => {
                      setSttService("browser");
                    }}
                  >
                    系统内置 (Web Speech)
                  </Button>
                </Stack>

                <ToggleButtonGroup
                  exclusive
                  size="small"
                  value={sttService}
                  onChange={(_, v) => v && setSttService(v)}
                  sx={{ mb: 1.5 }}
                >
                  <ToggleButton value="custom">云端/自定义 STT 服务</ToggleButton>
                  <ToggleButton value="browser">系统内置识别引擎</ToggleButton>
                </ToggleButtonGroup>

                {sttService === "custom" && (
                  <Stack spacing={1.5}>
                    <TextField
                      label="STT 服务地址 Base URL"
                      size="small"
                      fullWidth
                      value={sttBaseUrl}
                      onChange={(e) => setSttBaseUrl(e.target.value)}
                      placeholder="https://api.openai.com/v1"
                      helperText="将自动请求 /audio/transcriptions 接口"
                    />
                    <TextField
                      label="STT 模型名称 (Model)"
                      size="small"
                      fullWidth
                      value={sttModel}
                      onChange={(e) => setSttModel(e.target.value)}
                      placeholder="whisper-1 / mimo-asr / SenseVoiceSmall"
                    />
                    <TextField
                      label="STT 专属 API Key（留空则复用通用 AI Key）"
                      size="small"
                      fullWidth
                      type="password"
                      value={sttApiKeyDraft}
                      onChange={(e) => setSttApiKeyDraft(e.target.value)}
                      placeholder={hasSttApiKey ? "已配置独立 Key（留空则不修改）" : "留空则复用通用云端 API Key"}
                      autoComplete="off"
                    />
                  </Stack>
                )}

                {/* STT Test Box */}
                <Box sx={{ mt: 1.5, pt: 1.5, borderTop: 1, borderColor: "divider" }}>
                  <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
                    <Button
                      variant={testingStt ? "contained" : "outlined"}
                      color={testingStt ? "error" : "primary"}
                      size="small"
                      startIcon={<MicIcon />}
                      onClick={() => {
                        if (testingStt) {
                          if (sttStopRef[0]) {
                            sttStopRef[0]();
                            sttStopRef[1](null);
                          }
                          setTestingStt(false);
                        } else {
                          setTestingStt(true);
                          setSttTestResult("正在聆听录音中，请说话并点击停止…");
                          const stopFn = startSpeechRecognition(
                            (text) => {
                              setSttTestResult(`识别结果：${text}`);
                              showToast("语音识别测试成功！", "success", 2000);
                            },
                            (err) => {
                              setSttTestResult(`识别失败：${err}`);
                              showToast(err, "error", 4000);
                              setTestingStt(false);
                            },
                            () => {
                              setTestingStt(false);
                            }
                          );
                          sttStopRef[1](() => stopFn);
                        }
                      }}
                    >
                      {testingStt ? "停止录音并识别" : "测试录音转写"}
                    </Button>
                    {testingStt && (
                      <Chip size="small" label="正在录音…" color="error" variant="outlined" />
                    )}
                  </Stack>
                  {sttTestResult && (
                    <Typography variant="body2" sx={{ mt: 1, p: 1, borderRadius: 1, bgcolor: "background.paper", fontSize: "0.8rem" }}>
                      {sttTestResult}
                    </Typography>
                  )}
                </Box>
              </Box>

              {/* TTS Section */}
              <Box sx={{ p: 1.5, borderRadius: 1.5, bgcolor: "action.hover", border: 1, borderColor: "divider" }}>
                <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1.25 }}>
                  <VolumeUpIcon color="primary" fontSize="small" />
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    语音朗读 (Text-to-Speech / 合成)
                  </Typography>
                  <Chip
                    size="small"
                    label={ttsService === "custom" ? "自定义模型" : "系统内置"}
                    color="primary"
                    variant="outlined"
                    sx={{ height: 20, "& .MuiChip-label": { px: 0.75, fontSize: "0.65rem" } }}
                  />
                </Stack>

                <Stack direction="row" spacing={1} sx={{ mb: 1.5, flexWrap: "wrap", gap: 0.5 }}>
                  <Button
                    size="small"
                    variant={ttsService === "custom" && ttsBaseUrl === "https://api.openai.com/v1" && ttsModel === "tts-1" ? "contained" : "outlined"}
                    onClick={() => {
                      setTtsService("custom");
                      setTtsBaseUrl("https://api.openai.com/v1");
                      setTtsModel("tts-1");
                      setTtsVoice("alloy");
                    }}
                  >
                    OpenAI TTS
                  </Button>
                  <Button
                    size="small"
                    variant={ttsService === "custom" && ttsBaseUrl === "https://api.xiaomimimo.com/v1" ? "contained" : "outlined"}
                    onClick={() => {
                      setTtsService("custom");
                      setTtsBaseUrl("https://api.xiaomimimo.com/v1");
                      setTtsModel("mimo-tts");
                    }}
                  >
                    小米 MiMo 语音
                  </Button>
                  <Button
                    size="small"
                    variant={ttsService === "browser" ? "contained" : "outlined"}
                    onClick={() => {
                      setTtsService("browser");
                    }}
                  >
                    系统内置 (SpeechSynthesis)
                  </Button>
                </Stack>

                <ToggleButtonGroup
                  exclusive
                  size="small"
                  value={ttsService}
                  onChange={(_, v) => v && setTtsService(v)}
                  sx={{ mb: 1.5 }}
                >
                  <ToggleButton value="custom">云端/自定义 TTS 服务</ToggleButton>
                  <ToggleButton value="browser">系统内置合成引擎</ToggleButton>
                </ToggleButtonGroup>

                {ttsService === "custom" && (
                  <Stack spacing={1.5}>
                    <TextField
                      label="TTS 服务地址 Base URL"
                      size="small"
                      fullWidth
                      value={ttsBaseUrl}
                      onChange={(e) => setTtsBaseUrl(e.target.value)}
                      placeholder="https://api.openai.com/v1"
                      helperText="将自动请求 /audio/speech 接口"
                    />
                    <Box sx={{ display: "flex", gap: 1 }}>
                      <TextField
                        label="TTS 模型名称 (Model)"
                        size="small"
                        sx={{ flex: 2 }}
                        value={ttsModel}
                        onChange={(e) => setTtsModel(e.target.value)}
                        placeholder="tts-1 / mimo-tts / cosyvoice"
                      />
                      <FormControl size="small" sx={{ flex: 1 }}>
                        <InputLabel id="tts-voice-label">音色 (Voice)</InputLabel>
                        <Select
                          labelId="tts-voice-label"
                          value={ttsVoice}
                          label="音色 (Voice)"
                          onChange={(e) => setTtsVoice(e.target.value)}
                        >
                          <MenuItem value="alloy">Alloy (中性沉稳)</MenuItem>
                          <MenuItem value="echo">Echo (阳光明朗)</MenuItem>
                          <MenuItem value="fable">Fable (英式叙事)</MenuItem>
                          <MenuItem value="onyx">Onyx (深沉权威)</MenuItem>
                          <MenuItem value="nova">Nova (自然亲和)</MenuItem>
                          <MenuItem value="shimmer">Shimmer (清亮温和)</MenuItem>
                        </Select>
                      </FormControl>
                    </Box>
                    <TextField
                      label="TTS 专属 API Key（留空则复用通用 AI Key）"
                      size="small"
                      fullWidth
                      type="password"
                      value={ttsApiKeyDraft}
                      onChange={(e) => setTtsApiKeyDraft(e.target.value)}
                      placeholder={hasTtsApiKey ? "已配置独立 Key（留空则不修改）" : "留空则复用通用云端 API Key"}
                      autoComplete="off"
                    />
                  </Stack>
                )}

                {/* TTS Test Box */}
                <Box sx={{ mt: 1.5, pt: 1.5, borderTop: 1, borderColor: "divider" }}>
                  <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={testingTts ? <CircularProgress size={14} /> : <VolumeUpIcon />}
                      disabled={testingTts}
                      onClick={() => {
                        setTestingTts(true);
                        const stopFn = speakText(
                          "你好！我是您的智能邮件语音助手，很高兴为您服务。",
                          () => setTestingTts(false),
                          (err) => {
                            showToast(err, "error", 4000);
                            setTestingTts(false);
                          }
                        );
                      }}
                    >
                      {testingTts ? "正在播放语音…" : "试听朗读效果"}
                    </Button>
                    {testingTts && (
                      <Button
                        size="small"
                        color="inherit"
                        onClick={() => {
                          stopSpeaking();
                          setTestingTts(false);
                        }}
                      >
                        停止播放
                      </Button>
                    )}
                  </Stack>
                </Box>
              </Box>
            </Paper>

            {probeMsg && (
              <Alert
                severity={
                  probeMsg.includes("失败") || probeMsg.includes("无法") ? "warning" : "success"
                }
              >
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

            <Divider sx={{ my: 2 }} />

            <Box data-testid="ai-audit-section">
              <Stack
                direction="row"
                spacing={1}
                sx={{ alignItems: "center", justifyContent: "space-between", mb: 1.5 }}
              >
                <div>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    AI 调用与隐私审计
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    仅记录请求时间、模式、任务类型与字数统计；绝不持久化任何邮件正文、收件人或 API
                    密钥。
                  </Typography>
                </div>
                {auditRecords.length > 0 && (
                  <Button
                    size="small"
                    color="inherit"
                    startIcon={<ClearIcon fontSize="small" />}
                    onClick={() => {
                      clearAuditRecords();
                      showToast("已清空 AI 调用审计记录", "info", 2000);
                    }}
                  >
                    清空记录
                  </Button>
                )}
              </Stack>

              {auditRecords.length === 0 ? (
                <Paper
                  variant="outlined"
                  sx={{ p: 2, textAlign: "center", bgcolor: "action.hover" }}
                >
                  <Typography variant="body2" color="text.secondary">
                    暂无 AI 调用记录。所有请求均严格受控且不保存邮件正文与密钥。
                  </Typography>
                </Paper>
              ) : (
                <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 240 }}>
                  <Table size="small" stickyHeader aria-label="AI 审计日志">
                    <TableHead>
                      <TableRow>
                        <TableCell>时间</TableCell>
                        <TableCell>模式</TableCell>
                        <TableCell>任务</TableCell>
                        <TableCell align="right">字符数</TableCell>
                        <TableCell align="right">耗时</TableCell>
                        <TableCell align="center">状态</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {auditRecords.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell sx={{ whiteSpace: "nowrap", fontSize: "0.75rem" }}>
                            {new Date(r.timestamp).toLocaleTimeString()}
                          </TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              label={r.mode === "local" ? "本机" : "云端"}
                              color={r.mode === "local" ? "secondary" : "primary"}
                              variant="outlined"
                              sx={{
                                height: 20,
                                "& .MuiChip-label": { px: 0.5, fontSize: "0.65rem" },
                              }}
                            />
                          </TableCell>
                          <TableCell sx={{ fontSize: "0.75rem" }}>{r.task}</TableCell>
                          <TableCell align="right" sx={{ fontSize: "0.75rem" }}>
                            {r.charCount}
                          </TableCell>
                          <TableCell align="right" sx={{ fontSize: "0.75rem" }}>
                            {r.durationMs}ms
                          </TableCell>
                          <TableCell align="center">
                            <Chip
                              size="small"
                              label={
                                r.status === "success"
                                  ? "成功"
                                  : r.status === "aborted"
                                    ? "已取消"
                                    : "失败"
                              }
                              color={
                                r.status === "success"
                                  ? "success"
                                  : r.status === "aborted"
                                    ? "default"
                                    : "error"
                              }
                              variant="filled"
                              sx={{
                                height: 20,
                                "& .MuiChip-label": { px: 0.5, fontSize: "0.65rem" },
                              }}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Box>
          </Stack>
        )}

        {tab === "skills" && <SkillsTab />}
      </Box>
    </Box>
  );
}
