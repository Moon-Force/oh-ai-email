import { useMemo, type ReactNode } from "react";
import { CssBaseline, ThemeProvider } from "@mui/material";
import { createAppTheme } from "./createAppTheme";

type Props = {
  mode: "light" | "dark";
  children: ReactNode;
};

export default function AppThemeProvider({ mode, children }: Props) {
  const theme = useMemo(() => createAppTheme(mode), [mode]);
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
