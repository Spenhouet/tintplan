import { boxBlur, downscale, type Gray } from './gray';
import { connectedComponents, distanceToSeeds } from './labels';

export interface LineOptions {
  /** 0 keeps only clear, dark outlines; 1 also picks up faint lines. */
  strength: number;
  /** Remove line blobs smaller than this many pixels. */
  speck: number;
}

/**
 * Find the outlines of a coloring page, also when the page is already colored or shaded.
 *
 * 1. Brightness is the strongest channel (max of R, G, B): black ink is dark in every channel,
 *    while colored fills are bright in at least one, so colors drop out before anything else.
 * 2. Uneven light is divided out using a heavily smoothed estimate of the paper.
 * 3. Outlines are thin and darker than both of their sides. A morphological closing (max then
 *    min filter, wider than the lines) paints over the lines with their surroundings; how much
 *    darker a pixel is than that closing measures how "line-like" it is. Shading, gradients and
 *    fills are wider than the filter, so they don't respond, whatever their color.
 * 4. Pixels that are nearly black count as outline regardless of their width (thick borders,
 *    solid black details).
 *
 * Returns an anti-aliased mask: 0 on outlines, 255 elsewhere.
 */
export function extractLines(rgba: Uint8ClampedArray, width: number, height: number, opts: LineOptions): Gray {
  const n = width * height;
  const v = new Uint8ClampedArray(n);
  for (let i = 0, j = 0; i < n; i++, j += 4) v[i] = Math.max(rgba[j], rgba[j + 1], rgba[j + 2]);
  const norm = flattenLight({ width, height, data: v });

  const half = strokeHalfWidth(norm);
  const r = Math.min(Math.max(2, Math.ceil(half * 2.2) + 1), Math.ceil(Math.max(width, height) / 50));
  const closed = morph(morph(norm, r, true), r, false);

  const s = Math.min(1, Math.max(0, opts.strength));
  // Relative darkness against the surroundings, and absolute darkness
  const rLo = 0.42 - 0.27 * s;
  const rHi = rLo + 0.2;
  const aLo = 0.72 - 0.17 * s;
  const aHi = aLo + 0.14;
  // Faint line pixels only count when connected to clear ones (hysteresis): outlines keep going
  // where they cross dark shading, while isolated shading strokes are dropped.
  const rWeak = 0.5 * rLo + 0.05;
  const out = new Uint8ClampedArray(n);
  const weak = new Uint8Array(n);
  const queue = new Int32Array(n);
  let len = 0;
  for (let i = 0; i < n; i++) {
    const c = closed.data[i];
    const p = norm.data[i];
    const rel = c > 0 ? (c - p) / c : 0;
    const dark = 1 - p / 255;
    const score = Math.max(smooth(rLo, rHi, rel), smooth(aLo, aHi, dark));
    out[i] = 255 * (1 - score);
    if (score >= 0.5) queue[len++] = i;
    else if (rel >= rWeak) weak[i] = 1;
  }
  for (let k = 0; k < len; k++) {
    const i = queue[k];
    const x = i % width;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if ((!dx && !dy) || x + dx < 0 || x + dx >= width) continue;
        const j = i + dy * width + dx;
        if (j < 0 || j >= n || !weak[j]) continue;
        weak[j] = 0;
        out[j] = Math.min(out[j], 70);
        queue[len++] = j;
      }
    }
  }
  const lines = { width, height, data: out };
  if (opts.speck > 0) dropSmallBlobs(lines, opts.speck);
  return lines;
}

function smooth(lo: number, hi: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - lo) / (hi - lo)));
  return t * t * (3 - 2 * t);
}

