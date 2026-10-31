import type { Gray } from './gray';
import { connectedComponents, distanceInsideRegions, distanceToSeeds, growLabels } from './labels';

/** Pixels darker than this count as line. */
export const LINE_THRESHOLD = 128;

export interface Region {
  /** White pixels in the area (lines excluded). */
  area: number;
  /** Center of the largest circle that fits inside the area, and its radius. Labels go here. */
  x: number;
  y: number;
  r: number;
}

export interface Segmentation {
  width: number;
  height: number;
  /** Region per pixel, 1..count. Lines belong to the nearest region, so fills reach under them. */
  labels: Int32Array;
  count: number;
  /** Index 0 is unused. */
  regions: Region[];
  /** Pixels of region k are `pixels[offsets[k] .. offsets[k+1]]`, for fast repainting. */
  offsets: Int32Array;
  pixels: Int32Array;
  /** Data for the area scan animation, see `scanMap`. */
  scan: ScanMap;
}

/**
 * Half-resolution RGBA texture for the scan animation:
 * R when the area lights up (its label spot's height, 0 top to 255 bottom),
 * G distance to the area's outline in pixels (0 on lines, capped at 255),
 * B the area's hue, A how strongly it is tinted (large areas less, 0 where there is no area).
 */
export interface ScanMap {
  width: number;
  height: number;
  data: Uint8Array;
}

/**
 * Split line art into fillable areas.
 *
 * `gap` closes breaks in lines up to about twice that many pixels: areas are found on a copy
 * with lines thickened by `gap`, then grown back up to the real lines. White pieces that the
 * thickening swallowed completely (narrow strips) become areas of their own.
 */
export function segment(line: Gray, gap: number, minArea = 0): Segmentation {
  const { width, height } = line;
  const n = width * height;
  const isLine = new Uint8Array(n);
  for (let i = 0; i < n; i++) isLine[i] = line.data[i] < LINE_THRESHOLD ? 1 : 0;

  const open = new Uint8Array(n);
  if (gap > 0) {
    const d = distanceToSeeds(isLine, width, height);
    for (let i = 0; i < n; i++) open[i] = d[i] > gap ? 1 : 0;
  } else {
    for (let i = 0; i < n; i++) open[i] = isLine[i] ? 0 : 1;
  }
  const { labels, count: coreCount } = connectedComponents(open, width, height);
  let count = coreCount;

  // White pieces without any core pixel become their own areas
  const white = new Uint8Array(n);
  for (let i = 0; i < n; i++) white[i] = isLine[i] ? 0 : 1;
  const pieces = connectedComponents(white, width, height);
  const hasCore = new Uint8Array(pieces.count + 1);
  for (let i = 0; i < n; i++) if (labels[i]) hasCore[pieces.labels[i]] = 1;
  const extra = new Int32Array(pieces.count + 1);
  for (let p = 1; p <= pieces.count; p++) if (!hasCore[p]) extra[p] = ++count;
  for (let i = 0; i < n; i++) {
    const p = pieces.labels[i];
    if (p && !hasCore[p]) labels[i] = extra[p];
  }

  // Grow into the white border pixels first, so areas meet at the lines, then under the lines
  const whiteOnly = new Int32Array(n);
  for (let i = 0; i < n; i++) whiteOnly[i] = isLine[i] ? -1 : labels[i];
  growLabels(whiteOnly, width, height);
  for (let i = 0; i < n; i++) labels[i] = whiteOnly[i] > 0 ? whiteOnly[i] : 0;

  // Specks of paper smaller than `minArea` (texture, shading leftovers) join their neighbors
  if (minArea > 0) {
    const areas = new Int32Array(count + 1);
    for (let i = 0; i < n; i++) areas[labels[i]]++;
    const remap = new Int32Array(count + 1);
    let kept = 0;
    for (let l = 1; l <= count; l++) if (areas[l] >= minArea) remap[l] = ++kept;
    for (let i = 0; i < n; i++) labels[i] = remap[labels[i]];
    count = kept;
  }
  const inside = labels.slice();
  growLabels(labels, width, height);

  // Label spot: among the pixels nearly as far from the outline as the furthest one, the one
  // closest to the area's center of mass. Keeps labels centered in long or symmetric areas.
  const dist = distanceInsideRegions(inside, width, height);
  const regions: Region[] = Array.from({ length: count + 1 }, () => ({ area: 0, x: 0, y: 0, r: 0 }));
  const sumX = new Float64Array(count + 1);
  const sumY = new Float64Array(count + 1);
  for (let i = 0; i < n; i++) {
    const l = inside[i];
    if (!l) continue;
    const reg = regions[l];
    reg.area++;
    sumX[l] += i % width;
    sumY[l] += (i / width) | 0;
    if (dist[i] > reg.r) reg.r = dist[i];
  }
  const bestD = new Float64Array(count + 1).fill(Infinity);
  for (let i = 0; i < n; i++) {
    const l = inside[i];
    if (!l) continue;
    const reg = regions[l];
    if (dist[i] < reg.r - Math.max(1, 0.1 * reg.r)) continue;
    const x = i % width;
    const y = (i / width) | 0;
    const d = (x - sumX[l] / reg.area) ** 2 + (y - sumY[l] / reg.area) ** 2;
    if (d < bestD[l]) {
      bestD[l] = d;
      reg.x = x;
      reg.y = y;
    }
  }
  for (let i = 0; i < n; i++) {
    const l = inside[i];
    if (l && regions[l].x === i % width && regions[l].y === ((i / width) | 0)) regions[l].r = dist[i];
  }

  const offsets = new Int32Array(count + 2);
  for (let i = 0; i < n; i++) offsets[labels[i] + 1]++;
  for (let k = 1; k < offsets.length; k++) offsets[k] += offsets[k - 1];
  const fill = offsets.slice(0, count + 1);
  const pixels = new Int32Array(n);
  for (let i = 0; i < n; i++) pixels[fill[labels[i]]++] = i;

  return {
    width,
    height,
    labels,
    count,
    regions,
    offsets,
    pixels,
    scan: scanMap(labels, dist, regions, width, height)
  };
}

function scanMap(labels: Int32Array, dist: Float32Array, regions: Region[], width: number, height: number): ScanMap {
  const f = 2;
  const w = Math.max(1, Math.floor(width / f));
  const h = Math.max(1, Math.floor(height / f));
  const data = new Uint8Array(w * h * 4);
  // Golden-angle hues, so neighboring areas get clearly different colors
  const hue = (k: number) => Math.round(((k * 0.618034) % 1) * 255);
  // Small areas glow fully, areas covering a quarter of the page or more only faintly
  const total = width * height;
  const weight = regions.map((r) => Math.round(255 * Math.min(1, Math.max(0.2, 1.1 - (r.area / total) * 3.5))));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * f * width + x * f;
      const l = labels[i];
      const j = (y * w + x) * 4;
      if (!l) continue;
      data[j] = Math.round((regions[l].y / height) * 255);
      data[j + 1] = Math.min(255, Math.round(dist[i]));
      data[j + 2] = hue(l);
      data[j + 3] = weight[l];
    }
  }
  return { width: w, height: h, data };
}
