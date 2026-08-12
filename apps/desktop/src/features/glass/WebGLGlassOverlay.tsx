import { useEffect, useRef } from "react";
import { createLiquidGlassGL, type LiquidGlassGL } from "./liquidGlassGL";
import { useGlassSettings } from "./glassSettingsStore";

type Props = {
  /**
   * chip — nav/directory row (hover lens only; parent must be the item)
   * capsule — small control, not full-pane background
   */
  variant?: "chip" | "capsule";
  className?: string;
  /** If false, do not render even when global webglGlass is on */
  active?: boolean;
};

/**
 * WebGL liquid lens clipped to a single control — NOT full sidebar/background.
 * Mount only while the control is hovered (chip) or when the control itself is visible.
 */
export default function WebGLGlassOverlay({
  variant = "chip",
  className = "",
  active = true,
}: Props) {
  const enabled = useGlassSettings((s) => s.webglGlass);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<LiquidGlassGL | null>(null);
  const rafRef = useRef(0);

  const live = enabled && active;

  useEffect(() => {
    if (!live) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      glRef.current?.destroy();
      glRef.current = null;
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const reducedTransparency = window.matchMedia("(prefers-reduced-transparency: reduce)").matches;
    if (reducedMotion || reducedTransparency) return;

    const gl = createLiquidGlassGL(canvas);
    if (!gl) return;
    glRef.current = gl;
    // Chip: gentle lens on the row only; capsule: slightly stronger
    gl.setIntensity(variant === "capsule" ? 0.95 : 0.75);
    gl.setRadius(variant === "capsule" ? 0.42 : 0.28);
    const theme =
      (document.documentElement.getAttribute("data-theme") as "light" | "dark") || "light";
    gl.paintEnv(theme);

    const parent = canvas.parentElement;
    const ro = new ResizeObserver(() => {
      if (!parent) return;
      const r = parent.getBoundingClientRect();
      gl.resize(r.width, r.height);
    });
    if (parent) {
      ro.observe(parent);
      const r = parent.getBoundingClientRect();
      gl.resize(r.width, r.height);
    }

    const onMove = (e: PointerEvent) => {
      if (!parent) return;
      const r = parent.getBoundingClientRect();
      if (!r.width || !r.height) return;
      gl.setMouse((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
    };
    parent?.addEventListener("pointermove", onMove);

    const obs = new MutationObserver(() => {
      const t =
        (document.documentElement.getAttribute("data-theme") as "light" | "dark") || "light";
      gl.paintEnv(t);
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    let running = true;
    const loop = (ts: number) => {
      if (!running) return;
      if (document.visibilityState === "visible") {
        gl.frame(ts * 0.001);
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
      parent?.removeEventListener("pointermove", onMove);
      ro.disconnect();
      obs.disconnect();
      gl.destroy();
      glRef.current = null;
    };
  }, [live, variant]);

  if (!live) return null;

  return (
    <canvas
      ref={canvasRef}
      className={`webgl-glass-overlay webgl-glass-chip ${className}`}
      data-testid="webgl-glass-overlay"
      aria-hidden
    />
  );
}
