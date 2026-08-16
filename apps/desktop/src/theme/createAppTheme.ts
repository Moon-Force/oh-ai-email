import { createTheme, type PaletteMode } from "@mui/material/styles";

/**
 * MUI theme for oh-ai-email
 * High-end Material Design with Obsidian Carbon Dark Mode and Lumen Blue accent.
 */
export function createAppTheme(mode: PaletteMode) {
  const isDark = mode === "dark";

  return createTheme({
    palette: {
      mode,
      primary: {
        main: isDark ? "#3B82F6" : "#2563EB",
        light: isDark ? "#60A5FA" : "#3B82F6",
        dark: isDark ? "#1D4ED8" : "#1D4ED8",
        contrastText: "#FFFFFF",
      },
      secondary: {
        main: isDark ? "#A78BFA" : "#7C3AED",
        light: isDark ? "#C4B5FD" : "#8B5CF6",
      },
      background: {
        default: isDark ? "#090B0E" : "#F4F6F9",
        paper: isDark ? "#13171F" : "#FFFFFF",
      },
      divider: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(15, 23, 42, 0.08)",
      text: {
        primary: isDark ? "#F8FAFC" : "#0F172A",
        secondary: isDark ? "#94A3B8" : "#64748B",
        disabled: isDark ? "#475569" : "#94A3B8",
      },
      action: {
        hover: isDark ? "rgba(255, 255, 255, 0.04)" : "rgba(15, 23, 42, 0.04)",
        selected: isDark ? "rgba(59, 130, 246, 0.14)" : "rgba(37, 99, 235, 0.08)",
        disabled: isDark ? "rgba(255, 255, 255, 0.2)" : "rgba(15, 23, 42, 0.26)",
      },
      error: {
        main: isDark ? "#F87171" : "#EF4444",
      },
      warning: {
        main: isDark ? "#FBBF24" : "#F59E0B",
      },
      success: {
        main: isDark ? "#34D399" : "#10B981",
      },
      info: {
        main: isDark ? "#60A5FA" : "#3B82F6",
      },
    },
    shape: { borderRadius: 12 },
    typography: {
      fontFamily: [
        "-apple-system",
        "BlinkMacSystemFont",
        '"Segoe UI"',
        "Roboto",
        '"Helvetica Neue"',
        "Arial",
        "sans-serif",
      ].join(","),
      h6: { fontWeight: 600, letterSpacing: "-0.015em" },
      subtitle1: { fontWeight: 600, letterSpacing: "-0.01em" },
      subtitle2: { fontWeight: 600 },
      body1: { fontSize: "0.925rem", lineHeight: 1.55 },
      body2: { fontSize: "0.85rem", lineHeight: 1.5 },
      caption: { fontSize: "0.75rem", letterSpacing: "0.01em" },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          html: { height: "100%" },
          body: {
            height: "100%",
            margin: 0,
            backgroundColor: isDark ? "#090B0E" : "#F4F6F9",
            color: isDark ? "#F8FAFC" : "#0F172A",
          },
          "#root": { height: "100%" },
          "::-webkit-scrollbar": {
            width: "6px",
            height: "6px",
          },
          "::-webkit-scrollbar-track": {
            background: "transparent",
          },
          "::-webkit-scrollbar-thumb": {
            background: isDark ? "rgba(255, 255, 255, 0.15)" : "rgba(0, 0, 0, 0.15)",
            borderRadius: "3px",
          },
          "::-webkit-scrollbar-thumb:hover": {
            background: isDark ? "rgba(255, 255, 255, 0.25)" : "rgba(0, 0, 0, 0.25)",
          },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            textTransform: "none",
            borderRadius: 999,
            fontWeight: 500,
            letterSpacing: "0.01em",
            transition: "all 150ms cubic-bezier(0.4, 0, 0.2, 1)",
            "&.MuiButton-containedPrimary": {
              backgroundColor: isDark ? "#3B82F6" : "#2563EB",
              "&:hover": {
                backgroundColor: isDark ? "#2563EB" : "#1D4ED8",
              },
            },
            "&.MuiButton-outlined": {
              borderColor: isDark ? "rgba(255, 255, 255, 0.15)" : "rgba(15, 23, 42, 0.15)",
              "&:hover": {
                backgroundColor: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(15, 23, 42, 0.04)",
                borderColor: isDark ? "rgba(255, 255, 255, 0.3)" : "rgba(15, 23, 42, 0.3)",
              },
            },
          },
        },
      },
      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            backgroundImage: "none",
            backgroundColor: isDark ? "#13171F" : "#FFFFFF",
          },
          outlined: {
            borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(15, 23, 42, 0.08)",
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: isDark ? "#0D1016" : "#FFFFFF",
            borderBottom: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid rgba(15, 23, 42, 0.08)",
            color: isDark ? "#F8FAFC" : "#0F172A",
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            backgroundColor: isDark ? "#181D27" : "#FFFFFF",
            borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(15, 23, 42, 0.08)",
          },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            marginInline: 4,
            transition: "all 150ms cubic-bezier(0.4, 0, 0.2, 1)",
            "&:hover": {
              backgroundColor: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(15, 23, 42, 0.04)",
            },
            "&.Mui-selected": {
              backgroundColor: isDark ? "rgba(59, 130, 246, 0.16)" : "rgba(37, 99, 235, 0.08)",
              color: isDark ? "#60A5FA" : "#2563EB",
              "&:hover": {
                backgroundColor: isDark ? "rgba(59, 130, 246, 0.22)" : "rgba(37, 99, 235, 0.12)",
              },
              "& .MuiListItemIcon-root": {
                color: isDark ? "#60A5FA" : "#2563EB",
              },
            },
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            fontWeight: 500,
            borderRadius: 6,
          },
          colorPrimary: {
            backgroundColor: isDark ? "#3B82F6" : "#2563EB",
            color: "#FFFFFF",
            "&:hover": {
              backgroundColor: isDark ? "#2563EB" : "#1D4ED8",
            },
          },
          colorSecondary: {
            backgroundColor: isDark ? "#A78BFA" : "#7C3AED",
            color: "#FFFFFF",
          },
          outlined: {
            borderColor: isDark ? "rgba(255, 255, 255, 0.15)" : "rgba(15, 23, 42, 0.15)",
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            "& .MuiOutlinedInput-root": {
              backgroundColor: isDark ? "#0A0D12" : "#FFFFFF",
              "& fieldset": {
                borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(15, 23, 42, 0.15)",
              },
              "&:hover fieldset": {
                borderColor: isDark ? "rgba(255, 255, 255, 0.2)" : "rgba(15, 23, 42, 0.3)",
              },
              "&.Mui-focused fieldset": {
                borderColor: isDark ? "#3B82F6" : "#2563EB",
              },
            },
          },
        },
      },
      MuiDivider: {
        styleOverrides: {
          root: {
            borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(15, 23, 42, 0.08)",
          },
        },
      },
    },
  });
}
