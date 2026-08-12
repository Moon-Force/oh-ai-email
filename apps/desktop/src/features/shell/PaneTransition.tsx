import type { ReactNode, CSSProperties } from "react";
import { Box } from "@mui/material";

export type PaneMotion = "fade-up" | "fade-soft" | "fade" | "reader";

type Props = {
  /** Changing this remounts children and replays the enter animation. */
  paneKey: string;
  children: ReactNode;
  variant?: PaneMotion;
  className?: string;
  sx?: object;
  style?: CSSProperties;
  "data-testid"?: string;
};

const VARIANT_CLASS: Record<PaneMotion, string> = {
  "fade-up": "pane-enter-up",
  "fade-soft": "pane-enter-soft",
  fade: "pane-enter-fade",
  reader: "pane-enter-reader",
};

/**
 * Remount-on-key enter animation for directory / view switches.
 * Respects prefers-reduced-motion via CSS.
 */
export default function PaneTransition({
  paneKey,
  children,
  variant = "fade-up",
  className,
  sx,
  style,
  "data-testid": testId,
}: Props) {
  return (
    <Box
      key={paneKey}
      data-testid={testId}
      className={[VARIANT_CLASS[variant], className].filter(Boolean).join(" ")}
      style={style}
      sx={{
        height: "100%",
        minHeight: 0,
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}
