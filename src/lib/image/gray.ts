/** A single-channel 8-bit image. 0 is black, 255 is white. */
export interface Gray {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export interface Point {
  x: number;
  y: number;
}

/** Corners in clockwise order starting top left. */
export type Quad = [Point, Point, Point, Point];

export function toGray(rgba: Uint8ClampedArray, width: number, height: number): Gray {
  const data = new Uint8ClampedArray(width * height);
  for (let i = 0, j = 0; i < data.length; i++, j += 4) {
    data[i] = (rgba[j] * 77 + rgba[j + 1] * 150 + rgba[j + 2] * 29) >> 8;
  }
  return { width, height, data };
}

export function grayToRgba(g: Gray): Uint8ClampedArray<ArrayBuffer> {
  const out = new Uint8ClampedArray(g.width * g.height * 4);
  for (let i = 0, j = 0; i < g.data.length; i++, j += 4) {
    out[j] = out[j + 1] = out[j + 2] = g.data[i];
    out[j + 3] = 255;
  }
  return out;
}

/** Box-downscale so the longer side is at most `max` pixels. */
export function downscale(g: Gray, max: number): Gray {
  const f = Math.max(g.width, g.height) / max;
  if (f <= 1) return g;
  const width = Math.max(1, Math.round(g.width / f));
  const height = Math.max(1, Math.round(g.height / f));
  const data = new Uint8ClampedArray(width * height);
  for (let y = 0; y < height; y++) {
    const y0 = Math.floor(y * f);
    const y1 = Math.min(g.height, Math.max(y0 + 1, Math.floor((y + 1) * f)));
    for (let x = 0; x < width; x++) {
      const x0 = Math.floor(x * f);
      const x1 = Math.min(g.width, Math.max(x0 + 1, Math.floor((x + 1) * f)));
      let sum = 0;
      for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) sum += g.data[yy * g.width + xx];
      data[y * width + x] = sum / ((y1 - y0) * (x1 - x0));
    }
  }
  return { width, height, data };
}

/** Mean filter with a square window of side 2r+1, via a summed-area table. */
export function boxBlur(g: Gray, r: number): Gray {
  const { width: w, height: h } = g;
  const sat = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += g.data[y * w + x];
      sat[(y + 1) * (w + 1) + x + 1] = sat[y * (w + 1) + x + 1] + row;
    }
  }
  const data = new Uint8ClampedArray(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r);
    const y1 = Math.min(h, y + r + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r);
      const x1 = Math.min(w, x + r + 1);
      const s = sat[y1 * (w + 1) + x1] - sat[y0 * (w + 1) + x1] - sat[y1 * (w + 1) + x0] + sat[y0 * (w + 1) + x0];
      data[y * w + x] = s / ((y1 - y0) * (x1 - x0));
    }
  }
  return { width: w, height: h, data };
}

/** Grayscale dilation (local maximum) with a square window, separable. Removes thin dark lines. */
export function maxFilter(g: Gray, r: number): Gray {
  const { width: w, height: h } = g;
  const tmp = new Uint8ClampedArray(w * h);
  const data = new Uint8ClampedArray(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let m = 0;
      for (let k = Math.max(0, x - r); k <= Math.min(w - 1, x + r); k++) m = Math.max(m, g.data[y * w + k]);
      tmp[y * w + x] = m;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let m = 0;
      for (let k = Math.max(0, y - r); k <= Math.min(h - 1, y + r); k++) m = Math.max(m, tmp[k * w + x]);
      data[y * w + x] = m;
    }
  }
  return { width: w, height: h, data };
}

/** Otsu's threshold for a gray image. */
export function otsu(g: Gray): number {
  const hist = new Float64Array(256);
  for (const v of g.data) hist[v]++;
  const total = g.data.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0;
  let wB = 0;
  let best = 0;
  let threshold = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) ** 2;
    if (between > best) {
      best = between;
      threshold = t;
    }
  }
  return threshold;
}
