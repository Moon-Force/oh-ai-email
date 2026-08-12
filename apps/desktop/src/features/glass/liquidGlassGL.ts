/**
 * Local WebGL liquid-glass pass (not full-window).
 * Rounded-rect SDF + noise ripple + chromatic sample of env texture + mouse specular.
 * Fail-soft: returns null if WebGL unavailable.
 */

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const FRAG = `
precision mediump float;
varying vec2 vUv;
uniform vec2 uRes;
uniform vec2 uMouse;
uniform float uTime;
uniform float uIntensity;
uniform float uRadius;
uniform sampler2D uEnv;
uniform vec3 uTint;

float sdRoundBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
}

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

void main() {
  vec2 uv = vUv;
  vec2 p = (uv - 0.5) * 2.0;
  // aspect-correct-ish for SDF
  float aspect = uRes.x / max(uRes.y, 1.0);
  vec2 pa = vec2(p.x * aspect, p.y);

  float rad = clamp(uRadius, 0.05, 0.45);
  float d = sdRoundBox(pa, vec2(aspect, 1.0) * 0.92, rad * aspect);

  // soft glass mask
  float mask = 1.0 - smoothstep(-0.02, 0.04, d);
  if (mask < 0.01) discard;

  // edge strength for thick-lens look
  float edge = 1.0 - smoothstep(0.0, 0.18, abs(d));
  edge = pow(edge, 1.4);

  // liquid ripple
  float t = uTime * 0.35;
  float n = noise(uv * 6.0 + vec2(t, -t * 0.7));
  float n2 = noise(uv * 14.0 - vec2(t * 0.5, t));
  vec2 ripple = vec2(n - 0.5, n2 - 0.5) * 0.04 * uIntensity;

  // edge lens push (radial-ish)
  vec2 fromC = uv - 0.5;
  vec2 lens = fromC * edge * 0.08 * uIntensity;

  // mouse parallax
  vec2 m = (uMouse - 0.5) * 0.05 * uIntensity;

  vec2 baseOff = ripple + lens + m;

  // chromatic aberration
  float ch = (0.004 + edge * 0.01) * uIntensity;
  vec2 dir = normalize(fromC + 1e-5);
  float r = texture2D(uEnv, clamp(uv + baseOff + dir * ch, 0.0, 1.0)).r;
  float g = texture2D(uEnv, clamp(uv + baseOff, 0.0, 1.0)).g;
  float b = texture2D(uEnv, clamp(uv + baseOff - dir * ch, 0.0, 1.0)).b;
  vec3 col = vec3(r, g, b);

  // frosted wash + tint
  col = mix(col, uTint, 0.22 + edge * 0.12);
  col += edge * 0.12;

  // specular
  vec2 h = normalize(uMouse - uv + 0.001);
  float spec = pow(max(dot(normalize(vec2(edge, 1.0)), h * 0.5 + 0.5), 0.0), 24.0);
  col += vec3(spec) * (0.35 + 0.4 * uIntensity);

  float alpha = mask * (0.42 + edge * 0.25 + 0.1 * uIntensity);
  gl_FragColor = vec4(col, alpha);
}
`;

export type LiquidGlassGL = {
  canvas: HTMLCanvasElement;
  resize: (w: number, h: number, dpr?: number) => void;
  setMouse: (nx: number, ny: number) => void;
  setIntensity: (v: number) => void;
  setRadius: (v: number) => void;
  setTint: (r: number, g: number, b: number) => void;
  paintEnv: (theme: "light" | "dark") => void;
  frame: (timeSec: number) => void;
  destroy: () => void;
};

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

