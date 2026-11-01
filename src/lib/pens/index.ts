import index from './data/index.json';
import type { Palette, PaletteInfo, Pen } from './types';
import { sortByColor } from './color';

export { oklch, sortByColor } from './color';

export type { Palette, PaletteInfo, Pen, PenSet } from './types';

export const palettes: PaletteInfo[] = index as PaletteInfo[];

const loaders = import.meta.glob<{ default: Palette }>(['./data/*.json', '!./data/index.json']);
const cache = new Map<string, Palette>();

export function paletteInfo(id: string): PaletteInfo | undefined {
  return palettes.find((p) => p.id === id);
}

/** Brand name that fits under a swatch. */
export const brandShort = (brand: string) => ({ 'Faber-Castell': 'Faber', "Caran d'Ache": 'Caran' })[brand] ?? brand;

export const paletteLabel = (p: Pick<PaletteInfo, 'brand' | 'name'>) => `${p.brand} ${p.name}`;

export async function loadPalette(id: string): Promise<Palette> {
  const hit = cache.get(id);
  if (hit) return hit;
  const load = loaders[`./data/${id}.json`];
  if (!load) throw new Error(`unknown palette ${id}`);
  const palette = (await load()).default;
  cache.set(id, palette);
  return palette;
}

/** Relative luminance of `#rrggbb`, 0..1. */
export function luminance(hex: string): number {
  const v = parseInt(hex.slice(1), 16);
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin((v >> 16) & 255) + 0.7152 * lin((v >> 8) & 255) + 0.0722 * lin(v & 255);
}

/** Dark fills get light codes. */
export const isDark = (hex: string) => luminance(hex) < 0.18;

export function matchesQuery(pen: Pen, q: string): boolean {
  if (!q) return true;
  const s = q.trim().toLowerCase();
  return (
    pen.code.toLowerCase().includes(s) ||
    pen.name.toLowerCase().includes(s) ||
    (pen.alt?.toLowerCase().includes(s) ?? false) ||
    pen.hex.includes(s.replace('#', ''))
  );
}

/** A pen the user owns, with where it comes from. */
export interface OwnedPen {
  p: string;
  c: string;
  hex: string;
  n: string;
  brand: string;
  range: string;
  alt?: string;
}

/** All pens the user owns, across ranges, sorted as a color gradient. */
export async function loadOwned(owned: Record<string, string[]>): Promise<OwnedPen[]> {
  const out: OwnedPen[] = [];
  for (const [id, codes] of Object.entries(owned)) {
    const info = paletteInfo(id);
    if (!info || !codes.length) continue;
    const palette = await loadPalette(id);
    const set = new Set(codes);
    for (const pen of palette.pens) {
      if (!set.has(pen.code)) continue;
      out.push({ p: id, c: pen.code, hex: pen.hex, n: pen.name, brand: info.brand, range: info.name, alt: pen.alt });
    }
  }
  return sortByColor(out);
}
