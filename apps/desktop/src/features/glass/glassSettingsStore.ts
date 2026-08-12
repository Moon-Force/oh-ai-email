import { create } from "zustand";

type GlassSettings = {
  /** SVG backdrop displacement (Chromium). Default on. */
  svgRefract: boolean;
  /** Local WebGL liquid glass overlay. Default off — higher GPU cost. */
  webglGlass: boolean;
  setSvgRefract: (v: boolean) => void;
  setWebglGlass: (v: boolean) => void;
};

function applyDomFlags(svg: boolean, webgl: boolean) {
  document.documentElement.setAttribute("data-glass-refract", svg ? "on" : "off");
  document.documentElement.setAttribute("data-glass-webgl", webgl ? "on" : "off");
}

export const useGlassSettings = create<GlassSettings>((set, get) => ({
  svgRefract: true,
  webglGlass: false,
  setSvgRefract: (svgRefract) => {
    set({ svgRefract });
    applyDomFlags(svgRefract, get().webglGlass);
  },
  setWebglGlass: (webglGlass) => {
    set({ webglGlass });
    applyDomFlags(get().svgRefract, webglGlass);
  },
}));

/** Call once on app mount to sync DOM attributes. */
export function syncGlassDomFlags() {
  const { svgRefract, webglGlass } = useGlassSettings.getState();
  applyDomFlags(svgRefract, webglGlass);
}
