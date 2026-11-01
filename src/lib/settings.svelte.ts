export interface PenRef {
  p: string;
  c: string;
  hex: string;
  /** Pen name */
  n: string;
}

interface Stored {
  labelScale: number;
  paletteId: string;
  recent: PenRef[];
  /** Pen codes the user owns, per palette. */
  owned: Record<string, string[]>;
}

const KEY = 'tintplan:settings';
const RECENT_MAX = 16;

function load(): Stored {
  const fallback: Stored = { labelScale: 1, paletteId: 'copic-sketch', recent: [], owned: {} };
  if (typeof localStorage === 'undefined') return fallback;
  try {
    return { ...fallback, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return fallback;
  }
}

/** Small preferences that live in localStorage. Projects live in IndexedDB. */
class Settings {
  #s = $state(load());

  get labelScale() {
    return this.#s.labelScale;
  }
  set labelScale(v: number) {
    this.#s.labelScale = v;
    this.#save();
  }

  /** Palette for new pages. */
  get paletteId() {
    return this.#s.paletteId;
  }
  set paletteId(v: string) {
    this.#s.paletteId = v;
    this.#save();
  }

  get recent(): PenRef[] {
    return this.#s.recent;
  }

  useRecent(pen: PenRef) {
    this.#s.recent = [pen, ...this.#s.recent.filter((r) => r.p !== pen.p || r.c !== pen.c)].slice(0, RECENT_MAX);
    this.#save();
  }

  /** Owned codes of every palette. */
  get ownedAll(): Record<string, string[]> {
    return this.#s.owned;
  }

  /** How many pens the user owns in total. */
  get ownedCount(): number {
    return Object.values(this.#s.owned).reduce((n, codes) => n + codes.length, 0);
  }

  /** Codes owned in a palette. Empty when the user hasn't marked any. */
  owned(paletteId: string): string[] {
    return this.#s.owned[paletteId] ?? [];
  }

  setOwned(paletteId: string, codes: Iterable<string>) {
    const list = [...new Set(codes)];
    if (list.length) this.#s.owned = { ...this.#s.owned, [paletteId]: list };
    else {
      const { [paletteId]: _, ...rest } = this.#s.owned;
      this.#s.owned = rest;
    }
    this.#save();
  }

  toggleOwned(paletteId: string, code: string) {
    const list = this.owned(paletteId);
    this.setOwned(paletteId, list.includes(code) ? list.filter((c) => c !== code) : [...list, code]);
  }

  #save() {
    localStorage.setItem(KEY, JSON.stringify(this.#s));
  }
}

export const settings = new Settings();
