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
}

const KEY = 'tintplan:settings';
const RECENT_MAX = 16;

function load(): Stored {
  const fallback: Stored = { labelScale: 1, paletteId: 'copic-sketch', recent: [] };
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

  #save() {
    localStorage.setItem(KEY, JSON.stringify(this.#s));
  }
}

export const settings = new Settings();
