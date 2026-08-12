import { Component, type ErrorInfo, type ReactNode } from "react";
import { Alert, Box, Button, Typography } from "@mui/material";

type Props = {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
};

type State = { error: Error | null };

/** Catch render crashes (e.g. editor init) so the shell does not go fully blank. */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <Box data-testid="error-boundary" sx={{ p: 3, height: "100%", overflow: "auto" }}>
          <Alert severity="error" sx={{ mb: 2 }}>
            {this.props.fallbackTitle ?? "界面出错"}
          </Alert>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2, whiteSpace: "pre-wrap" }}>
            {this.state.error.message}
          </Typography>
          <Button
            variant="contained"
            onClick={() => {
              this.setState({ error: null });
              this.props.onReset?.();
            }}
          >
            重试
          </Button>
        </Box>
      );
    }
    return this.props.children;
  }
}
