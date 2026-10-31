import index from './data/index.json';
import type { Palette, PaletteInfo, Pen } from './types';

export type { Palette, PaletteInfo, Pen, PenSet } from './types';

export const palettes: PaletteInfo[] = index as PaletteInfo[];

const loaders = import.meta.glob<{ default: Palette }>(['./data/*.json', '!./data/index.json']);
const cache = new Map<string, Palette>();

export function paletteInfo(id: string): PaletteInfo | undefined {
  return palettes.find((p) => p.id === id);
}

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
