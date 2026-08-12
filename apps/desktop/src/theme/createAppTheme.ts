import { createTheme, type PaletteMode } from "@mui/material/styles";

/** MUI theme for oh-ai-email — Material Design, Lumen Blue accent. */
export function createAppTheme(mode: PaletteMode) {
  const isDark = mode === "dark";
  return createTheme({
    palette: {
      mode,
      primary: {
        main: isDark ? "#5B8CFF" : "#2F6BFF",
        contrastText: "#fff",
      },
      secondary: {
        main: isDark ? "#FF7A6A" : "#E85D4C",
      },
      background: {
        default: isDark ? "#0B0F14" : "#F0F2F7",
        paper: isDark ? "#141A22" : "#FFFFFF",
      },
      divider: isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)",
      text: {
        primary: isDark ? "#F2F4F8" : "#1A1D24",
        secondary: isDark ? "#9AA3B5" : "#5C6578",
      },
    },
    shape: { borderRadius: 12 },
    typography: {
      fontFamily: [
        "Roboto",
        "Segoe UI",
        "system-ui",
        "-apple-system",
        "sans-serif",
      ].join(","),
      h6: { fontWeight: 600, letterSpacing: "-0.01em" },
      subtitle1: { fontWeight: 600 },
      body2: { fontSize: "0.875rem" },
      caption: { fontSize: "0.75rem" },
    },
    components: {
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: { textTransform: "none", borderRadius: 999, fontWeight: 500 },
        },
      },
      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: { backgroundImage: "none" },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            marginInline: 4,
            transition:
              "background-color 200ms cubic-bezier(0.22, 1, 0.36, 1), color 200ms cubic-bezier(0.22, 1, 0.36, 1)",
            "&.Mui-selected": {
              backgroundColor: isDark
                ? "rgba(91,140,255,0.16)"
                : "rgba(47,107,255,0.1)",
            },
          },
        },
      },
      MuiCssBaseline: {
        styleOverrides: {
          html: { height: "100%" },
          body: { height: "100%", margin: 0 },
          "#root": { height: "100%" },
        },
      },
    },
  });
}
