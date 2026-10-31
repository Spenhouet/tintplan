import Dexie, { type EntityTable } from 'dexie';

/** One filled area. The point lies inside the area, so fills survive changes to how areas are numbered. */
export interface Fill {
  x: number;
  y: number;
  /** Palette id and pen code. */
  p: string;
  c: string;
  /** Pen color and name at the time of filling, so the page renders even if a palette changes. */
  hex: string;
  n: string;
}

export interface Project {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  width: number;
  height: number;
  /** The page as shown while coloring: clean outlines, grayscale or the original photo. */
  line: Blob;
  /** Outlines the areas are found from (0 on lines). Missing on pages from v0.2 and older, which use `line`. */
  outline?: Blob;
  /** Gap closing radius used to find the areas, in pixels. */
  gap: number;
  /** Paper specks smaller than this many pixels join their neighbors. 0 on older pages. */
  minArea?: number;
  fills: Fill[];
  /** Pens used on this page, most recent first. */
  recent?: { p: string; c: string; hex: string; n: string }[];
  /** No longer used (pens come from Settings → My pens); kept for older pages and exports. */
  paletteId: string;
  /** Pen set the user owns, filters the picker. */
  setId?: string;
  thumb?: Blob;
}

export const db = new Dexie('tintplan') as Dexie & {
  projects: EntityTable<Project, 'id'>;
};

db.version(1).stores({ projects: 'id, updatedAt' });

export const newId = () => crypto.randomUUID();
