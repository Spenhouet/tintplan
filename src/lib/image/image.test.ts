import { describe, expect, it } from 'vitest';
import type { Gray } from './gray';
import { maxFilter, otsu } from './gray';
import { connectedComponents } from './labels';
import { segment } from './segment';
import { detectPage } from './enhance';
import { extractLines, morph } from './lines';
import { fullQuad, warp, warpSize } from './warp';
import { addChunk, crc32, pack, readChunk, unpack } from './png';
import { layoutLabel } from './label';

function canvas(width: number, height: number, value = 255): Gray {
  return { width, height, data: new Uint8ClampedArray(width * height).fill(value) };
}

function rect(g: Gray, x0: number, y0: number, x1: number, y1: number, value: number) {
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) g.data[y * g.width + x] = value;
}

/** A 100x100 page: outer frame, split into a left and right half by a vertical line. */
function twoBoxes(gapAt?: number): Gray {
  const g = canvas(100, 100);
  rect(g, 10, 10, 90, 13, 0);
  rect(g, 10, 87, 90, 90, 0);
  rect(g, 10, 10, 13, 90, 0);
  rect(g, 87, 10, 90, 90, 0);
  rect(g, 49, 10, 52, 90, 0);
  if (gapAt !== undefined) rect(g, 49, gapAt, 52, gapAt + 3, 255);
  return g;
}

describe('connectedComponents', () => {
  it('labels separate blobs', () => {
    const on = new Uint8Array([1, 1, 0, 1, 0, 0, 0, 1, 1, 0, 1, 1]);
    const { count, areas } = connectedComponents(on, 4, 3);
    expect(count).toBe(3);
    expect([...areas].slice(1).sort()).toEqual([1, 2, 4]);
  });

  it('merges a U shape into one label', () => {
    const on = new Uint8Array([1, 0, 1, 1, 0, 1, 1, 1, 1]);
    expect(connectedComponents(on, 3, 3).count).toBe(1);
  });
});

describe('segment', () => {
  it('finds outside, left and right areas', () => {
    const s = segment(twoBoxes(), 0);
    expect(s.count).toBe(3);
    const left = s.labels[50 * 100 + 30];
    const right = s.labels[50 * 100 + 70];
    expect(left).not.toBe(right);
    expect(s.labels[5 * 100 + 5]).not.toBe(left);
  });

  it('assigns every pixel, including lines, to an area', () => {
    const s = segment(twoBoxes(), 1);
    expect(s.labels.every((l) => l > 0)).toBe(true);
    expect(s.offsets[s.count + 1]).toBe(100 * 100);
  });

  it('closes small gaps in lines', () => {
    expect(segment(twoBoxes(40), 0).labels[50 * 100 + 30]).toBe(segment(twoBoxes(40), 0).labels[50 * 100 + 70]);
    const s = segment(twoBoxes(40), 2);
    expect(s.labels[50 * 100 + 30]).not.toBe(s.labels[50 * 100 + 70]);
  });

  it('keeps narrow strips that the gap closing swallowed', () => {
    const g = twoBoxes();
    rect(g, 13, 30, 49, 31, 0);
    rect(g, 13, 33, 49, 34, 0); // a 2 px strip between y=31 and y=33
    const s = segment(g, 3);
    const strip = s.labels[32 * 100 + 30];
    expect(strip).not.toBe(s.labels[20 * 100 + 30]);
    expect(strip).not.toBe(s.labels[60 * 100 + 30]);
  });

  it('puts the label spot in the middle of an area', () => {
    const s = segment(twoBoxes(), 1);
    const reg = s.regions[s.labels[50 * 100 + 30]];
    expect(reg.x).toBeGreaterThan(25);
    expect(reg.x).toBeLessThan(37);
    expect(reg.y).toBeGreaterThan(35);
    expect(reg.y).toBeLessThan(65);
    expect(reg.r).toBeGreaterThan(14);
  });

  it('lists the pixels of each area', () => {
    const s = segment(twoBoxes(), 1);
    for (let k = 1; k <= s.count; k++) {
      for (let j = s.offsets[k]; j < s.offsets[k + 1]; j++) expect(s.labels[s.pixels[j]]).toBe(k);
    }
  });
});

/** RGBA version of a gray page, with each area's interior painted by `paint(x, y)`. */
function rgba(g: Gray, paint?: (x: number, y: number) => [number, number, number] | null): Uint8ClampedArray {
  const out = new Uint8ClampedArray(g.width * g.height * 4);
  for (let y = 0; y < g.height; y++) {
    for (let x = 0; x < g.width; x++) {
      const i = y * g.width + x;
      const v = g.data[i];
      const c = v > 128 && paint ? paint(x, y) : null;
      out.set(c ? [...c, 255] : [v, v, v, 255], i * 4);
    }
  }
  return out;
}

