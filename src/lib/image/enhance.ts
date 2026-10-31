import { downscale, maxFilter, otsu, type Gray, type Quad } from './gray';
import { connectedComponents } from './labels';

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
