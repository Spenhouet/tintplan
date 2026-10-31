/**
 * Connected components with 4-connectivity. Pixels where `on[i]` is nonzero are labeled 1..count,
 * the rest get 0.
 */
export function connectedComponents(
  on: Uint8Array,
  width: number,
  height: number
): { labels: Int32Array; count: number; areas: Int32Array } {
  const n = width * height;
  const labels = new Int32Array(n);
  const parent = [0];
  const find = (a: number) => {
    while (parent[a] !== a) {
      parent[a] = parent[parent[a]];
      a = parent[a];
    }
    return a;
  };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (!on[i]) continue;
      const left = x > 0 ? labels[i - 1] : 0;
      const up = y > 0 ? labels[i - width] : 0;
      if (left && up) {
        const a = find(left);
        const b = find(up);
        labels[i] = Math.min(a, b);
        if (a !== b) parent[Math.max(a, b)] = Math.min(a, b);
      } else if (left || up) {
        labels[i] = left || up;
      } else {
        labels[i] = parent.length;
        parent.push(parent.length);
      }
    }
  }
  // Compact the roots to 1..count in scan order
  const remap = new Int32Array(parent.length);
  let count = 0;
  for (let l = 1; l < parent.length; l++) {
    const r = find(l);
    remap[l] = r === l ? ++count : remap[r];
  }
  const areas = new Int32Array(count + 1);
  for (let i = 0; i < n; i++) {
    if (labels[i]) {
      labels[i] = remap[labels[i]];
      areas[labels[i]]++;
    }
  }
  return { labels, count, areas };
}

/**
 * Chamfer (3-4) distance from every pixel to the nearest seed pixel, in pixels.
 * Accurate to a few percent, which is plenty for gap closing.
 */
export function distanceToSeeds(seed: Uint8Array, width: number, height: number): Float32Array {
  const INF = 1e9;
  const d = new Float32Array(width * height);
  for (let i = 0; i < d.length; i++) d[i] = seed[i] ? 0 : INF;
  chamfer(d, width, height, null);
  for (let i = 0; i < d.length; i++) d[i] /= 3;
  return d;
}

/**
 * For each pixel with a nonzero label, the distance to the nearest pixel with a different label
 * (or the image border). Used to find the spot in an area that is furthest from its outline.
 */
export function distanceInsideRegions(labels: Int32Array, width: number, height: number): Float32Array {
  const d = new Float32Array(width * height);
  for (let i = 0; i < d.length; i++) d[i] = labels[i] ? 1e9 : 0;
  chamfer(d, width, height, labels);
  for (let i = 0; i < d.length; i++) d[i] /= 3;
  return d;
}

/**
 * Two-pass 3-4 chamfer transform in place. With `labels`, a neighbor only propagates its distance
 * if it carries the same label; a neighbor with another label (or outside the image) counts as
 * distance 0.
 */
function chamfer(d: Float32Array, w: number, h: number, labels: Int32Array | null) {
  const step = (i: number, x: number, y: number, dx: number, dy: number, cost: number) => {
    const nx = x + dx;
    const ny = y + dy;
    let base: number;
    if (nx < 0 || ny < 0 || nx >= w || ny >= h) {
      if (!labels) return;
      base = 0;
    } else {
      const j = ny * w + nx;
      base = labels && labels[j] !== labels[i] ? 0 : d[j];
    }
    if (base + cost < d[i]) d[i] = base + cost;
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (d[i] === 0) continue;
      step(i, x, y, -1, 0, 3);
      step(i, x, y, -1, -1, 4);
      step(i, x, y, 0, -1, 3);
      step(i, x, y, 1, -1, 4);
    }
  }
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      if (d[i] === 0) continue;
      step(i, x, y, 1, 0, 3);
      step(i, x, y, 1, 1, 4);
      step(i, x, y, 0, 1, 3);
      step(i, x, y, -1, 1, 4);
    }
  }
}

/**
 * Spread labels into unlabeled pixels (label 0) by breadth-first search, so every pixel ends up
 * with the label of the nearest labeled pixel.
 */
export function growLabels(labels: Int32Array, width: number, height: number): void {
  const n = width * height;
  let queue = new Int32Array(n);
  let next = new Int32Array(n);
  let len = 0;
  for (let i = 0; i < n; i++) {
    if (!labels[i]) continue;
    const x = i % width;
    if (
      (x > 0 && !labels[i - 1]) ||
      (x < width - 1 && !labels[i + 1]) ||
      (i >= width && !labels[i - width]) ||
      (i < n - width && !labels[i + width])
    ) {
      queue[len++] = i;
    }
  }
  while (len) {
    let nextLen = 0;
    for (let k = 0; k < len; k++) {
      const i = queue[k];
      const l = labels[i];
      const x = i % width;
      if (x > 0 && !labels[i - 1]) {
        labels[i - 1] = l;
        next[nextLen++] = i - 1;
      }
      if (x < width - 1 && !labels[i + 1]) {
        labels[i + 1] = l;
        next[nextLen++] = i + 1;
      }
      if (i >= width && !labels[i - width]) {
        labels[i - width] = l;
        next[nextLen++] = i - width;
      }
      if (i < n - width && !labels[i + width]) {
        labels[i + width] = l;
        next[nextLen++] = i + width;
      }
    }
    [queue, next] = [next, queue];
    len = nextLen;
  }
}
