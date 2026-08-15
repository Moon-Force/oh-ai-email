import { useEffect, useRef, useState } from "react";
import {
  AppBar,
  Box,
  Button,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Toolbar,
  Typography,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";
import MessageList from "./features/mail/MessageList";
import Reader from "./features/mail/Reader";
import Sidebar from "./features/shell/Sidebar";
import ConnectionBanner from "./features/shell/ConnectionBanner";
import Composer from "./features/composer/Composer";
import Settings from "./features/settings/Settings";
import AddAccount from "./features/accounts/AddAccount";
import PaneTransition from "./features/shell/PaneTransition";
import AppToast from "./features/shell/AppToast";
import ErrorBoundary from "./features/shell/ErrorBoundary";
import { useMailStore } from "./features/mail/store";
import { useAccountsStore } from "./features/accounts/store";
import { useAiSettings } from "./features/ai/settingsStore";
import { usePrefsStore } from "./features/settings/prefsStore";
import AppThemeProvider from "./theme/AppThemeProvider";
import SyncIcon from "@mui/icons-material/Sync";

export default function App() {
  const [mode, setMode] = useState<"light" | "dark">("light");
  const {
    view,
    setView,
    composeOpen,
    setComposeOpen,
    searchQuery,
    setSearchQuery,
    connectionError,
    setConnectionError,
    activeFolderId,
    split,
    hydrate,
    syncNow,
    syncing,
  } = useMailStore();
  const accounts = useAccountsStore((s) => s.accounts);
  const activeAccountId = useAccountsStore((s) => s.activeAccountId);
  const hydrateAi = useAiSettings((s) => s.hydrate);
  const hydratePrefs = usePrefsStore((s) => s.hydrate);
  const syncIntervalMin = usePrefsStore((s) => s.syncIntervalMin);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", mode);
  }, [mode]);

  useEffect(() => {
    void hydrate();
    void hydrateAi();
    void hydratePrefs();
  }, [hydrate, hydrateAi, hydratePrefs]);

  const syncingRef = useRef(syncing);
  syncingRef.current = syncing;

  useEffect(() => {
    if (syncIntervalMin <= 0) return;
    if (accounts.length === 0) return;
    const ms = syncIntervalMin * 60_000;
    const tick = () => {
      if (syncingRef.current) return;
      if (useAccountsStore.getState().accounts.length === 0) return;
      void syncNow(useAccountsStore.getState().activeAccountId ?? undefined);
    };
    const id = window.setInterval(tick, ms);
    return () => window.clearInterval(id);
  }, [syncIntervalMin, accounts.length, syncNow]);

  const folderTitle =
    activeFolderId === "inbox"
      ? "收件箱"
      : activeFolderId === "sent"
        ? "已发送"
        : activeFolderId === "drafts"
          ? "草稿"
          : activeFolderId === "archive"
            ? "归档"
            : "垃圾箱";

  /** Top-level surface: settings / account / compose / mail */
  const surfaceKey = composeOpen ? "compose" : view;
  /** List pane changes when folder or split changes */
  const listKey = `${activeFolderId}:${split}`;

  return (
    <AppThemeProvider mode={mode}>
      <Box
        data-testid="app-shell"
        sx={{
          height: "100%",
          display: "flex",
          bgcolor: "background.default",
          overflow: "hidden",
        }}
      >
        <AppToast />
        <Sidebar />

        <Box sx={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0 }}>
          <AppBar
            position="static"
            color="default"
            elevation={0}
            data-testid="topbar"
            sx={{ borderBottom: 1, borderColor: "divider" }}
          >
            <Toolbar variant="dense" sx={{ gap: 1.5 }}>
              <Typography
                key={folderTitle}
                variant="subtitle1"
                className="pane-title-swap"
                sx={{ minWidth: 64 }}
              >
                {folderTitle}
              </Typography>
              <TextField
                size="small"
                placeholder="搜索邮件…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                sx={{ flex: 1, maxWidth: 480 }}
                slotProps={{
                  htmlInput: { "aria-label": "搜索邮件" },
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon fontSize="small" />
                      </InputAdornment>
                    ),
                    endAdornment: searchQuery ? (
                      <InputAdornment position="end">
                        <IconButton
                          size="small"
                          aria-label="清除搜索"
                          onClick={() => setSearchQuery("")}
                        >
                          <ClearIcon fontSize="small" />
                        </IconButton>
                      </InputAdornment>
                    ) : undefined,
                  },
                }}
              />
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <IconButton
                  aria-label="同步邮件"
                  disabled={syncing || accounts.length === 0}
                  onClick={() => void syncNow(activeAccountId ?? undefined)}
                >
                  <SyncIcon
                    sx={
                      syncing
                        ? { animation: "spin 1s linear infinite", "@keyframes spin": { to: { transform: "rotate(360deg)" } } }
                        : undefined
                    }
                  />
                </IconButton>
                <Button
                  variant="contained"
                  startIcon={<EditIcon />}
                  onClick={() => setComposeOpen(true)}
                >
                  写新邮件
                </Button>
                <IconButton
                  aria-label={mode === "light" ? "切换深色" : "切换浅色"}
                  onClick={() => setMode(mode === "light" ? "dark" : "light")}
                >
                  {mode === "light" ? <DarkModeIcon /> : <LightModeIcon />}
                </IconButton>
              </Stack>
            </Toolbar>
          </AppBar>

          {connectionError && (
            <Box sx={{ px: 2, pt: 1 }}>
              <ConnectionBanner
                message={connectionError}
                onRetry={() => setConnectionError(null)}
                onOpenAccount={() => {
                  setConnectionError(null);
                  setView("add-account");
                }}
                onDismiss={() => setConnectionError(null)}
              />
            </Box>
          )}

          <Box sx={{ flex: 1, minHeight: 0, p: 1.5 }}>
            <Paper
              sx={{
                height: "100%",
                overflow: "hidden",
                border: 1,
                borderColor: "divider",
                borderRadius: 2,
              }}
            >
              <ErrorBoundary
                fallbackTitle="主内容区出错"
                onReset={() => {
                  setComposeOpen(false);
                  setView("mail");
                }}
              >
                {/* Compose uses transform enter animation; TipTap mounts after the motion ends (see Composer). */}
                {composeOpen ? (
                  <ErrorBoundary
                    fallbackTitle="写信界面出错"
                    onReset={() => setComposeOpen(false)}
                  >
                    <PaneTransition paneKey="compose" variant="compose">
                      <Composer
                        onClose={() => setComposeOpen(false)}
                        onSend={() => setComposeOpen(false)}
                      />
                    </PaneTransition>
                  </ErrorBoundary>
                ) : (
                  <PaneTransition paneKey={surfaceKey} variant="fade-up">
                    {view === "settings" ? (
                      <Settings theme={mode} onThemeChange={setMode} onClose={() => setView("mail")} />
                    ) : view === "add-account" ? (
                      <Box
                        sx={{
                          height: "100%",
                          overflow: "auto",
                          display: "flex",
                          justifyContent: "center",
                          p: 3,
                        }}
                      >
                        <AddAccount onClose={() => setView("mail")} onAdded={() => setView("mail")} />
                      </Box>
                    ) : (
                      <Box sx={{ display: "flex", height: "100%", minHeight: 0 }}>
                        <Box
                          className="list-pane"
                          sx={{
                            width: { xs: "42%", md: 360 },
                            flexShrink: 0,
                            borderRight: 1,
                            borderColor: "divider",
                            minHeight: 0,
                            overflow: "hidden",
                          }}
                          aria-label="邮件列表"
                        >
                          <PaneTransition paneKey={listKey} variant="fade-soft">
                            <MessageList />
                          </PaneTransition>
                        </Box>
                        <Box
                          className="reader-pane"
                          sx={{ flex: 1, minWidth: 0, minHeight: 0, overflow: "hidden" }}
                          aria-label="读信"
                        >
                          <Reader />
                        </Box>
                      </Box>
                    )}
                  </PaneTransition>
                )}
              </ErrorBoundary>
            </Paper>
          </Box>
        </Box>
      </Box>
    </AppThemeProvider>
  );
}
