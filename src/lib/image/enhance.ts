import { boxBlur, downscale, maxFilter, otsu, type Gray, type Quad } from './gray';
import { connectedComponents } from './labels';

export interface EnhanceOptions {
  /** 0 keeps more gray detail, 1 gives harder, bolder lines. */
  strength: number;
  /** Remove dark specks smaller than this many pixels. */
  speck: number;
}

/**
 * Turn a phone photo of line art into clean black lines on white paper.
 *
 * 1. Estimate the paper brightness everywhere (lines removed by a max filter, then blurred) and
 *    divide by it. This removes shadows, vignetting and the yellow tint of the light.
 * 2. Stretch the levels so paper becomes pure white and lines become black, keeping a soft edge
 *    so lines stay smooth.
 * 3. Remove isolated specks (paper texture, dust).
 */
export function enhance(src: Gray, { strength, speck }: EnhanceOptions): Gray {
  const { width, height } = src;
  const n = width * height;
  const factor = 4;
  const small = downscale(src, Math.max(1, Math.ceil(Math.max(width, height) / factor)));
  const r = Math.max(2, Math.round(Math.max(small.width, small.height) / 120));
  const bg = boxBlur(maxFilter(small, r), r * 2);

  const norm = new Uint8ClampedArray(n);
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
      norm[i] = (src.data[i] * 255) / Math.max(b, 1);
    }
  }

  // Lines are what Otsu calls dark; the white point sits a bit below paper white
  const t = otsu({ width, height, data: norm });
  const s = Math.min(1, Math.max(0, strength));
  const hi = Math.min(250, Math.max(t + 20, 235 - 35 * s));
  const lo = Math.max(0, Math.min(hi - 20, t * (0.6 + 0.4 * s)));
  const out = new Uint8ClampedArray(n);
  for (let i = 0; i < n; i++) {
    const v = (norm[i] - lo) / (hi - lo);
    out[i] = v <= 0 ? 0 : v >= 1 ? 255 : 255 * v * v * (3 - 2 * v);
  }
  const result = { width, height, data: out };
  if (speck > 0) removeSpecks(result, speck);
  return result;
}

/** Whiten dark connected blobs smaller than `minArea` pixels. */
export function removeSpecks(g: Gray, minArea: number): void {
  const n = g.width * g.height;
  const dark = new Uint8Array(n);
  for (let i = 0; i < n; i++) dark[i] = g.data[i] < 160 ? 1 : 0;
  const { labels, areas } = connectedComponents(dark, g.width, g.height);
  for (let i = 0; i < n; i++) if (labels[i] && areas[labels[i]] < minArea) g.data[i] = 255;
}

/**
 * Find the sheet of paper in a photo: the largest bright blob, after wiping out the lines.
 * Returns its corners in `src` coordinates, or null when no clear page stands out.
 */
export function detectPage(src: Gray): Quad | null {
  const small = downscale(src, 400);
  const { width: w, height: h } = small;
  const cleaned = maxFilter(small, 3);
  const t = otsu(cleaned);
  const bright = new Uint8Array(w * h);
  for (let i = 0; i < bright.length; i++) bright[i] = cleaned.data[i] > t ? 1 : 0;
  const { labels, count, areas } = connectedComponents(bright, w, h);
  if (!count) return null;
  let best = 1;
  for (let l = 2; l <= count; l++) if (areas[l] > areas[best]) best = l;
  if (areas[best] < 0.15 * w * h) return null;

  let tl = { x: 0, y: 0, v: Infinity };
  let tr = { x: 0, y: 0, v: -Infinity };
  let br = { x: 0, y: 0, v: -Infinity };
  let bl = { x: 0, y: 0, v: Infinity };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (labels[y * w + x] !== best) continue;
      if (x + y < tl.v) tl = { x, y, v: x + y };
      if (x + y > br.v) br = { x, y, v: x + y };
      if (x - y > tr.v) tr = { x, y, v: x - y };
      if (x - y < bl.v) bl = { x, y, v: x - y };
    }
  }
  // The max filter grew the page by its radius; pull the corners back in by as much
  const fx = src.width / w;
  const fy = src.height / h;
  const inset = 3;
  const quad = [
    { x: tl.x + inset, y: tl.y + inset },
    { x: tr.x + 1 - inset, y: tr.y + inset },
    { x: br.x + 1 - inset, y: br.y + 1 - inset },
    { x: bl.x + inset, y: bl.y + 1 - inset }
  ].map((p) => ({
    x: Math.min(src.width, Math.max(0, p.x * fx)),
    y: Math.min(src.height, Math.max(0, p.y * fy))
  })) as Quad;
  // A page filling the whole frame needs no cropping
  const margin = Math.max(0.02 * Math.max(src.width, src.height), (inset + 1) * Math.max(fx, fy));
  const full =
    quad[0].x < margin &&
    quad[0].y < margin &&
    quad[2].x > src.width - margin &&
    quad[2].y > src.height - margin &&
    quad[1].x > src.width - margin &&
    quad[3].y > src.height - margin;
  return full ? null : quad;
}
