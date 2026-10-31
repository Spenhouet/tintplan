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
  /** Clean line art as a grayscale PNG. */
  line: Blob;
  /** Gap closing radius used to find the areas, in pixels. */
  gap: number;
  fills: Fill[];
  /** Palette the pen picker opens with. */
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