describe('extractLines', () => {
  const opts = { strength: 0.55, speck: 0 };

  it('removes a shadow gradient and keeps lines', () => {
    const g = twoBoxes();
    const img = rgba(g, (x) => {
      const p = 230 - x * 1.1;
      return [p, p * 0.95, p * 0.85];
    });
    for (let y = 0; y < 100; y++)
      for (let x = 0; x < 100; x++) if (g.data[y * 100 + x] === 0) img.set([40, 38, 35], (y * 100 + x) * 4);
    const out = extractLines(img, 100, 100, opts);
    expect(out.data[50 * 100 + 30]).toBe(255);
    expect(out.data[50 * 100 + 80]).toBe(255);
    expect(out.data[50 * 100 + 50]).toBeLessThan(40);
  });

  it('ignores saturated and dark colored fills', () => {
    // Left box dark blue, right box deep red: both are fills, not lines
    const img = rgba(twoBoxes(), (x) => (x < 50 ? [20, 30, 140] : [150, 20, 25]));
    const out = extractLines(img, 100, 100, opts);
    expect(out.data[50 * 100 + 30]).toBe(255);
    expect(out.data[50 * 100 + 70]).toBe(255);
    expect(out.data[50 * 100 + 50]).toBeLessThan(40);
    const s = segment(out, 1);
    expect(s.labels[50 * 100 + 30]).not.toBe(s.labels[50 * 100 + 70]);
  });

  it('ignores gray shading inside an area', () => {
    // Graphite-like gradient from white to mid gray across the left box
    const img = rgba(twoBoxes(), (x) => {
      if (x >= 50) return null;
      const v = 250 - (x - 13) * 3.5;
      return [v, v, v];
    });
    const out = extractLines(img, 100, 100, opts);
    for (const x of [16, 25, 35, 45]) expect(out.data[50 * 100 + x]).toBeGreaterThan(200);
    const s = segment(out, 1);
    expect(s.labels[50 * 100 + 16]).toBe(s.labels[50 * 100 + 45]);
  });
});

describe('morph', () => {
  it('matches a naive max and min filter', () => {
    const g = canvas(37, 23);
    for (let i = 0; i < g.data.length; i++) g.data[i] = (i * 7919) % 251;
    for (const r of [1, 2, 5]) {
      const fast = morph(g, r, true);
      const naive = maxFilter(g, r);
      expect(fast.data).toEqual(naive.data);
      const min = morph(g, r, false);
      for (let y = 0; y < g.height; y++)
        for (let x = 0; x < g.width; x++) {
          let m = 255;
          for (let yy = Math.max(0, y - r); yy <= Math.min(g.height - 1, y + r); yy++)
            for (let xx = Math.max(0, x - r); xx <= Math.min(g.width - 1, x + r); xx++)
              m = Math.min(m, g.data[yy * g.width + xx]);
          expect(min.data[y * g.width + x]).toBe(m);
        }
    }
  });
});

describe('detectPage', () => {
  it('finds a bright page on a dark table', () => {
    const g = canvas(400, 300, 60);
    rect(g, 80, 50, 320, 260, 240);
    rect(g, 150, 100, 152, 200, 0);
    const q = detectPage(g);
    expect(q).not.toBeNull();
    expect(q![0].x).toBeCloseTo(80, -1);
    expect(q![0].y).toBeCloseTo(50, -1);
    expect(q![2].x).toBeCloseTo(320, -1);
    expect(q![2].y).toBeCloseTo(260, -1);
  });

  it('returns null when the page fills the frame', () => {
    expect(detectPage(twoBoxes())).toBeNull();
  });
});

describe('warp', () => {
  it('is the identity for the full quad', () => {
    const g = twoBoxes();
    const out = warp(g, fullQuad(100, 100), 100, 100);
    expect(out.data).toEqual(g.data);
  });

  it('caps the output size', () => {
    expect(warpSize(fullQuad(4000, 3000), 2000)).toEqual({ width: 2000, height: 1500 });
  });
});

describe('png chunks', () => {
  // A 1x1 PNG
  const tiny = Uint8Array.from(
    atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='),
    (c) => c.charCodeAt(0)
  );

  it('computes the standard CRC-32', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });

  it('round-trips a chunk', () => {
    const data = pack({ a: 1, b: 'ü' }, new Uint8Array([1, 2, 3]));
    const png = addChunk(tiny, 'tpLn', data);
    const back = readChunk(png, 'tpLn');
    expect(back).not.toBeNull();
    const { json, attachment } = unpack<{ a: number; b: string }>(back!);
    expect(json).toEqual({ a: 1, b: 'ü' });
    expect([...attachment]).toEqual([1, 2, 3]);
    expect(readChunk(tiny, 'tpLn')).toBeNull();
  });
});

describe('layoutLabel', () => {
  it('fits text into the inscribed circle and flags tiny areas', () => {
    const big = layoutLabel({ area: 1000, x: 10, y: 10, r: 80 }, 'YG23', { min: 8, max: 40 });
    expect(big.size).toBe(40);
    expect(big.tight).toBe(false);
    const small = layoutLabel({ area: 10, x: 10, y: 10, r: 3 }, 'YG23', { min: 8, max: 40 });
    expect(small.size).toBe(8);
    expect(small.tight).toBe(true);
  });
});

it('otsu splits a bimodal image', () => {
  const g = canvas(10, 10, 220);
  rect(g, 0, 0, 5, 10, 30);
  const t = otsu(g);
  expect(t).toBeGreaterThanOrEqual(30);
  expect(t).toBeLessThan(220);
});
