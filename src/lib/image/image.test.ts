import { describe, expect, it } from 'vitest';
import type { Gray } from './gray';
import { otsu } from './gray';
import { connectedComponents } from './labels';
import { segment } from './segment';
import { detectPage, enhance } from './enhance';
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

describe('enhance', () => {
  it('removes a shadow gradient and keeps lines', () => {
    const g = twoBoxes();
    // Paper darkens from 230 to 120 left to right, lines are 35% of the paper
    for (let y = 0; y < 100; y++) {
      for (let x = 0; x < 100; x++) {
        const paper = 230 - x * 1.1;
        const i = y * 100 + x;
        g.data[i] = g.data[i] === 0 ? paper * 0.35 : paper;
      }
    }
    const out = enhance(g, { strength: 0.5, speck: 0 });
    expect(out.data[50 * 100 + 30]).toBe(255);
    expect(out.data[50 * 100 + 80]).toBe(255);
    expect(out.data[50 * 100 + 50]).toBeLessThan(40);
    expect(out.data[50 * 100 + 88]).toBeLessThan(40);
  });

  it('removes specks', () => {
    const g = twoBoxes();
    rect(g, 30, 30, 32, 32, 0);
    const out = enhance(g, { strength: 0.5, speck: 10 });
    expect(out.data[30 * 100 + 30]).toBe(255);
    expect(out.data[50 * 100 + 50]).toBeLessThan(40);
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
