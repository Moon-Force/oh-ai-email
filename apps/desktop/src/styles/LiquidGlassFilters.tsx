/**
 * Chromium Liquid Glass refraction simulation (not Apple Metal shaders).
 *
 * 1) Edge lens map — radial displacement stronger at rim (thick-glass look)
 * 2) Micro ripple  — soft turbulence for “liquid” grain
 * 3) Chromatic aberration — R/G/B displaced at slightly different scales
 *
 * Applied via: backdrop-filter: blur(...) url(#lg-refract-*)
 * Electron/Chrome only; falls back to blur when unsupported.
 *
 * Refs: kube.io/blog/liquid-glass-css-svg · LogRocket liquid glass CSS+SVG
 */

/** Radial lens map: mid-gray (#808080) = no shift; rim shifts for edge lensing. */
const LENS_MAP_URI =
  "data:image/svg+xml," +
  encodeURIComponent(
    `
<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <defs>
    <radialGradient id="lens" cx="50%" cy="42%" r="62%">
      <stop offset="0%" stop-color="#808080"/>
      <stop offset="48%" stop-color="#808080"/>
      <stop offset="72%" stop-color="#9a8888"/>
      <stop offset="88%" stop-color="#b8a0a8"/>
      <stop offset="100%" stop-color="#d0b8c0"/>
    </radialGradient>
    <radialGradient id="lensY" cx="48%" cy="50%" r="64%">
      <stop offset="0%" stop-color="#808080"/>
      <stop offset="50%" stop-color="#808080"/>
      <stop offset="78%" stop-color="#889888"/>
      <stop offset="100%" stop-color="#a0c0a8"/>
    </radialGradient>
  </defs>
  <rect width="256" height="256" fill="url(#lens)"/>
  <rect width="256" height="256" fill="url(#lensY)" style="mix-blend-mode:screen;opacity:0.55"/>
</svg>
`.trim()
  );

type RefractProps = {
  id: string;
  /** feTurbulence baseFrequency */
  noiseFreq: string;
  noiseBlur: number;
  /** Chromatic scales: R slightly higher, B higher = prism edge */
  rScale: number;
  gScale: number;
  bScale: number;
  /** Filter region pad percent number e.g. 10 → ±-10% … width 120% */
  padPct: number;
};

function RefractFilter({ id, noiseFreq, noiseBlur, rScale, gScale, bScale, padPct }: RefractProps) {
  const outer = 100 + padPct * 2;
  return (
    <filter
      id={id}
      x={`-${padPct}%`}
      y={`-${padPct}%`}
      width={`${outer}%`}
      height={`${outer}%`}
      colorInterpolationFilters="sRGB"
      filterUnits="objectBoundingBox"
    >
      {/* 1. Edge lens map (thick glass rim) */}
      <feImage
        href={LENS_MAP_URI}
        x="0"
        y="0"
        width="100%"
        height="100%"
        preserveAspectRatio="none"
        result="lensMap"
      />
      <feGaussianBlur in="lensMap" stdDeviation="1.5" result="lensSoft" />

      {/* 2. Micro liquid ripple */}
      <feTurbulence
        type="fractalNoise"
        baseFrequency={noiseFreq}
        numOctaves="2"
        seed="7"
        result="noise"
      />
      <feGaussianBlur in="noise" stdDeviation={noiseBlur} result="ripple" />

      {/* Edge-heavy map + body grain */}
      <feBlend in="lensSoft" in2="ripple" mode="screen" result="dispMap" />

      {/* 3. Chromatic aberration — separate R/G/B warps */}
      <feDisplacementMap
        in="SourceGraphic"
        in2="dispMap"
        scale={gScale}
        xChannelSelector="R"
        yChannelSelector="G"
        result="dispG"
      />
      <feDisplacementMap
        in="SourceGraphic"
        in2="dispMap"
        scale={rScale}
        xChannelSelector="R"
        yChannelSelector="G"
        result="dispR"
      />
      <feDisplacementMap
        in="SourceGraphic"
        in2="dispMap"
        scale={bScale}
        xChannelSelector="R"
        yChannelSelector="B"
        result="dispB"
      />

      <feColorMatrix
        in="dispR"
        type="matrix"
        values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"
        result="rChan"
      />
      <feColorMatrix
        in="dispG"
        type="matrix"
        values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0"
        result="gChan"
      />
      <feColorMatrix
        in="dispB"
        type="matrix"
        values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0"
        result="bChan"
      />

      <feComposite
        in="rChan"
        in2="gChan"
        operator="arithmetic"
        k1="0"
        k2="1"
        k3="1"
        k4="0"
        result="rg"
      />
      <feComposite
        in="rg"
        in2="bChan"
        operator="arithmetic"
        k1="0"
        k2="1"
        k3="1"
        k4="0"
        result="rgb"
      />

      <feColorMatrix
        in="rgb"
        type="matrix"
        values="1.03 0 0 0 0.01  0 1.02 0 0 0.01  0 0 1.05 0 0.02  0 0 0 1 0"
      />
    </filter>
  );
}

export default function LiquidGlassFilters() {
  return (
    <svg
      aria-hidden
      width="0"
      height="0"
      style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
    >
      <defs>
        {/* Sidebar / search — keep text chrome legible */}
        <RefractFilter
          id="lg-refract-soft"
          noiseFreq="0.01 0.016"
          noiseBlur={1.1}
          rScale={16}
          gScale={12}
          bScale={18}
          padPct={10}
        />

        {/* Lumen capsule / stronger floating glass */}
        <RefractFilter
          id="lg-refract-strong"
          noiseFreq="0.007 0.012"
          noiseBlur={1.8}
          rScale={26}
          gScale={20}
          bScale={30}
          padPct={14}
        />

        <filter
          id="lg-specular"
          x="-20%"
          y="-20%"
          width="140%"
          height="140%"
          colorInterpolationFilters="sRGB"
        >
          <feGaussianBlur in="SourceAlpha" stdDeviation="2" result="blur" />
          <feSpecularLighting
            in="blur"
            surfaceScale="3"
            specularConstant="0.9"
            specularExponent="18"
            lightingColor="white"
            result="spec"
          >
            <fePointLight x="40" y="20" z="40" />
          </feSpecularLighting>
          <feComposite in="spec" in2="SourceAlpha" operator="in" result="specOut" />
          <feComposite
            in="SourceGraphic"
            in2="specOut"
            operator="arithmetic"
            k1="0"
            k2="1"
            k3="0.65"
            k4="0"
          />
        </filter>
      </defs>
    </svg>
  );
}
