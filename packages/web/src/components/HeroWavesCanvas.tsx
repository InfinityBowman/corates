import { useEffect, useMemo, useRef } from 'react';

/**
 * Animated "ribbon field" hero background
 *
 * A set of horizontal ribbons span a fixed design space; per-ribbon phase, a
 * twist term and a bulge envelope make them fan apart and pinch back into a
 * bright convergence knot. Each ribbon is a solid gradient stroke (no additive
 * blending); small colored "particle" dashes travel along random ribbons for
 * shimmer. Drawn on Canvas 2D, scaled to cover the canvas each frame.
 *
 * Only the palette is changed from the original: blue->sky instead of
 * green->lime, and cool-toned particle colors.
 */

interface RibbonSettings {
  width: number;
  height: number;
  count: number;
  resolution: number;
  spacing: number;
  amplitude: number;
  frequency: number;
  phase: number;
  twist: number;
  bulge: number;
  morph: number;
  speed: number;
  anim: 'spin' | 'flow' | 'morph' | 'breathe';
  strokeWidth: number;
  opacity: number;
  gradientStart: string;
  gradientEnd: string;
  background: string;
  particlesOn: boolean;
  particleColors: string[];
  particleCount: number;
  particleSize: number;
  particleLength: number;
  particleFade: boolean;
  particleSpeed: number;
  particleCoverage: number;
  particleRandom: boolean;
  particleSparse: number;
  particleVariance: number;
  particleSeed: number;
  rotate: number;
  edgeFade: number;
}

const DEFAULTS: RibbonSettings = {
  width: 1720,
  height: 1080,
  count: 24,
  resolution: 81,
  spacing: 4.9,
  amplitude: 163,
  frequency: 0.75,
  phase: 0.14,
  twist: 0.41,
  bulge: 0.66,
  morph: 0.5,
  speed: 1,
  anim: 'spin',
  strokeWidth: 1,
  opacity: 1,
  gradientStart: '#1d4ed8', // blue-700
  gradientEnd: '#38bdf8', // sky-400
  background: 'transparent', // let the page gradient show through
  particlesOn: true,
  particleColors: ['#818cf8', '#38bdf8', '#22d3ee', '#a78bfa'],
  particleCount: 1,
  particleSize: 3,
  particleLength: 88,
  particleFade: true,
  particleSpeed: 1.15,
  particleCoverage: 1,
  particleRandom: true,
  particleSparse: 0.32,
  particleVariance: 0,
  particleSeed: 2025,
  rotate: 0,
  edgeFade: 0,
};

type RGB = [number, number, number];

function hexToRgb(hex: string): RGB {
  let h = hex.replace('#', '');
  if (h.length === 3) {
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  }
  return [
    Number.parseInt(h.slice(0, 2), 16),
    Number.parseInt(h.slice(2, 4), 16),
    Number.parseInt(h.slice(4, 6), 16),
  ];
}

function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

function lerpRgb(a: string, b: string, t: number): RGB {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return [
    Math.round(x[0] + (y[0] - x[0]) * t),
    Math.round(x[1] + (y[1] - x[1]) * t),
    Math.round(x[2] + (y[2] - x[2]) * t),
  ];
}

// Deterministic integer hash in [0, 1). Transcribed verbatim from the original
// so particle placement matches; the lossy 32-bit math is intentional.
function hash(a: number, b: number, c: number): number {
  let r = (0x165667b1 * a + 0x27d4eb2f * b + 0x3a8f05c5 * c) | 0;
  r = (r ^ (r >>> 13)) * 0x4bf19f61;
  r = (r ^ (r >>> 16)) >>> 0;
  return (r % 1e5) / 1e5;
}

interface Point {
  x: number;
  y: number;
}
interface RibbonColor {
  solid: string;
  clear: string;
  full: string;
}

