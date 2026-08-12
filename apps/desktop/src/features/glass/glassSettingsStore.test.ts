import { beforeEach, describe, expect, it } from "vitest";
import { syncGlassDomFlags, useGlassSettings } from "./glassSettingsStore";

describe("glassSettingsStore", () => {
  beforeEach(() => {
    useGlassSettings.setState({ svgRefract: true, webglGlass: false });
    document.documentElement.removeAttribute("data-glass-refract");
    document.documentElement.removeAttribute("data-glass-webgl");
  });

  it("defaults webgl off and svg on", () => {
    expect(useGlassSettings.getState().webglGlass).toBe(false);
    expect(useGlassSettings.getState().svgRefract).toBe(true);
  });

  it("syncs DOM flags", () => {
    useGlassSettings.getState().setWebglGlass(true);
    expect(document.documentElement.getAttribute("data-glass-webgl")).toBe("on");
    useGlassSettings.getState().setSvgRefract(false);
    expect(document.documentElement.getAttribute("data-glass-refract")).toBe("off");
    syncGlassDomFlags();
    expect(document.documentElement.getAttribute("data-glass-webgl")).toBe("on");
  });
});
