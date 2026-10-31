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
}

/**
 * Split line art into fillable areas.
 *
 * `gap` closes breaks in lines up to about twice that many pixels: areas are found on a copy
 * with lines thickened by `gap`, then grown back up to the real lines. White pieces that the
 * thickening swallowed completely (narrow strips) become areas of their own.
 */
export function segment(line: Gray, gap: number): Segmentation {
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
  growWithin(whiteOnly, width, height);
  for (let i = 0; i < n; i++) labels[i] = whiteOnly[i] > 0 ? whiteOnly[i] : 0;
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

  return { width, height, labels, count, regions, offsets, pixels };
}

/** Like growLabels, but pixels marked -1 are walls that are never filled. */
function growWithin(labels: Int32Array, width: number, height: number) {
  const n = width * height;
  let queue: number[] = [];
  for (let i = 0; i < n; i++) {
    if (labels[i] <= 0) continue;
    const x = i % width;
    if (
      (x > 0 && labels[i - 1] === 0) ||
      (x < width - 1 && labels[i + 1] === 0) ||
      (i >= width && labels[i - width] === 0) ||
      (i < n - width && labels[i + width] === 0)
    ) {
      queue.push(i);
    }
  }
  while (queue.length) {
    const next: number[] = [];
    for (const i of queue) {
      const l = labels[i];
      const x = i % width;
      if (x > 0 && labels[i - 1] === 0) {
        labels[i - 1] = l;
        next.push(i - 1);
      }
      if (x < width - 1 && labels[i + 1] === 0) {
        labels[i + 1] = l;
        next.push(i + 1);
      }
      if (i >= width && labels[i - width] === 0) {
        labels[i - width] = l;
        next.push(i - width);
      }
      if (i < n - width && labels[i + width] === 0) {
        labels[i + width] = l;
        next.push(i + width);
      }
    }
    queue = next;
  }
}