export default function HeroWavesCanvas({
  settings,
}: {
  settings?: Partial<RibbonSettings>;
}) {
  const merged = useMemo(() => ({ ...DEFAULTS, ...settings }), [settings]);
  const settingsRef = useRef(merged);
  settingsRef.current = merged;
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Reusable point buffers per ribbon, and a per-segment length scratch.
    const pointCache: Point[][] = [];
    const segLengths: number[] = [];

    let colorKey = '';
    let colors: RibbonColor[] = [];
    const particleFadePairs = new Map<string, [string, string]>();

    const buildColors = (s: RibbonSettings): RibbonColor[] => {
      const key = `${s.gradientStart}|${s.gradientEnd}|${s.count}|${s.opacity}`;
      if (key === colorKey) return colors;
      colorKey = key;
      colors = [];
      for (let i = 0; i < s.count; i++) {
        const t = s.count <= 1 ? 0 : i / (s.count - 1);
        const [r, g, b] = lerpRgb(s.gradientStart, s.gradientEnd, t);
        colors.push({
          solid: `rgb(${r},${g},${b})`,
          clear: `rgba(${r},${g},${b},0)`,
          full: `rgba(${r},${g},${b},${s.opacity})`,
        });
      }
      return colors;
    };

    // Per-ribbon vertical band offset and the wave value at position u in [0,1].
    const offsetAt = (ribbon: number, u: number, time: number, s: RibbonSettings) => {
      const n = s.count;
      const ph = s.phase * (ribbon - (n - 1) / 2);
      const l = s.frequency * Math.PI * 2;
      const bulge = 1 + s.bulge * Math.sin(u * Math.PI);
      let flow = 0;
      let morphT = 0;
      let breathe = 1;
      let spin = 0;
      if (s.anim === 'flow') flow = 0.8 * time;
      if (s.anim === 'morph') morphT = 0.6 * time;
      if (s.anim === 'breathe') breathe = 1 + 0.35 * Math.sin(1.2 * time);
      if (s.anim === 'spin') spin = 0.7 * time;
      const f = Math.sin(l * u + ph + flow);
      const h = Math.sin(0.5 * l * u - 2 * ph + 0.7 * flow + spin);
      let p = 0;
      if (s.morph > 0) {
        p =
          Math.sin(3.7 * u + morphT + 0.2 * ribbon) *
          Math.cos(2.1 * u - 0.5 * morphT + 0.13 * ribbon);
      }
      return {
        yOffset: (f + s.twist * h + s.morph * p) * 0.5 * bulge * breathe,
        lineOffset:
          ((n <= 1 ? 0.5 : ribbon / (n - 1)) - 0.5) * s.count * s.spacing,
      };
    };

    const buildRibbon = (ribbon: number, time: number, s: RibbonSettings): Point[] => {
      const segs = Math.max(2, s.resolution) - 1;
      let pts = pointCache[ribbon];
      if (!pts || pts.length !== segs + 1) {
        pts = Array.from({ length: segs + 1 }, () => ({ x: 0, y: 0 }));
        pointCache[ribbon] = pts;
      }
      const cy = s.height / 2;
      const cx = s.width / 2;
      const rot = (s.rotate * Math.PI) / 180;
      const cosR = Math.cos(rot);
      const sinR = Math.sin(rot);
      for (let i = 0; i <= segs; i++) {
        const u = i / segs;
        const { yOffset, lineOffset } = offsetAt(ribbon, u, time, s);
        const x = u * s.width;
        const y = cy + lineOffset + yOffset * s.amplitude;
        const p = pts[i];
        if (rot === 0) {
          p.x = x;
          p.y = y;
        } else {
          const ex = x - cx;
          const ey = y - cy;
          p.x = cx + ex * cosR - ey * sinR;
          p.y = cy + ex * sinR + ey * cosR;
        }
      }
      return pts;
    };

    // Arc-length sample: position + tangent at fraction `frac` along the ribbon.
    const sampleAt = (pts: Point[], frac: number): [number, number, number, number] => {
      if (pts.length === 0) return [0, 0, 0, 0];
      const first = pts[0];
      if (pts.length === 1) return [first.x, first.y, 0, 0];
      let total = 0;
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1];
        const b = pts[i];
        const d = Math.hypot(b.x - a.x, b.y - a.y);
        segLengths[i - 1] = d;
        total += d;
      }
      if (total === 0) return [first.x, first.y, 0, 0];
      const target = frac * total;
      let acc = 0;
      for (let i = 0; i < pts.length - 1; i++) {
        const d = segLengths[i] ?? 0;
        if (acc + d >= target) {
          const a = pts[i];
          const b = pts[i + 1];
          const l = d > 0 ? (target - acc) / d : 0;
          return [a.x + (b.x - a.x) * l, a.y + (b.y - a.y) * l, b.x - a.x, b.y - a.y];
        }
        acc += d;
      }
      const last = pts[pts.length - 1];
      return [last.x, last.y, 0, 0];
    };

    const particleProgress = (
      ribbon: number,
      idx: number,
      time: number,
      s: RibbonSettings,
    ): { u: number; fade: number } | null => {
      const active = Math.max(0.8, 3.4 / Math.max(0.15, Math.abs(s.particleSpeed)));
      const period = active + 2.2;
      const seedShift = 0.18 * ribbon;
      const jitter = 1.8 * hash(ribbon, 17 * idx + 3, s.particleSeed);
      let o = (time + seedShift - 0.9 * idx - jitter) % period;
      if (o < 0) o += period;
      if (o > active) return null;
      const c = o / active;
      return {
        u: c * s.particleCoverage,
        fade: c < 0.18 ? c / 0.18 : c > 0.68 ? (1 - c) / 0.32 : 1,
      };
    };

    const render = (time: number, intro: number) => {
      const s = settingsRef.current;
      const { width, height } = s;
      const fadingIn = intro < 1;

      ctx.clearRect(0, 0, width, height);
      if (s.background && s.background !== 'transparent') {
        ctx.fillStyle = s.background;
        ctx.fillRect(0, 0, width, height);
      }
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      const palette = buildColors(s);
      ctx.lineWidth = s.strokeWidth;
      const clampFade = (v: number) => Math.min(0.5, Math.max(0, v));
      const fadeStart = clampFade(s.edgeFade);
      const fadeEnd = clampFade(s.edgeFade);

      for (let t = 0; t < s.count; t++) {
        const pts = buildRibbon(t, time, s);
        if (pts.length < 2) continue;
        const first = pts[0];
        const last = pts[pts.length - 1];
        if (!first) continue;
        const color = palette[t];
        if (!color) continue;

        // Intro reveal: ribbons draw in via a growing line dash.
        let revealed = 1;
        if (fadingIn) {
          const a = Math.min(intro / (0.6 + 0.4 * hash(t, 53, s.particleSeed)), 1);
          revealed = a * a * (3 - 2 * a);
          if (revealed <= 0) {
            ctx.setLineDash([]);
            continue;
          }
          if (revealed < 1) {
            let len = 0;
            for (let i = 1; i < pts.length; i++) {
              len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
            }
            ctx.setLineDash([len * revealed, len + 1]);
          } else {
            ctx.setLineDash([]);
          }
        }

        if ((fadeStart > 0 || fadeEnd > 0) && last) {
          const grad = ctx.createLinearGradient(first.x, first.y, last.x, last.y);
          grad.addColorStop(0, fadeStart > 0 ? color.clear : color.full);
          if (fadeStart > 0) grad.addColorStop(fadeStart, color.full);
          if (fadeEnd > 0) grad.addColorStop(1 - fadeEnd, color.full);
          grad.addColorStop(1, fadeEnd > 0 ? color.clear : color.full);
          ctx.strokeStyle = grad;
          ctx.globalAlpha = 1;
        } else {
          ctx.strokeStyle = color.solid;
          ctx.globalAlpha = s.opacity;
        }

        ctx.beginPath();
        ctx.moveTo(first.x, first.y);
        for (let i = 1; i < pts.length - 1; i++) {
          const a = pts[i];
          const b = pts[i + 1];
          ctx.quadraticCurveTo(a.x, a.y, (a.x + b.x) / 2, (a.y + b.y) / 2);
        }
        if (last) ctx.lineTo(last.x, last.y);
        ctx.stroke();
      }
      if (fadingIn) ctx.setLineDash([]);

      if (s.particlesOn && s.particleCount > 0 && intro >= 1) {
        ctx.globalAlpha = 1;
        const per = Math.floor(s.particleCount);
        for (let ribbon = 0; ribbon < s.count; ribbon++) {
          if (s.particleRandom && hash(ribbon, 7, s.particleSeed) > s.particleSparse) {
            continue;
          }
          const pts = pointCache[ribbon];
          if (!pts) continue;
          for (let i = 0; i < per; i++) {
            const prog = particleProgress(ribbon, i, time, s);
            if (!prog) continue;
            const [px, py, tx, ty] = sampleAt(pts, prog.u);
            let scale = 1;
            if (s.particleVariance > 0) {
              const e = hash(ribbon, 31 * i + 5, s.particleSeed);
              scale = Math.max(0.1, 1 - s.particleVariance + 2 * e * s.particleVariance);
            }
            const colorList = s.particleColors.length ? s.particleColors : ['#ffffff'];
            const cIdx =
              Math.floor(hash(ribbon, 19 * i + 11, s.particleSeed) * colorList.length) %
              colorList.length;
            const pColor = colorList[cIdx] ?? '#ffffff';
            const g = Math.hypot(tx, ty) || 1;
            const vx = tx / g;
            const vy = ty / g;
            const half = s.particleLength / 2;
            const x0 = px - vx * half;
            const y0 = py - vy * half;
            const x1 = px + vx * half;
            const y1 = py + vy * half;
            ctx.lineWidth = s.particleSize * scale;
            if (s.particleFade) {
              let pair = particleFadePairs.get(pColor);
              if (!pair) {
                pair = [rgba(pColor, 0), rgba(pColor, 1)];
                particleFadePairs.set(pColor, pair);
              }
              const grad = ctx.createLinearGradient(x0, y0, x1, y1);
              grad.addColorStop(0, pair[0]);
              grad.addColorStop(1, pair[1]);
              ctx.strokeStyle = grad;
            } else {
              ctx.strokeStyle = pColor;
            }
            ctx.globalAlpha = prog.fade;
            ctx.beginPath();
            ctx.moveTo(x0, y0);
            ctx.lineTo(x1, y1);
            ctx.stroke();
          }
        }
        ctx.lineWidth = s.strokeWidth;
      }
      ctx.globalAlpha = 1;
    };

    const maxDpr = 2;
    // Cover-scale the fixed design space onto the live canvas, then render.
    const paint = (time: number, intro: number) => {
      const s = settingsRef.current;
      const cover = Math.max(canvas.width / s.width, canvas.height / s.height);
      const ox = (canvas.width - s.width * cover) / 2;
      const oy = (canvas.height - s.height * cover) / 2;
      ctx.setTransform(cover, 0, 0, cover, ox, oy);
      render(time, intro);
    };

    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      if (prefersReducedMotion) paint(0, 1);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    if (prefersReducedMotion) {
      return () => observer.disconnect();
    }

    let raf = 0;
    let running = false;
    let startTs = 0;
    let introTs = 0;
    let pausedAt = 0;
    let introDone = false;

    const frame = (now: number) => {
      if (startTs === 0) startTs = now;
      if (introTs === 0) introTs = now;
      const time = ((now - startTs) / 1000) * settingsRef.current.speed;
      let intro = 1;
      if (!introDone) {
        intro = Math.min((now - introTs) / 1500, 1);
        if (intro >= 1) introDone = true;
      }
      paint(time, intro);
      raf = requestAnimationFrame(frame);
    };

    const stop = () => {
      if (!running) return;
      running = false;
      cancelAnimationFrame(raf);
      pausedAt = performance.now();
    };

    // Pause the loop while the hero is scrolled out of view.
    const visibility = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          if (running) return;
          running = true;
          if (pausedAt) {
            const delta = performance.now() - pausedAt;
            startTs += delta;
            if (introTs) introTs += delta;
          }
          raf = requestAnimationFrame(frame);
        } else {
          stop();
        }
      },
      { rootMargin: '10% 0px' },
    );
    visibility.observe(canvas);

    return () => {
      stop();
      visibility.disconnect();
      observer.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden='true'
      className='pointer-events-none absolute inset-0 -z-10 size-full'
    />
  );
}
