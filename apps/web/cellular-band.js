const band = document.getElementById("cellular-band");

if (band) {
  const ctx = band.getContext("2d");
  if (ctx) initCellularBand(band, ctx);
}

function hash2(i, j) {
  let h = (i | 0) * 374761393 + (j | 0) * 668265263;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function mulberry(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function initCellularBand(canvas, ctx) {
  const wrap = canvas.parentElement;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

  const ORANGE = [249, 140, 0];
  const BG = [0, 0, 0];

  let W = 0;
  let H = 0;
  let bw = 0;
  let bh = 0;
  let mask = new Uint8Array(0);
  let parts = [];
  let ambient = null;
  const mouse = { x: -1e4, y: -1e4, vx: 0, vy: 0, active: false };
  const buf = document.createElement("canvas");
  const bctx = buf.getContext("2d");
  const maskHi = document.createElement("canvas");
  const comp = document.createElement("canvas");
  const cctx = comp.getContext("2d");
  const glowSprite = makeGlow();

  function makeGlow() {
    const s = document.createElement("canvas");
    s.width = s.height = 64;
    const g = s.getContext("2d");
    const rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    rg.addColorStop(0, "rgba(255,252,245,0.9)");
    rg.addColorStop(0.4, "rgba(255,250,240,0.3)");
    rg.addColorStop(1, "rgba(255,250,240,0)");
    g.fillStyle = rg;
    g.fillRect(0, 0, 64, 64);
    return s;
  }

  function build() {
    W = wrap.clientWidth;
    H = wrap.clientHeight;
    if (!W || !H) return;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    bw = 360;
    bh = Math.max(8, Math.round((360 * H) / W));
    buf.width = bw;
    buf.height = bh;

    ambient = ctx.createRadialGradient(W / 2, H * 0.4824, 0, W / 2, H * 0.4824, Math.max(W, H) * 0.45);
    ambient.addColorStop(0, "rgba(249,140,0,0.08)");
    ambient.addColorStop(1, "rgba(249,140,0,0)");

    const m = document.createElement("canvas");
    m.width = bw;
    m.height = bh;
    const mo = m.getContext("2d", { willReadFrequently: true });
    const targetW = bw * 0.873;
    let size = bh * 0.5;
    mo.font = `900 ${size}px "Arial Black", "Noto Sans", system-ui, sans-serif`;
    const measured = mo.measureText("OH-AI-EMAIL").width;
    if (measured > 0) size = (size * targetW) / measured;
    mo.font = `900 ${size}px "Arial Black", "Noto Sans", system-ui, sans-serif`;
    mo.textAlign = "center";
    mo.textBaseline = "middle";
    mo.fillStyle = "#fff";
    mo.fillText("OH-AI-EMAIL", bw / 2, bh * 0.4824);
    const md = mo.getImageData(0, 0, bw, bh).data;
    mask = new Uint8Array(bw * bh);
    for (let i = 0; i < bw * bh; i++) mask[i] = md[i * 4 + 3] > 128 ? 1 : 0;

    maskHi.width = canvas.width;
    maskHi.height = canvas.height;
    comp.width = canvas.width;
    comp.height = canvas.height;
    const mh = maskHi.getContext("2d");
    mh.setTransform(dpr, 0, 0, dpr, 0, 0);
    mh.clearRect(0, 0, W, H);
    let hsize = H * 0.5;
    const fontFor = (s) => `900 ${s}px "Arial Black", "Noto Sans", system-ui, sans-serif`;
    mh.font = fontFor(hsize);
    const mmeas = mh.measureText("OH-AI-EMAIL").width;
    if (mmeas > 0) hsize = (hsize * (W * 0.873)) / mmeas;
    mh.font = fontFor(hsize);
    mh.textAlign = "center";
    mh.textBaseline = "middle";
    mh.fillStyle = "#fff";
    mh.fillText("OH-AI-EMAIL", W / 2, H * 0.4824);

    const rnd = mulberry(777);
    parts = [];
    const spawn = (n, big) => {
      for (let i = 0; i < n; i++) {
        const p = {
          bx: rnd(),
          by: rnd(),
          size: big ? 5 + rnd() * 9 : 1 + rnd() * 2,
          a: big ? 0.03 + rnd() * 0.045 : 0.05 + rnd() * 0.09,
          phase: rnd() * 6.2832,
          sway: big ? 0.08 + rnd() * 0.15 : 0.1 + rnd() * 0.25,
          swayAmp: big ? 3 + rnd() * 6 : 4 + rnd() * 8,
          vy: big ? 4 + rnd() * 7 : 6 + rnd() * 10,
          ag: 0,
          big,
          x: 0,
          y: 0,
          vx: 0,
          vyv: 0,
        };
        p.x = p.bx * W;
        p.y = p.by * H;
        parts.push(p);
      }
    };
    spawn(46, false);
    spawn(14, true);
  }

  const cs = 5;
  let imgData = null;
  let lastT = 0;

  canvas.addEventListener("pointermove", (e) => {
    const r = canvas.getBoundingClientRect();
    const nx = e.clientX - r.left;
    const ny = e.clientY - r.top;
    if (mouse.active) {
      mouse.vx = mouse.vx * 0.6 + (nx - mouse.x) * 0.4;
      mouse.vy = mouse.vy * 0.6 + (ny - mouse.y) * 0.4;
    }
    mouse.x = nx;
    mouse.y = ny;
    mouse.active = true;
  });
  canvas.addEventListener("pointerleave", () => {
    mouse.active = false;
    mouse.x = -1e4;
    mouse.y = -1e4;
    mouse.vx = 0;
    mouse.vy = 0;
  });

  function frame(t) {
    const time = reduced ? 0 : t / 1000;
    if (!imgData || imgData.width !== bw || imgData.height !== bh) {
      imgData = bctx.createImageData(bw, bh);
    }
    const px = imgData.data;

    const nxi = Math.ceil(bw / cs) + 2;
    const nyi = Math.ceil(bh / cs) + 2;
    const ptsx = new Float32Array(nxi * nyi);
    const pty = new Float32Array(nxi * nyi);
    const mbx = mouse.x * (bw / W);
    const mby = mouse.y * (bh / H);
    const MR = 44;
    const MR2 = MR * MR;
    for (let j = 0; j < nyi; j++) {
      for (let i = 0; i < nxi; i++) {
        const k = j * nxi + i;
        const h1 = hash2(i, j);
        const h2 = hash2(i + 31, j + 17);
        let bx = (i + 0.2 + 0.6 * h1) * cs + 0.18 * cs * Math.sin(time * 0.35 + h1 * 6.2832);
        let by = (j + 0.2 + 0.6 * h2) * cs + 0.18 * cs * Math.cos(time * 0.3 + h2 * 6.2832);
        if (mouse.active && !reduced) {
          const ddx = bx - mbx;
          const ddy = by - mby;
          const d2 = ddx * ddx + ddy * ddy;
          if (d2 < MR2) {
            const d = Math.sqrt(d2) || 1;
            const f = (1 - d / MR) * 5;
            bx += (ddx / d) * f;
            by += (ddy / d) * f;
          }
        }
        ptsx[k] = bx;
        pty[k] = by;
      }
    }

    for (let y = 0; y < bh; y++) {
      for (let x = 0; x < bw; x++) {
        const i = y * bw + x;
        const o = i * 4;
        if (!mask[i]) {
          px[o + 3] = 0;
          continue;
        }
        let r = BG[0];
        let g = BG[1];
        let b = BG[2];
        const gi = (x / cs) | 0;
        const gj = (y / cs) | 0;
        let best = 1e9;
        let bestK = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const k = (gj + dy) * nxi + (gi + dx);
            const ddx = x - ptsx[k];
            const ddy = y - pty[k];
            const d2 = ddx * ddx + ddy * ddy;
            if (d2 < best) {
              best = d2;
              bestK = k;
            }
          }
        }
        const rad = cs * (0.6 + 0.3 * hash2(bestK, 733));
        if (Math.sqrt(best) < rad) {
          const v = 0.9 + 0.2 * hash2(bestK, 151);
          r = ORANGE[0] * v;
          g = ORANGE[1] * v;
          b = ORANGE[2] * v;
        }
        px[o] = r;
        px[o + 1] = g;
        px[o + 2] = b;
        px[o + 3] = 255;
      }
    }
    bctx.putImageData(imgData, 0, 0);

    cctx.clearRect(0, 0, comp.width, comp.height);
    cctx.imageSmoothingEnabled = true;
    cctx.drawImage(buf, 0, 0, comp.width, comp.height);
    cctx.globalCompositeOperation = "destination-in";
    cctx.drawImage(maskHi, 0, 0);
    cctx.globalCompositeOperation = "source-over";

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(comp, 0, 0, W, H);
    if (ambient) {
      ctx.fillStyle = ambient;
      ctx.fillRect(0, 0, W, H);
    }

    const dt = lastT ? Math.min(0.05, (t - lastT) / 1000) : 0.016;
    lastT = t;
    const FR = 190;
    for (const p of parts) {
      if (!reduced) {
        p.by -= (p.vy * dt) / H;
        if (p.by < -0.05) {
          p.by += 1.1;
          if (Math.hypot(p.vx, p.vyv) < 8) {
            p.x = p.bx * W;
            p.y = p.by * H;
          }
        } else if (p.by > 1.05) {
          p.by -= 1.1;
        }
        const tx = p.bx * W + Math.sin(time * p.sway + p.phase) * p.swayAmp;
        const ty = p.by * H;
        p.vx += (tx - p.x) * 0.012;
        p.vyv += (ty - p.y) * 0.012;
        if (mouse.active) {
          const dx = p.x - mouse.x;
          const dy = p.y - mouse.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < FR && d > 0.001) {
            const f = 1 - d / FR;
            const ff = f * f;
            const nx = dx / d;
            const ny = dy / d;
            const mvx = Math.max(-40, Math.min(40, mouse.vx));
            const mvy = Math.max(-40, Math.min(40, mouse.vy));
            const mvl = Math.hypot(mvx, mvy) || 1;
            const imp = ff * 1.6;
            p.vx += ((mvx / mvl) * 0.7 - ny * 0.25 + nx * 0.35) * imp;
            p.vyv += ((mvy / mvl) * 0.7 + nx * 0.25 + ny * 0.35) * imp;
          }
        }
        p.vx *= 0.9;
        p.vyv *= 0.9;
        p.x += p.vx;
        p.y += p.vyv;
        p.ag = Math.min(1, p.ag * 0.94 + Math.hypot(p.vx, p.vyv) * 0.045);
      } else {
        p.x = p.bx * W + Math.sin(p.phase) * p.swayAmp;
        p.y = p.by * H;
      }
      const tw = 0.7 + 0.3 * Math.sin(time * 1.3 + p.phase * 3);
      ctx.globalAlpha = Math.min(1, p.a * tw * (1 + p.ag * 5));
      const s = (p.big ? p.size * 6 : p.size * 3) * (1 + p.ag * 0.6);
      ctx.drawImage(glowSprite, p.x - s / 2, p.y - s / 2, s, s);
    }
    ctx.globalAlpha = 1;

    if (!reduced) requestAnimationFrame(frame);
  }

  let rt;
  window.addEventListener("resize", () => {
    clearTimeout(rt);
    rt = setTimeout(() => {
      build();
      if (reduced) frame(0);
    }, 150);
  });

  build();
  requestAnimationFrame(frame);
}
