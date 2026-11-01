/** OKLCH lightness, chroma and hue (degrees, 0..360) of `#rrggbb`. */
export function oklch(hex: string): { l: number; c: number; h: number } {
  const [l, a, b] = oklab(hex);
  return { l, c: Math.hypot(a, b), h: ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360 };
}

/** OKLab of `#rrggbb`: a perceptual space where distances match how different colors look. */
export function oklab(hex: string): [number, number, number] {
  const v = parseInt(hex.slice(1), 16);
  const lin = (x: number) => {
    const s = x / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const r = lin((v >> 16) & 255);
  const g = lin((v >> 8) & 255);
  const b = lin(v & 255);
  const l_ = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m_ = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s_ = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_
  ];
}

/** Color families in picker order, like the sections of a pen color chart. */
export const FAMILIES = [
  'red',
  'orange',
  'yellow',
  'green',
  'teal',
  'blue',
  'violet',
  'pink',
  'brown',
  'gray'
] as const;
export type Family = (typeof FAMILIES)[number];

/**
 * The family a color belongs to, by OKLCH hue. Near-neutral colors (grays, whites, the palest
 * tints) are `gray`; dull or dark warm colors are `brown`.
 */
export function family(hex: string): Family {
  const { l, c, h } = oklch(hex);
  if (c < 0.022) return 'gray';
  if (h >= 25 && h < 105 && ((c < 0.13 && l < 0.7) || (c < 0.07 && l < 0.86))) return 'brown';
  if (h < 12 || h >= 345) return 'pink';
  if (h < 45) return 'red';
  if (h < 78) return 'orange';
  if (h < 118) return 'yellow';
  if (h < 175) return 'green';
  if (h < 225) return 'teal';
  if (h < 280) return 'blue';
  if (h < 320) return 'violet';
  return 'pink';
}

/**
 * Order colors from the lightest to the darkest so that each step is as small as possible:
 * a shortest open path in OKLab with fixed ends (nearest neighbor, then 2-opt). Unlike sorting
 * by lightness alone, vivid and muted shades of the same lightness don't alternate.
 */
export function lightToDark<T extends { hex: string }>(items: T[]): T[] {
  const pts = items.map((p) => oklab(p.hex));
  if (items.length < 4)
    return items
      .map((p, i) => ({ p, l: pts[i][0] }))
      .sort((a, b) => b.l - a.l)
      .map((x) => x.p);
  const d = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  let start = 0;
  let end = 0;
  for (let i = 1; i < pts.length; i++) {
    if (pts[i][0] > pts[start][0]) start = i;
    if (pts[i][0] < pts[end][0]) end = i;
  }
  if (start === end) end = start === 0 ? 1 : 0;
  const order = [start];
  const used = new Uint8Array(pts.length);
  used[start] = used[end] = 1;
  while (order.length < pts.length - 1) {
    const last = pts[order[order.length - 1]];
    let best = -1;
    let bd = Infinity;
    for (let i = 0; i < pts.length; i++) {
      if (used[i]) continue;
      const x = d(last, pts[i]);
      if (x < bd) {
        bd = x;
        best = i;
      }
    }
    order.push(best);
    used[best] = 1;
  }
  order.push(end);
  // 2-opt: reverse any stretch that makes the path shorter, until nothing improves
  for (let improved = true, rounds = 0; improved && rounds < 50; rounds++) {
    improved = false;
    for (let i = 1; i < order.length - 2; i++) {
      for (let k = i + 1; k < order.length - 1; k++) {
        const before = d(pts[order[i - 1]], pts[order[i]]) + d(pts[order[k]], pts[order[k + 1]]);
        const after = d(pts[order[i - 1]], pts[order[k]]) + d(pts[order[i]], pts[order[k + 1]]);
        if (after < before - 1e-9) {
          order.splice(i, k - i + 1, ...order.slice(i, k + 1).reverse());
          improved = true;
        }
      }
    }
  }
  return order.map((i) => items[i]);
}

/** Colors grouped by family (in chart order), each family as a smooth light-to-dark run. */
export function groupByColor<T extends { hex: string }>(items: T[]): { family: Family; items: T[] }[] {
  const groups = new Map<Family, T[]>();
  for (const item of items) {
    const f = family(item.hex);
    groups.set(f, [...(groups.get(f) ?? []), item]);
  }
  return FAMILIES.filter((f) => groups.has(f)).map((f) => ({ family: f, items: lightToDark(groups.get(f)!) }));
}

/** All colors in one list: families in chart order, light to dark within each. */
export function sortByColor<T extends { hex: string }>(items: T[]): T[] {
  return groupByColor(items).flatMap((g) => g.items);
}