/** Build env texture approximating Mist Canvas / Night Pool blobs. */
function paintEnvTexture(gl: WebGLRenderingContext, tex: WebGLTexture, theme: "light" | "dark") {
  const size = 64;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  if (!ctx) return;

  if (theme === "dark") {
    ctx.fillStyle = "#070a10";
    ctx.fillRect(0, 0, size, size);
    const g1 = ctx.createRadialGradient(8, 6, 0, 8, 6, 40);
    g1.addColorStop(0, "rgba(91,140,255,0.45)");
    g1.addColorStop(1, "transparent");
    ctx.fillStyle = g1;
    ctx.fillRect(0, 0, size, size);
    const g2 = ctx.createRadialGradient(56, 50, 0, 56, 50, 36);
    g2.addColorStop(0, "rgba(255,122,106,0.28)");
    g2.addColorStop(1, "transparent");
    ctx.fillStyle = g2;
    ctx.fillRect(0, 0, size, size);
    const g3 = ctx.createRadialGradient(48, 10, 0, 48, 10, 30);
    g3.addColorStop(0, "rgba(167,139,250,0.3)");
    g3.addColorStop(1, "transparent");
    ctx.fillStyle = g3;
    ctx.fillRect(0, 0, size, size);
  } else {
    ctx.fillStyle = "#d8e0ee";
    ctx.fillRect(0, 0, size, size);
    const g1 = ctx.createRadialGradient(6, 4, 0, 6, 4, 42);
    g1.addColorStop(0, "rgba(47,107,255,0.4)");
    g1.addColorStop(1, "transparent");
    ctx.fillStyle = g1;
    ctx.fillRect(0, 0, size, size);
    const g2 = ctx.createRadialGradient(58, 52, 0, 58, 52, 38);
    g2.addColorStop(0, "rgba(232,93,76,0.28)");
    g2.addColorStop(1, "transparent");
    ctx.fillStyle = g2;
    ctx.fillRect(0, 0, size, size);
    const g3 = ctx.createRadialGradient(50, 8, 0, 50, 8, 32);
    g3.addColorStop(0, "rgba(167,139,250,0.32)");
    g3.addColorStop(1, "transparent");
    ctx.fillStyle = g3;
    ctx.fillRect(0, 0, size, size);
    const g4 = ctx.createRadialGradient(28, 48, 0, 28, 48, 28);
    g4.addColorStop(0, "rgba(56,189,248,0.25)");
    g4.addColorStop(1, "transparent");
    ctx.fillStyle = g4;
    ctx.fillRect(0, 0, size, size);
  }

  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
}

export function createLiquidGlassGL(canvas: HTMLCanvasElement): LiquidGlassGL | null {
  const gl = canvas.getContext("webgl", {
    alpha: true,
    antialias: false,
    premultipliedAlpha: true,
    preserveDrawingBuffer: false,
  });
  if (!gl) return null;

  const vs = compile(gl, gl.VERTEX_SHADER, VERT);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return null;

  const prog = gl.createProgram();
  if (!prog) return null;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    gl.deleteProgram(prog);
    return null;
  }

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

  const aPos = gl.getAttribLocation(prog, "aPos");
  const uRes = gl.getUniformLocation(prog, "uRes");
  const uMouse = gl.getUniformLocation(prog, "uMouse");
  const uTime = gl.getUniformLocation(prog, "uTime");
  const uIntensity = gl.getUniformLocation(prog, "uIntensity");
  const uRadius = gl.getUniformLocation(prog, "uRadius");
  const uEnv = gl.getUniformLocation(prog, "uEnv");
  const uTint = gl.getUniformLocation(prog, "uTint");

  const tex = gl.createTexture();
  if (!tex) return null;
  paintEnvTexture(gl, tex, "light");

  let mouseX = 0.35;
  let mouseY = 0.25;
  let intensity = 1;
  let radius = 0.22;
  let tint = [0.92, 0.95, 1.0] as [number, number, number];
  let cssW = 1;
  let cssH = 1;

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  return {
    canvas,
    resize(w, h, dpr = Math.min(window.devicePixelRatio || 1, 2)) {
      cssW = Math.max(1, w);
      cssH = Math.max(1, h);
      const pw = Math.floor(cssW * dpr);
      const ph = Math.floor(cssH * dpr);
      if (canvas.width !== pw || canvas.height !== ph) {
        canvas.width = pw;
        canvas.height = ph;
      }
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      gl.viewport(0, 0, pw, ph);
    },
    setMouse(nx, ny) {
      mouseX = nx;
      mouseY = ny;
    },
    setIntensity(v) {
      intensity = Math.max(0, Math.min(2, v));
    },
    setRadius(v) {
      radius = v;
    },
    setTint(r, g, b) {
      tint = [r, g, b];
    },
    paintEnv(theme) {
      paintEnvTexture(gl, tex, theme);
      if (theme === "dark") tint = [0.14, 0.18, 0.26];
      else tint = [0.92, 0.95, 1.0];
    },
    frame(timeSec) {
      gl.useProgram(prog);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
      gl.uniform2f(uRes, cssW, cssH);
      gl.uniform2f(uMouse, mouseX, mouseY);
      gl.uniform1f(uTime, timeSec);
      gl.uniform1f(uIntensity, intensity);
      gl.uniform1f(uRadius, radius);
      gl.uniform3f(uTint, tint[0], tint[1], tint[2]);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform1i(uEnv, 0);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
    destroy() {
      gl.deleteTexture(tex);
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      const ext = gl.getExtension("WEBGL_lose_context");
      ext?.loseContext();
    },
  };
}

/** Pure helpers for tests (no DOM/WebGL). */
export function clampIntensity(v: number): number {
  return Math.max(0, Math.min(2, v));
}

export function shouldRunWebGLFrame(opts: {
  enabled: boolean;
  visible: boolean;
  reducedMotion: boolean;
  reducedTransparency: boolean;
}): boolean {
  return opts.enabled && opts.visible && !opts.reducedMotion && !opts.reducedTransparency;
}
