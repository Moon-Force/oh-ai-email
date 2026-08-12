import { Alert, Snackbar } from "@mui/material";
import { useToastStore } from "./toastStore";

/** Global toast host — survives composer close so send success is visible. */
export default function AppToast() {
  const toast = useToastStore((s) => s.toast);
  const clearToast = useToastStore((s) => s.clearToast);

  return (
    <Snackbar
      open={Boolean(toast)}
      autoHideDuration={toast?.duration ?? 4500}
      onClose={(_, reason) => {
        if (reason === "clickaway") return;
        clearToast();
      }}
      anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      key={toast?.id}
    >
      <Alert
        data-testid="app-toast"
        onClose={() => clearToast()}
        severity={toast?.severity ?? "info"}
        variant="filled"
        elevation={6}
        sx={{ width: "100%", maxWidth: 520, alignItems: "center" }}
      >
        {toast?.message}
      </Alert>
    </Snackbar>
  );
}
