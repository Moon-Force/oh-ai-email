import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Collapse,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { validateAccount, type Account, type TlsMode } from "./model";
import {
  CUSTOM_PROVIDER_ID,
  MAIL_PROVIDERS,
  customServersFromEmail,
  findProviderByEmail,
  findProviderById,
  type MailServerPreset,
} from "./providers";
import { useAccountsStore } from "./store";

type Props = {
  onClose?: () => void;
  onAdded?: () => void;
};

const TLS_OPTIONS: { value: TlsMode; label: string }[] = [
  { value: "ssl", label: "SSL/TLS" },
  { value: "starttls", label: "STARTTLS" },
  { value: "none", label: "无加密" },
];

export default function AddAccount({ onClose, onAdded }: Props) {
  const [providerId, setProviderId] = useState<string>(CUSTOM_PROVIDER_ID);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [imapHost, setImapHost] = useState("");
  const [imapPort, setImapPort] = useState(993);
  const [imapTls, setImapTls] = useState<TlsMode>("ssl");
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState(465);
  const [smtpTls, setSmtpTls] = useState<TlsMode>("ssl");
  const [advanced, setAdvanced] = useState(false);
  const [manualServers, setManualServers] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const addAccount = useAccountsStore((s) => s.addAccount);

  const provider = useMemo(
    () => (providerId === CUSTOM_PROVIDER_ID ? undefined : findProviderById(providerId)),
    [providerId],
  );

  function applyServers(servers: MailServerPreset) {
    setImapHost(servers.imapHost);
    setImapPort(servers.imapPort);
    setImapTls(servers.imapTls);
    setSmtpHost(servers.smtpHost);
    setSmtpPort(servers.smtpPort);
    setSmtpTls(servers.smtpTls);
  }

  function selectProvider(id: string) {
    setProviderId(id);
    setManualServers(id === CUSTOM_PROVIDER_ID);
    if (id === CUSTOM_PROVIDER_ID) {
      if (email.includes("@")) applyServers(customServersFromEmail(email));
      setAdvanced(true);
      return;
    }
    const p = findProviderById(id);
    if (p) {
      applyServers(p.servers);
      setAdvanced(false);
    }
  }

  function onEmailChange(v: string) {
    setEmail(v);
    if (!v.includes("@")) return;

    const known = findProviderByEmail(v);
    if (known && !manualServers) {
      setProviderId(known.id);
      applyServers(known.servers);
      return;
    }
    if (providerId === CUSTOM_PROVIDER_ID || manualServers) {
      applyServers(customServersFromEmail(v));
    }
  }

  function buildDraft(): Omit<Account, "id"> {
    return {
      email: email.trim(),
      displayName: displayName.trim() || email.split("@")[0],
      providerId,
      imapHost: imapHost.trim(),
      imapPort: Number(imapPort),
      imapTls,
      smtpHost: smtpHost.trim(),
      smtpPort: Number(smtpPort),
      smtpTls,
    };
  }

  function submit() {
    const draft = buildDraft();
    const errs = validateAccount(draft);
    if (!password.trim()) errs.push("请填写密码或授权码");
    if (errs.length) {
      setErr(errs.join("；"));
      setOk(null);
      return;
    }
    setErr(null);
    setOk("已添加（本地持久化；密钥后续写入系统钥匙串）");
    addAccount({ ...draft, id: String(Date.now()) });
    // Intentionally do not persist password in the account model yet.
    void password;
    onAdded?.();
  }

  async function testConnection() {
    setErr(null);
    setOk(null);
    setTesting(true);
    await new Promise((r) => setTimeout(r, 300));
    setTesting(false);
    const draft = buildDraft();
    const errs = validateAccount(draft);
    if (!password.trim()) errs.push("请填写密码或授权码");
    if (errs.length) {
      setErr(errs.join("；"));
      return;
    }
    setOk(`连接检查通过（本地模拟）· ${draft.imapHost}:${draft.imapPort} / ${draft.smtpHost}:${draft.smtpPort}`);
  }

  return (
    <Box data-testid="add-account" sx={{ maxWidth: 560, width: "100%", p: 1 }}>
      <Stack spacing={2}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          {onClose && (
            <Button startIcon={<ArrowBackIcon />} onClick={onClose}>
              返回
            </Button>
          )}
          <Typography variant="h6">添加邮箱</Typography>
        </Stack>

        <Typography variant="body2" color="text.secondary">
          选择常用邮箱可自动填入 IMAP / SMTP；密码或授权码将存入系统钥匙串（后续接入），不会明文写入数据库。
        </Typography>

        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
            邮箱服务商
          </Typography>
          <Box
            data-testid="provider-picker"
            sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}
            role="listbox"
            aria-label="邮箱服务商"
          >
            {MAIL_PROVIDERS.map((p) => (
              <Chip
                key={p.id}
                label={p.label}
                clickable
                color={providerId === p.id ? "primary" : "default"}
                variant={providerId === p.id ? "filled" : "outlined"}
                onClick={() => selectProvider(p.id)}
                role="option"
                aria-selected={providerId === p.id}
              />
            ))}
            <Chip
              label="自定义"
              clickable
              color={providerId === CUSTOM_PROVIDER_ID ? "primary" : "default"}
              variant={providerId === CUSTOM_PROVIDER_ID ? "filled" : "outlined"}
              onClick={() => selectProvider(CUSTOM_PROVIDER_ID)}
              role="option"
              aria-selected={providerId === CUSTOM_PROVIDER_ID}
            />
          </Box>
        </Box>

        <TextField
          label="邮箱地址"
          placeholder="you@qq.com"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          fullWidth
          autoComplete="username"
          slotProps={{ htmlInput: { "data-testid": "email-input" } }}
        />
        <TextField
          label="密码 / 授权码"
          placeholder="授权码（推荐）或登录密码"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          fullWidth
          autoComplete="current-password"
          helperText={provider?.authHint}
        />
        <TextField
          label="显示名称（可选）"
          placeholder="显示名称"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          fullWidth
        />

        {provider && (
          <Alert severity="info" variant="outlined" sx={{ py: 0.5 }}>
            已选用 <strong>{provider.name}</strong>：IMAP{" "}
            <code>
              {imapHost}:{imapPort}
            </code>
            （{imapTls.toUpperCase()}）· SMTP{" "}
            <code>
              {smtpHost}:{smtpPort}
            </code>
            （{smtpTls.toUpperCase()}）
          </Alert>
        )}

        <Button
          size="small"
          color="inherit"
          endIcon={advanced ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          onClick={() => setAdvanced((v) => !v)}
          sx={{ alignSelf: "flex-start" }}
        >
          {advanced ? "收起服务器设置" : "服务器与端口"}
        </Button>

        <Collapse in={advanced}>
          <Stack spacing={2} sx={{ pt: 0.5 }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <TextField
                label="IMAP 服务器"
                value={imapHost}
                onChange={(e) => {
                  setManualServers(true);
                  setImapHost(e.target.value);
                }}
                fullWidth
              />
              <TextField
                label="IMAP 端口"
                type="number"
                value={imapPort}
                onChange={(e) => {
                  setManualServers(true);
                  setImapPort(Number(e.target.value));
                }}
                sx={{ width: { sm: 120 }, flexShrink: 0 }}
              />
              <FormControl sx={{ minWidth: 140 }}>
                <InputLabel id="imap-tls-label">IMAP 加密</InputLabel>
                <Select
                  labelId="imap-tls-label"
                  label="IMAP 加密"
                  value={imapTls}
                  onChange={(e) => {
                    setManualServers(true);
                    setImapTls(e.target.value as TlsMode);
                  }}
                >
                  {TLS_OPTIONS.map((o) => (
                    <MenuItem key={o.value} value={o.value}>
                      {o.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <TextField
                label="SMTP 服务器"
                value={smtpHost}
                onChange={(e) => {
                  setManualServers(true);
                  setSmtpHost(e.target.value);
                }}
                fullWidth
              />
              <TextField
                label="SMTP 端口"
                type="number"
                value={smtpPort}
                onChange={(e) => {
                  setManualServers(true);
                  setSmtpPort(Number(e.target.value));
                }}
                sx={{ width: { sm: 120 }, flexShrink: 0 }}
              />
              <FormControl sx={{ minWidth: 140 }}>
                <InputLabel id="smtp-tls-label">SMTP 加密</InputLabel>
                <Select
                  labelId="smtp-tls-label"
                  label="SMTP 加密"
                  value={smtpTls}
                  onChange={(e) => {
                    setManualServers(true);
                    setSmtpTls(e.target.value as TlsMode);
                  }}
                >
                  {TLS_OPTIONS.map((o) => (
                    <MenuItem key={o.value} value={o.value}>
                      {o.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
          </Stack>
        </Collapse>

        {err && <Alert severity="error">{err}</Alert>}
        {ok && <Alert severity="success">{ok}</Alert>}
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" onClick={testConnection} disabled={testing}>
            {testing ? "测试中…" : "测试连接"}
          </Button>
          <Button variant="contained" onClick={submit}>
            添加
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
