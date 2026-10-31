import type { Gray, Point, Quad } from './gray';

/** Solve the 8 homography coefficients mapping the unit square to `q` (Heckbert's square-to-quad). */
function squareToQuad(q: Quad): number[] {
  const [p0, p1, p2, p3] = q;
  const dx1 = p1.x - p2.x;
  const dx2 = p3.x - p2.x;
  const dy1 = p1.y - p2.y;
  const dy2 = p3.y - p2.y;
  const sx = p0.x - p1.x + p2.x - p3.x;
  const sy = p0.y - p1.y + p2.y - p3.y;
  let g = 0;
  let h = 0;
  if (Math.abs(sx) > 1e-9 || Math.abs(sy) > 1e-9) {
    const den = dx1 * dy2 - dx2 * dy1;
    g = (sx * dy2 - dx2 * sy) / den;
    h = (dx1 * sy - sx * dy1) / den;
  }
  return [
    p1.x - p0.x + g * p1.x,
    p3.x - p0.x + h * p3.x,
    p0.x,
    p1.y - p0.y + g * p1.y,
    p3.y - p0.y + h * p3.y,
    p0.y,
    g,
    h
  ];
}

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/** Output size for straightening `q`, capped so the longer side is at most `max`. */
export function warpSize(q: Quad, max: number): { width: number; height: number } {
  const w = Math.max(dist(q[0], q[1]), dist(q[3], q[2]));
  const h = Math.max(dist(q[0], q[3]), dist(q[1], q[2]));
  const f = Math.min(1, max / Math.max(w, h));
  return { width: Math.max(1, Math.round(w * f)), height: Math.max(1, Math.round(h * f)) };
}

/** Straighten the quadrilateral `q` of `src` into a `width` x `height` rectangle, bilinear sampling. */
export function warp(src: Gray, q: Quad, width: number, height: number): Gray {
  const [a, b, c, d, e, f, g, h] = squareToQuad(q);
  const out = new Uint8ClampedArray(width * height);
  const sw = src.width;
  const sh = src.height;
  const s = src.data;
  for (let y = 0; y < height; y++) {
    const v = (y + 0.5) / height;
    for (let x = 0; x < width; x++) {
      const u = (x + 0.5) / width;
      const w = g * u + h * v + 1;
      const fx = Math.min(sw - 1, Math.max(0, (a * u + b * v + c) / w - 0.5));
      const fy = Math.min(sh - 1, Math.max(0, (d * u + e * v + f) / w - 0.5));
      const x0 = Math.floor(fx);
      const y0 = Math.floor(fy);
      const x1 = Math.min(sw - 1, x0 + 1);
      const y1 = Math.min(sh - 1, y0 + 1);
      const tx = fx - x0;
      const ty = fy - y0;
      const top = s[y0 * sw + x0] * (1 - tx) + s[y0 * sw + x1] * tx;
      const bottom = s[y1 * sw + x0] * (1 - tx) + s[y1 * sw + x1] * tx;
      out[y * width + x] = top * (1 - ty) + bottom * ty;
    }
  }
  return { width, height, data: out };
}

export function fullQuad(width: number, height: number): Quad {
  return [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height }
  ];
}

/** Like `warp`, for RGBA pixels. */
export function warpRgba(
  src: Uint8ClampedArray,
  sw: number,
  sh: number,
  q: Quad,
  width: number,
  height: number
): Uint8ClampedArray<ArrayBuffer> {
  const [a, b, c, d, e, f, g, h] = squareToQuad(q);
  const out = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    const v = (y + 0.5) / height;
    for (let x = 0; x < width; x++) {
      const u = (x + 0.5) / width;
      const w = g * u + h * v + 1;
      const fx = Math.min(sw - 1, Math.max(0, (a * u + b * v + c) / w - 0.5));
      const fy = Math.min(sh - 1, Math.max(0, (d * u + e * v + f) / w - 0.5));
      const x0 = Math.floor(fx);
      const y0 = Math.floor(fy);
      const x1 = Math.min(sw - 1, x0 + 1);
      const y1 = Math.min(sh - 1, y0 + 1);
      const tx = fx - x0;
      const ty = fy - y0;
      const i00 = (y0 * sw + x0) * 4;
      const i01 = (y0 * sw + x1) * 4;
      const i10 = (y1 * sw + x0) * 4;
      const i11 = (y1 * sw + x1) * 4;
      const o = (y * width + x) * 4;
      for (let k = 0; k < 3; k++) {
        const top = src[i00 + k] * (1 - tx) + src[i01 + k] * tx;
        const bottom = src[i10 + k] * (1 - tx) + src[i11 + k] * tx;
        out[o + k] = top * (1 - ty) + bottom * ty;
      }
      out[o + 3] = 255;
    }
  }
  return out;
}
