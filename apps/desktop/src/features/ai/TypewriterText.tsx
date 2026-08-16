import { useEffect, useState } from "react";
import { Typography, type TypographyProps } from "@mui/material";

interface TypewriterTextProps extends TypographyProps {
  text: string;
  speedMs?: number;
  onDone?: () => void;
}

export function TypewriterText({
  text,
  speedMs = 12,
  onDone,
  ...typographyProps
}: TypewriterTextProps) {
  const [displayedText, setDisplayedText] = useState("");
  const [isTyping, setIsTyping] = useState(true);

  useEffect(() => {
    // Check for test environment or reduced motion preference
    const isTestEnv =
      (typeof process !== "undefined" &&
        (process.env.NODE_ENV === "test" || Boolean(process.env.VITEST))) ||
      Boolean((import.meta as unknown as { env?: { MODE?: string } }).env?.MODE === "test");

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (isTestEnv || prefersReducedMotion || !text) {
      setDisplayedText(text);
      setIsTyping(false);
      onDone?.();
      return;
    }

    setDisplayedText("");
    setIsTyping(true);

    let currentIndex = 0;
    const stepSize = Math.max(1, Math.floor(text.length / 80)); // scale chunk size for long text

    const timer = setInterval(() => {
      currentIndex = Math.min(currentIndex + stepSize, text.length);
      setDisplayedText(text.slice(0, currentIndex));

      if (currentIndex >= text.length) {
        clearInterval(timer);
        setIsTyping(false);
        onDone?.();
      }
    }, speedMs);

    return () => {
      clearInterval(timer);
    };
  }, [text, speedMs, onDone]);

  return (
    <Typography {...typographyProps}>
      {displayedText}
      {isTyping && (
        <span
          style={{
            display: "inline-block",
            width: "2px",
            height: "1em",
            backgroundColor: "currentColor",
            marginLeft: "2px",
            verticalAlign: "text-bottom",
            animation: "blink 0.8s infinite",
          }}
        />
      )}
    </Typography>
  );
}
