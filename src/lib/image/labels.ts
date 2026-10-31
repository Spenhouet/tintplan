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
 * distance 0. Written out by hand: this runs several times per page on millions of pixels.
 */
function chamfer(d: Float32Array, w: number, h: number, labels: Int32Array | null) {
  const edge = labels ? 0 : Infinity;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      let v = d[i];
      if (v === 0) continue;
      const l = labels ? labels[i] : 0;
      let b: number;
      b = x > 0 ? (labels && labels[i - 1] !== l ? 0 : d[i - 1]) : edge;
      if (b + 3 < v) v = b + 3;
      if (y > 0) {
        const up = i - w;
        b = labels && labels[up] !== l ? 0 : d[up];
        if (b + 3 < v) v = b + 3;
        b = x > 0 ? (labels && labels[up - 1] !== l ? 0 : d[up - 1]) : edge;
        if (b + 4 < v) v = b + 4;
        b = x < w - 1 ? (labels && labels[up + 1] !== l ? 0 : d[up + 1]) : edge;
        if (b + 4 < v) v = b + 4;
      } else if (edge === 0 && 3 < v) {
        v = 3;
      }
      d[i] = v;
    }
  }
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      let v = d[i];
      if (v === 0) continue;
      const l = labels ? labels[i] : 0;
      let b: number;
      b = x < w - 1 ? (labels && labels[i + 1] !== l ? 0 : d[i + 1]) : edge;
      if (b + 3 < v) v = b + 3;
      if (y < h - 1) {
        const dn = i + w;
        b = labels && labels[dn] !== l ? 0 : d[dn];
        if (b + 3 < v) v = b + 3;
        b = x < w - 1 ? (labels && labels[dn + 1] !== l ? 0 : d[dn + 1]) : edge;
        if (b + 4 < v) v = b + 4;
        b = x > 0 ? (labels && labels[dn - 1] !== l ? 0 : d[dn - 1]) : edge;
        if (b + 4 < v) v = b + 4;
      } else if (edge === 0 && 3 < v) {
        v = 3;
      }
      d[i] = v;
    }
  }
}

/**
 * Spread labels into unlabeled pixels (label 0) by breadth-first search, so every pixel ends up
 * with the label of the nearest labeled pixel. Pixels marked -1 are walls and stay as they are.
 */
export function growLabels(labels: Int32Array, width: number, height: number): void {
  const n = width * height;
  let queue = new Int32Array(n);
  let next = new Int32Array(n);
  let len = 0;
  for (let i = 0; i < n; i++) {
    if (labels[i] <= 0) continue;
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
