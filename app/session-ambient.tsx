'use client';

import { play, setEnabled } from 'cuelume';
import { useEffect, useRef } from 'react';
import { BRAND_GLYPH, FIELD_SHAPES } from './field-shapes';

const GRAY = Array.from({ length: 256 }, (_, i) => `rgb(${i},${i},${i})`);

type Ripple = { x: number; y: number; start: number; maxDist: number };

function readMs(name: string, fallback: number): number {
  if (typeof window === 'undefined') return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (!raw) return fallback;
  const ms = raw.match(/^([\d.]+)\s*ms$/i);
  if (ms) return +ms[1]!;
  const sec = raw.match(/^([\d.]+)\s*s$/i);
  if (sec) return +sec[1]! * 1000;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : fallback;
}

function isGecko(): boolean {
  if (typeof navigator === 'undefined') return false;
  if (/Firefox\//i.test(navigator.userAgent)) return true;
  try {
    return CSS.supports('-moz-appearance', 'none');
  } catch {
    return false;
  }
}

function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const x = Math.min(1, Math.max(0, t));
  return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2;
}

export function SessionAmbient() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const node = canvasRef.current;
    if (!(node instanceof HTMLCanvasElement)) return;
    const el: HTMLCanvasElement = node;
    const surface = el.getContext('2d');
    if (!surface) return;
    const ctx: CanvasRenderingContext2D = surface;

    const cell = 18;

    // skip bloom on gecko
    const gecko = isGecko();
    const useBloom = !gecko;
    const bloomRes = 0.45;

    let bloomEl: HTMLCanvasElement | null = null;
    let bloom: CanvasRenderingContext2D | null = null;
    if (useBloom) {
      bloomEl = document.createElement('canvas');
      bloom = bloomEl.getContext('2d');
      if (!bloom) return;
    }

    const paths = FIELD_SHAPES.map((s) => ({
      path: new Path2D(s.d),
      viewW: s.viewW,
      viewH: s.viewH,
    }));

    const rippleMs = readMs('--duration-ripple', 720);
    const bobMs = readMs('--duration-field-bob', 420);
    const rebobMs = readMs('--duration-field-rebob', 300);
    const brandMs = readMs('--duration-brand-bob', 280);
    const rippleLife = rippleMs + bobMs;

    let unlocked = false;
    let introDone = false;
    let firstRippleStart = 0;
    let reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let hidden = document.hidden;
    const ripples: Ripple[] = [];
    const seed = Math.random() * 10000;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let raf = 0;
    let running = false;
    let resizeTimer = 0;
    let lastPtr = 0;
    let lastStep = 0;
    let ptrX = 0;
    let ptrY = 0;
    let isTouch = false;
    let dragging = false;
    let mouseSeen = false;

    const trail: { x: number; y: number; t: number }[] = [];
    let letters: { el: HTMLElement; x: number; y: number; link: boolean }[] = [];
    let forceMask: Uint8Array | null = null;
    let maskW = 0;
    let maskH = 0;

    // field SoA
    const restX: number[] = [];
    const restY: number[] = [];
    const posX: number[] = [];
    const posY: number[] = [];
    const velX: number[] = [];
    const velY: number[] = [];
    const salt: number[] = [];
    const shapeIdx: number[] = [];
    const residual: number[] = [];

    let drawIdx = new Int16Array(0);
    let drawPx = new Float32Array(0);
    let drawPy = new Float32Array(0);
    let drawSize = new Float32Array(0);
    let drawA = new Float32Array(0);
    let drawSc = new Float32Array(0);
    let drawR = new Uint8Array(0);
    let drawG = new Uint8Array(0);
    let drawB = new Uint8Array(0);
    let drawBloomA = new Float32Array(0);
    let drawN = 0;

    const color = { r: 0, g: 0, b: 0, a: 0 };
    const bob = { scale: 1, lift: 0 };
    const brand = { scale: 1, lift: 0 };

    const ensureCap = (n: number) => {
      if (drawIdx.length >= n) return;
      drawIdx = new Int16Array(n);
      drawPx = new Float32Array(n);
      drawPy = new Float32Array(n);
      drawSize = new Float32Array(n);
      drawA = new Float32Array(n);
      drawSc = new Float32Array(n);
      drawR = new Uint8Array(n);
      drawG = new Uint8Array(n);
      drawB = new Uint8Array(n);
      drawBloomA = new Float32Array(n);
    };

    const insideForce = (x: number, y: number) => {
      if (!forceMask) return false;
      const ix = x | 0;
      const iy = y | 0;
      return ix >= 0 && iy >= 0 && ix < maskW && iy < maskH && forceMask[iy * maskW + ix] === 1;
    };

    const sparsityAt = (x: number, y: number) => {
      const cx = width / 2;
      const cy = height / 2;
      const maxR = Math.hypot(Math.max(cx, width - cx), Math.max(cy, height - cy)) || 1;
      const t = Math.min(1, Math.hypot(x - cx, y - cy) / maxR);
      const u = t * t * (3 - 2 * t);
      return 0.02 + (0.58 - 0.02) * u;
    };

    const cornerDist = (x: number, y: number) =>
      Math.max(
        Math.hypot(x, y),
        Math.hypot(width - x, y),
        Math.hypot(x, height - y),
        Math.hypot(width - x, height - y),
        1
      );

    const rebuildMask = () => {
      maskW = Math.max(1, Math.ceil(width));
      maskH = Math.max(1, Math.ceil(height));
      const off = document.createElement('canvas');
      off.width = maskW;
      off.height = maskH;
      const g = off.getContext('2d');
      if (!g) {
        forceMask = null;
        return;
      }
      const sc = 1000 / Math.max(BRAND_GLYPH.viewW, BRAND_GLYPH.viewH);
      g.clearRect(0, 0, maskW, maskH);
      g.fillStyle = '#fff';
      g.translate(width / 2, height / 2);
      g.scale(sc, sc);
      g.translate(-BRAND_GLYPH.viewW / 2, -BRAND_GLYPH.viewH / 2);
      g.fill(new Path2D(BRAND_GLYPH.d));
      const data = g.getImageData(0, 0, maskW, maskH).data;
      const m = new Uint8Array(maskW * maskH);
      for (let i = 0, p = 0; i < m.length; i++, p += 4) m[i] = data[p + 3]! > 16 ? 1 : 0;
      forceMask = m;
    };

    const buildField = () => {
      restX.length = restY.length = posX.length = posY.length = 0;
      velX.length = velY.length = salt.length = shapeIdx.length = residual.length = 0;

      const cols = Math.ceil(width / cell) + 1;
      const rows = Math.ceil(height / cell) + 1;
      const ox = (width - (cols - 1) * cell) / 2;
      const oy = (height - (rows - 1) * cell) / 2;
      const nShapes = paths.length;

      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const x = ox + i * cell;
          const y = oy + j * cell;
          if (insideForce(x, y)) continue;
          const n = Math.sin(i * 12.9898 + j * 78.233 + seed) * 43758.5453;
          const s = n - Math.floor(n);
          if (s < sparsityAt(x, y)) continue;
          restX.push(x);
          restY.push(y);
          posX.push(x);
          posY.push(y);
          velX.push(0);
          velY.push(0);
          salt.push(s);
          residual.push(0);
          const n2 = Math.sin(i * 39.346 + j * 11.135 + 2.7 + seed * 1.7) * 23421.631;
          shapeIdx.push(Math.floor((n2 - Math.floor(n2)) * nShapes) % nShapes);
        }
      }
      ensureCap(restX.length);
    };

    const sizeCanvas = () => {
      dpr = Math.min(devicePixelRatio || 1, 2);
      width = innerWidth;
      height = innerHeight;
      el.width = (width * dpr) | 0;
      el.height = (height * dpr) | 0;
      el.style.width = `${width}px`;
      el.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (bloomEl && bloom) {
        bloomEl.width = Math.max(1, (width * bloomRes) | 0);
        bloomEl.height = Math.max(1, (height * bloomRes) | 0);
        bloom.setTransform(bloomRes, 0, 0, bloomRes, 0, 0);
      }
      if (!mouseSeen && !isTouch) {
        ptrX = width / 2;
        ptrY = height / 2;
      }
    };

    const cacheLetters = () => {
      const nodes = document.querySelectorAll<HTMLElement>('[data-brand-letter]');
      for (const n of nodes) {
        n.style.transform = 'translateY(0px) scale(1)';
        n.style.willChange = 'auto';
        n.style.color = '';
      }
      letters = [];
      for (const n of nodes) {
        const r = n.getBoundingClientRect();
        if (!r.width && !r.height) continue;
        letters.push({
          el: n,
          x: r.left + r.width / 2,
          y: r.top + r.height / 2,
          link: n.hasAttribute('data-brand-letter-link'),
        });
      }
    };

    const rebuild = () => {
      for (const r of ripples) r.maxDist = cornerDist(r.x, r.y);
      rebuildMask();
      buildField();
      cacheLetters();
    };

    const preReveal = () => !introDone && firstRippleStart === 0;

    const kick = () => {
      if (running || hidden) return;
      running = true;
      raf = requestAnimationFrame(step);
    };

    const pruneTrail = (now: number) => {
      while (trail.length && now - trail[0]!.t > 520) trail.shift();
    };

    const pushTrail = (x: number, y: number, now: number) => {
      const last = trail[trail.length - 1];
      if (last && Math.hypot(x - last.x, y - last.y) < 5) {
        last.x = x;
        last.y = y;
        last.t = now;
        return;
      }
      trail.push({ x, y, t: now });
      while (trail.length > 48) trail.shift();
    };

    const trailAt = (x: number, y: number, now: number) => {
      let peak = 0;
      for (const s of trail) {
        const age = now - s.t;
        if (age < 0 || age > 520) continue;
        const d = Math.hypot(x - s.x, y - s.y);
        if (d >= 16.2) continue;
        const radial = 1 - d / 16.2;
        const fade = 1 - age / 520;
        peak = Math.max(peak, radial * radial * fade * fade);
      }
      return peak;
    };

    const needsFrame = (now: number) => {
      if (hidden || reduced) return false;
      if (preReveal()) {
        pruneTrail(now);
        if (trail.length) return true;
        return (mouseSeen || isTouch) && (now - lastPtr < 450 || dragging);
      }
      return unlocked;
    };

    const tint = (s: number, light: number) => {
      const base = 0.1 + s * 0.07;
      color.r = color.g = color.b = 212 + (245 - 212) * light;
      color.a = Math.min(0.58, base * (1 + light * 0.35));
    };

    const rippleLight = (x: number, y: number, now: number) => {
      let peak = 0;
      for (const r of ripples) {
        const age = now - r.start;
        if (age < 0 || age > rippleLife) continue;
        const dist = Math.hypot(x - r.x, y - r.y);
        const front = Math.min(1, age / rippleMs) * r.maxDist;
        const d = dist - front;
        const ring = Math.exp((-d * d) / (2 * 56 * 56));
        // hit flash during bob
        let hit = 0;
        const local = age - (dist / r.maxDist) * rippleMs;
        if (local >= 0 && local < bobMs) {
          const u = local / bobMs;
          hit = (1 - u) * (1 - u);
        }
        peak = Math.max(peak, ring * 1.1 + hit * 0.95);
      }
      return Math.min(1, peak);
    };

    // false = not reached yet (intro cull)
    const bobAt = (x: number, y: number, now: number) => {
      bob.scale = 1;
      bob.lift = 0;
      if (!unlocked) return false;
      let best = -1;
      let reached = false;
      const dur = introDone ? rebobMs : bobMs;
      for (const r of ripples) {
        const dist = Math.hypot(x - r.x, y - r.y);
        const local = now - r.start - (dist / r.maxDist) * rippleMs;
        if (local < 0) continue;
        reached = true;
        const t = Math.min(1, local / dur);
        if (t < best) continue;
        best = t;
        if (introDone) {
          const p = Math.sin(t * Math.PI);
          bob.scale = Math.max(0.98, 1 + p * 0.07);
          bob.lift = -p * 5;
        } else {
          const raw = easeOutBack(t);
          const mapped = 0.92 + raw * (1 - 0.92);
          bob.scale = Math.min(1.08, Math.max(0.92, mapped));
          bob.lift = (1 - Math.min(1, raw)) * 6 - Math.sin(t * Math.PI) * 10 * 0.45;
        }
      }
      return introDone || reached;
    };

    const brandAt = (x: number, y: number, now: number) => {
      brand.scale = 1;
      brand.lift = 0;
      if (!unlocked || reduced) return;
      let best = -1;
      for (const r of ripples) {
        const dist = Math.hypot(x - r.x, y - r.y);
        const local = now - r.start - (dist / r.maxDist) * rippleMs;
        if (local < 0) continue;
        const t = Math.min(1, local / brandMs);
        if (t >= best) best = t;
      }
      if (best < 0) return;
      const p = Math.sin(best * Math.PI);
      brand.scale = 1 + p * 0.04;
      brand.lift = -p * 5;
    };

    const paintBrand = (now: number) => {
      if (!letters.length || letters.some((e) => !e.el.isConnected)) cacheLetters();
      for (const e of letters) {
        brandAt(e.x, e.y, now);
        const light = reduced ? 0 : rippleLight(e.x, e.y, now);
        const live =
          Math.abs(brand.scale - 1) > 0.001 || Math.abs(brand.lift) > 0.05 || light > 0.02;
        e.el.style.willChange = live ? 'transform, color' : 'auto';
        e.el.style.transform = `translateY(${brand.lift.toFixed(2)}px) scale(${brand.scale.toFixed(4)})`;
        if (!e.link) continue;
        if (light > 0.02) {
          const c = Math.round(99 + (245 - 99) * light);
          e.el.style.color = `rgb(${c},${c},${c})`;
        } else e.el.style.color = '';
      }
    };

    const glyph = (
      c: CanvasRenderingContext2D,
      i: number,
      x: number,
      y: number,
      size: number,
      a: number,
      sc: number,
      r: number,
      g: number,
      b: number
    ) => {
      const p = paths[i];
      if (!p) return;
      const s = (size / Math.max(p.viewW, p.viewH)) * sc;
      const ri = r | 0;
      const gi = g | 0;
      const bi = b | 0;
      c.save();
      c.translate(x, y);
      c.scale(s, s);
      c.translate(-p.viewW / 2, -p.viewH / 2);
      if (ri === gi && gi === bi) {
        c.fillStyle = GRAY[ri]!;
        c.globalAlpha = a;
      } else c.fillStyle = `rgba(${ri},${gi},${bi},${a})`;
      c.fill(p.path);
      c.restore();
    };

    const flush = (c: CanvasRenderingContext2D, alphas: Float32Array) => {
      for (let i = 0; i < drawN; i++) {
        glyph(
          c,
          drawIdx[i]!,
          drawPx[i]!,
          drawPy[i]!,
          drawSize[i]!,
          alphas[i]!,
          drawSc[i]!,
          drawR[i]!,
          drawG[i]!,
          drawB[i]!
        );
      }
    };

    const compositeBloom = () => {
      if (!bloomEl) return;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.filter = `blur(${12 * dpr}px) brightness(1.25)`;
      ctx.globalAlpha = 0.38;
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(bloomEl, 0, 0, el.width, el.height);
      ctx.restore();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.filter = 'none';
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    };

    const staticField = () => {
      ctx.clearRect(0, 0, width, height);
      for (let i = 0; i < restX.length; i++) {
        const s = salt[i]!;
        tint(s, 0);
        glyph(
          ctx,
          shapeIdx[i]!,
          restX[i]!,
          restY[i]!,
          9 * (0.85 + s * 0.4),
          Math.min(0.58, color.a),
          1,
          color.r,
          color.g,
          color.b
        );
      }
    };

    const hoverTrail = (now: number) => {
      if (reduced || (!(mouseSeen || isTouch) && !trail.length)) return;
      pruneTrail(now);
      for (let i = 0; i < restX.length; i++) {
        const str = trailAt(restX[i]!, restY[i]!, now);
        if (str < 0.02) continue;
        const s = salt[i]!;
        tint(s, str * 0.55);
        glyph(
          ctx,
          shapeIdx[i]!,
          restX[i]!,
          restY[i]!,
          9 * (0.85 + s * 0.4),
          0.08 + (0.55 - 0.08) * str,
          0.94 + str * 0.12,
          color.r,
          color.g,
          color.b
        );
      }
    };

    const pruneRipples = (now: number) => {
      for (let i = ripples.length - 1; i >= 0; i--) {
        if (now - ripples[i]!.start >= rippleLife) ripples.splice(i, 1);
      }
      // intro ends on first wave clock
      if (unlocked && !introDone && firstRippleStart > 0 && now - firstRippleStart >= rippleLife) {
        introDone = true;
      }
    };

    const spawn = (x: number, y: number, now: number) => {
      if (reduced) return;
      ripples.push({ x, y, start: now, maxDist: cornerDist(x, y) });
      kick();
    };

    function step(now: number) {
      if (hidden) {
        ctx.clearRect(0, 0, width, height);
        bloom?.clearRect(0, 0, width, height);
        paintBrand(now);
        running = false;
        return;
      }

      if (preReveal()) {
        ctx.clearRect(0, 0, width, height);
        hoverTrail(now);
        paintBrand(now);
        if (needsFrame(now)) raf = requestAnimationFrame(step);
        else {
          trail.length = 0;
          ctx.clearRect(0, 0, width, height);
          running = false;
        }
        return;
      }

      if (!unlocked) {
        ctx.clearRect(0, 0, width, height);
        paintBrand(now);
        running = false;
        return;
      }

      if (reduced) {
        staticField();
        paintBrand(now);
        running = false;
        return;
      }

      pruneRipples(now);
      const pull = isTouch ? dragging : mouseSeen;
      const n = restX.length;
      const dt = lastStep > 0 ? Math.min(48, now - lastStep) : 16;
      lastStep = now;
      const phDecay = Math.exp(-dt / 1800);
      const dtSec = dt / 1000;

      // bloom only while glow active
      let wantBloom = useBloom && (!introDone || ripples.length > 0 || pull);
      ensureCap(n);
      drawN = 0;

      for (let i = 0; i < n; i++) {
        const x = restX[i]!;
        const y = restY[i]!;
        let tx = x;
        let ty = y;

        if (pull) {
          const dx = ptrX - x;
          const dy = ptrY - y;
          const dist = Math.hypot(dx, dy) || 1;
          if (dist < 200) {
            const f = (1 - dist / 200) ** 2 * 12;
            tx -= (dx / dist) * f * 0.55;
            ty -= (dy / dist) * f * 0.55;
            tx += (-dy / dist) * f * 0.25;
            ty += (dx / dist) * f * 0.25;
          }
        }

        velX[i] = (velX[i]! + (tx - posX[i]!) * 0.1) * 0.82;
        velY[i] = (velY[i]! + (ty - posY[i]!) * 0.1) * 0.82;
        posX[i]! += velX[i]!;
        posY[i]! += velY[i]!;

        let ph = residual[i]! * phDecay;
        if (ph < 0.0008) ph = 0;
        if (pull) {
          const pd = Math.hypot(ptrX - x, ptrY - y);
          if (pd < 150) {
            const u = 1 - pd / 150;
            ph = Math.min(1, ph + u * u * 3.2 * dtSec);
          }
        }

        const rl = rippleLight(x, y, now);
        if (rl > 0.02) ph = Math.min(1, ph + rl * 2.4 * dtSec);
        residual[i] = ph;
        if (ph > 0.02 || rl > 0.02) wantBloom = true;

        if (!bobAt(x, y, now)) continue;

        const s = salt[i]!;
        tint(s, Math.min(1, rl + ph * 0.55));
        const tw =
          1 +
          (Math.sin(now * 0.00135 * 1.7 + s * 37.1 + x * 0.05) * 0.55 +
            Math.sin(now * 0.00135 * 1.13 + s * 19.4 + y * 0.04) * 0.45) *
            0.16;
        const a = Math.min(0.9, color.a * tw * (1 + ph * 0.4));
        if (a < 0.03 && ph < 0.02) continue;

        const d = drawN++;
        drawIdx[d] = shapeIdx[i]!;
        drawPx[d] = posX[i]!;
        drawPy[d] = posY[i]! + bob.lift;
        drawSize[d] = 9 * (0.85 + s * 0.4);
        drawA[d] = a;
        drawSc[d] = bob.scale;
        drawR[d] = color.r | 0;
        drawG[d] = color.g | 0;
        drawB[d] = color.b | 0;
        drawBloomA[d] = Math.min(0.95, a * 1.35 * (1 + ph * 0.35));
      }

      if (wantBloom && bloom) {
        bloom.clearRect(0, 0, width, height);
        flush(bloom, drawBloomA);
      }
      ctx.clearRect(0, 0, width, height);
      if (wantBloom) compositeBloom();
      flush(ctx, drawA);
      paintBrand(now);

      if (needsFrame(now)) raf = requestAnimationFrame(step);
      else running = false;
    }

    const startIntro = (x: number, y: number, now: number) => {
      trail.length = 0;
      setEnabled(true);
      play('bloom');
      if (reduced) {
        introDone = true;
        staticField();
        paintBrand(now);
        return;
      }
      firstRippleStart = now;
      spawn(x, y, now);
    };

    const onDown = (e: PointerEvent) => {
      const now = performance.now();
      lastPtr = now;
      ptrX = e.clientX;
      ptrY = e.clientY;
      isTouch = e.pointerType === 'touch';
      if (isTouch) dragging = true;
      else mouseSeen = true;
      reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (!reduced && preReveal()) {
        pushTrail(e.clientX, e.clientY, now);
        kick();
      }

      const t = e.target;
      if (t instanceof Element && t.closest('a, button, [data-no-ripple]')) {
        setEnabled(true);
        if (t.closest('[data-brand-credit] a') && !introDone && firstRippleStart === 0) {
          unlocked = true;
          startIntro(e.clientX, e.clientY, now);
        }
        return;
      }

      if (!unlocked || (!introDone && firstRippleStart === 0)) {
        unlocked = true;
        startIntro(e.clientX, e.clientY, now);
        return;
      }
      if (reduced) return;
      if (!introDone && firstRippleStart > 0) {
        spawn(e.clientX, e.clientY, now);
        return;
      }
      introDone = true;
      spawn(e.clientX, e.clientY, now);
    };

    const onMove = (e: PointerEvent) => {
      const now = performance.now();
      lastPtr = now;
      ptrX = e.clientX;
      ptrY = e.clientY;
      if (e.pointerType === 'mouse') {
        isTouch = false;
        mouseSeen = true;
      } else if (e.pointerType === 'touch') isTouch = true;

      if (!reduced && preReveal()) {
        pushTrail(e.clientX, e.clientY, now);
        kick();
        return;
      }
      if (unlocked && !reduced) kick();
    };

    const onUp = (e: PointerEvent) => {
      lastPtr = performance.now();
      if (e.pointerType === 'touch') dragging = false;
      if (!reduced && (unlocked || preReveal())) kick();
    };

    const onVis = () => {
      hidden = document.hidden;
      if (!hidden && !reduced && (unlocked || preReveal())) kick();
    };

    const onMotion = () => {
      reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduced && unlocked) {
        introDone = true;
        ripples.length = 0;
        staticField();
        paintBrand(performance.now());
        running = false;
        cancelAnimationFrame(raf);
      }
    };

    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    mq.addEventListener('change', onMotion);

    sizeCanvas();
    rebuild();
    paintBrand(performance.now());

    const onResize = () => {
      sizeCanvas();
      clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        rebuild();
        kick();
      }, 100);
    };

    addEventListener('resize', onResize);
    addEventListener('pointerdown', onDown, true);
    addEventListener('pointermove', onMove, { passive: true });
    addEventListener('pointerup', onUp, true);
    addEventListener('pointercancel', onUp, true);
    document.addEventListener('visibilitychange', onVis);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      clearTimeout(resizeTimer);
      trail.length = 0;
      removeEventListener('resize', onResize);
      removeEventListener('pointerdown', onDown, true);
      removeEventListener('pointermove', onMove);
      removeEventListener('pointerup', onUp, true);
      removeEventListener('pointercancel', onUp, true);
      document.removeEventListener('visibilitychange', onVis);
      mq.removeEventListener('change', onMotion);
      setEnabled(true);
      for (const { el: n } of letters) {
        n.style.willChange = 'auto';
        n.style.transform = 'translateY(0px) scale(1)';
      }
      letters = [];
    };
  }, []);

  return (
    <canvas ref={canvasRef} aria-hidden className="pointer-events-none absolute inset-0 z-0" />
  );
}
