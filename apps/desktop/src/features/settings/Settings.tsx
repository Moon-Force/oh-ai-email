import { useState } from "react";
import {
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
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  Alert,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useAiSettings } from "../ai/settingsStore";

type Tab = "general" | "accounts" | "ai";

type Props = {
  onClose?: () => void;
  theme: "light" | "dark";
  onThemeChange: (t: "light" | "dark") => void;
};

export default function Settings({ onClose, theme, onThemeChange }: Props) {
  const [tab, setTab] = useState<Tab>("ai");
  const { mode, setMode, provider, setProvider, model, setModel, preferLocalWhenAvailable, setPreferLocal } =
    useAiSettings();
  const [saved, setSaved] = useState(false);

  function save() {
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
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
          <Stack spacing={3} sx={{ maxWidth: 480 }}>
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
            <Alert severity="info">
              界面已切换为 <strong>MUI Material UI</strong>。原 Liquid Glass / WebGL 透镜不再作为默认视觉。
            </Alert>
          </Stack>
        )}

        {tab === "accounts" && (
          <Stack spacing={2} sx={{ maxWidth: 480 }}>
            <Typography variant="h5">账号</Typography>
            <Typography variant="body2" color="text.secondary">
              在侧栏使用「添加账号」管理邮箱。密钥将存入系统钥匙串（后续接入）。
            </Typography>
          </Stack>
        )}

        {tab === "ai" && (
          <Stack spacing={3} sx={{ maxWidth: 520 }}>
            <Typography variant="h5">AI</Typography>
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
            <FormControl fullWidth size="small">
              <InputLabel>提供商</InputLabel>
              <Select label="提供商" value={provider} onChange={(e) => setProvider(e.target.value)}>
                <MenuItem value="OpenAI 兼容">OpenAI 兼容</MenuItem>
                <MenuItem value="自定义">自定义</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth size="small">
              <InputLabel>模型</InputLabel>
              <Select label="模型" value={model} onChange={(e) => setModel(e.target.value)}>
                <MenuItem value="gpt-4o-mini">gpt-4o-mini</MenuItem>
                <MenuItem value="gpt-4o">gpt-4o</MenuItem>
                <MenuItem value="llama3.2">llama3.2（Ollama）</MenuItem>
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
              label="可用时优先本机"
            />
            <Alert severity="info">
              云端模式会将邮件正文发送到所选提供商处理。本机模式通过本地 Ollama，内容留在你的设备上。
            </Alert>
            <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
              <Button variant="contained" onClick={save}>
                保存更改
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