/** Divide by a smooth estimate of the paper brightness, so paper becomes white everywhere. */
export function flattenLight(src: Gray): Gray {
  const { width, height } = src;
  const small = downscale(src, Math.max(1, Math.ceil(Math.max(width, height) / 4)));
  const r = Math.max(2, Math.round(Math.max(small.width, small.height) / 60));
  const bg = boxBlur(morph(small, r, true), r * 2);
  const data = new Uint8ClampedArray(width * height);
  const sx = bg.width / width;
  const sy = bg.height / height;
  for (let y = 0; y < height; y++) {
    const fy = Math.min(bg.height - 1, Math.max(0, (y + 0.5) * sy - 0.5));
    const y0 = Math.floor(fy);
    const y1 = Math.min(bg.height - 1, y0 + 1);
    const ty = fy - y0;
    for (let x = 0; x < width; x++) {
      const fx = Math.min(bg.width - 1, Math.max(0, (x + 0.5) * sx - 0.5));
      const x0 = Math.floor(fx);
      const x1 = Math.min(bg.width - 1, x0 + 1);
      const tx = fx - x0;
      const b =
        (bg.data[y0 * bg.width + x0] * (1 - tx) + bg.data[y0 * bg.width + x1] * tx) * (1 - ty) +
        (bg.data[y1 * bg.width + x0] * (1 - tx) + bg.data[y1 * bg.width + x1] * tx) * ty;
      const i = y * width + x;
      data[i] = (src.data[i] * 255) / Math.max(b, 1);
    }
  }
  return { width, height, data };
}

/**
 * Typical half width of the outlines in pixels: the median ridge height of the distance
 * transform inside clearly dark pixels.
 */
export function strokeHalfWidth(g: Gray): number {
  const { width, height } = g;
  const n = width * height;
  const light = new Uint8Array(n);
  let dark = 0;
  for (let i = 0; i < n; i++) {
    light[i] = g.data[i] < 110 ? 0 : 1;
    if (!light[i]) dark++;
  }
  if (dark < 50) return 1.5;
  const d = distanceToSeeds(light, width, height);
  const hist = new Uint32Array(64);
  let count = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const v = d[i];
      if (v <= 0) continue;
      // Ridge: not smaller than the neighbors across in either direction
      const ridgeX = v >= d[i - 1] && v >= d[i + 1];
      const ridgeY = v >= d[i - width] && v >= d[i + width];
      if (!ridgeX && !ridgeY) continue;
      hist[Math.min(63, Math.round(v * 2))]++;
      count++;
    }
  }
  let acc = 0;
  for (let k = 0; k < 64; k++) {
    acc += hist[k];
    if (acc >= count / 2) return Math.max(0.5, k / 2);
  }
  return 1.5;
}

/**
 * Square max (`dilate`) or min filter of radius r, separable, in O(1) per pixel
 * (van Herk / Gil-Werman).
 */
export function morph(src: Gray, r: number, dilate: boolean): Gray {
  const { width: w, height: h } = src;
  const tmp = new Uint8ClampedArray(w * h);
  const out = new Uint8ClampedArray(w * h);
  pass(src.data, tmp, w, h, 1, w, r, dilate);
  pass(tmp, out, h, w, w, 1, r, dilate);
  return { width: w, height: h, data: out };
}

/** One 1-D pass over `lines` lines of `len` pixels, `step` apart, lines `stride` apart. */
function pass(
  src: Uint8ClampedArray,
  dst: Uint8ClampedArray,
  len: number,
  lines: number,
  step: number,
  stride: number,
  r: number,
  dilate: boolean
) {
  const k = 2 * r + 1;
  const pad = len + 2 * r;
  const g = new Uint8Array(pad + k);
  const hbuf = new Uint8Array(pad + k);
  const fill = dilate ? 0 : 255;
  const pick = dilate ? Math.max : Math.min;
  const line = new Uint8Array(pad);
  for (let l = 0; l < lines; l++) {
    const base = l * stride;
    line.fill(fill);
    for (let i = 0; i < len; i++) line[i + r] = src[base + i * step];
    for (let i = 0; i < pad; i++) g[i] = i % k === 0 ? line[i] : pick(g[i - 1], line[i]);
    for (let i = pad - 1; i >= 0; i--)
      hbuf[i] = i % k === k - 1 || i === pad - 1 ? line[i] : pick(hbuf[i + 1], line[i]);
    for (let i = 0; i < len; i++) dst[base + i * step] = pick(hbuf[i], g[i + 2 * r]);
  }
}

/** Whiten dark blobs smaller than `minArea` pixels. */
export function dropSmallBlobs(g: Gray, minArea: number): void {
  const n = g.width * g.height;
  const dark = new Uint8Array(n);
  for (let i = 0; i < n; i++) dark[i] = g.data[i] < 128 ? 1 : 0;
  const { labels, areas } = connectedComponents(dark, g.width, g.height);
  for (let i = 0; i < n; i++) if (labels[i] && areas[labels[i]] < minArea) g.data[i] = 255;
}
