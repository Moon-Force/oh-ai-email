import { describe, expect, it } from "vitest";
import { clampIntensity, shouldRunWebGLFrame } from "./liquidGlassGL";

describe("clampIntensity", () => {
  it("clamps to 0..2", () => {
    expect(clampIntensity(-1)).toBe(0);
    expect(clampIntensity(0.5)).toBe(0.5);
    expect(clampIntensity(9)).toBe(2);
  });
});

describe("shouldRunWebGLFrame", () => {
  it("runs only when enabled, visible, and a11y ok", () => {
    expect(
      shouldRunWebGLFrame({
        enabled: true,
        visible: true,
        reducedMotion: false,
        reducedTransparency: false,
      })
    ).toBe(true);
    expect(
      shouldRunWebGLFrame({
        enabled: false,
        visible: true,
        reducedMotion: false,
        reducedTransparency: false,
      })
    ).toBe(false);
    expect(
      shouldRunWebGLFrame({
        enabled: true,
        visible: false,
        reducedMotion: false,
        reducedTransparency: false,
      })
    ).toBe(false);
    expect(
      shouldRunWebGLFrame({
        enabled: true,
        visible: true,
        reducedMotion: true,
        reducedTransparency: false,
      })
    ).toBe(false);
    expect(
      shouldRunWebGLFrame({
        enabled: true,
        visible: true,
        reducedMotion: false,
        reducedTransparency: true,
      })
    ).toBe(false);
  });
});
