export interface Pen {
  /** The number printed on the pen, e.g. `YG23` or `101`. */
  code: string;
  name: string;
  /** `#rrggbb`, a screen approximation sampled from the maker's color chart. */
  hex: string;
  /** Former code, for brands that renumbered (Ohuhu). */
  alt?: string;
}

export interface PenSet {
  id: string;
  name: string;
  codes: string[];
}

export interface PaletteInfo {
  id: string;
  brand: string;
  name: string;
  kind: 'marker' | 'pencil' | 'crayon' | 'custom';
  count: number;
  source: string;
  license: string;
}

export interface Palette extends PaletteInfo {
  pens: Pen[];
  sets: PenSet[];
}
