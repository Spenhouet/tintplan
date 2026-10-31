import type { Quad } from './gray';
import type { ScanMap, Segmentation } from './segment';

/** How the page looks while coloring: clean outlines, the photo in gray, or the photo as is. */
export type DisplayMode = 'lines' | 'gray' | 'original';

export type Request =
  | { type: 'load'; blob: Blob }
  | { type: 'detect'; quad: Quad; maxSide: number; strength: number; gapLevel: number }
  | { type: 'display'; mode: DisplayMode }
  | { type: 'open'; display: Blob; outline: Blob | null; gap: number; minArea: number };

export type Response =
  | { type: 'load'; width: number; height: number; quad: Quad | null }
  | {
      type: 'detect';
      width: number;
      height: number;
      count: number;
      scan: ScanMap;
      outline: Blob;
      gap: number;
      minArea: number;
    }
  | { type: 'display'; image: Blob }
  | { type: 'open'; display: Uint8ClampedArray; seg: Segmentation };

type Of<T extends Response['type']> = Extract<Response, { type: T }>;

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, { resolve: (r: Response) => void; reject: (e: Error) => void }>();

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (e: MessageEvent<{ id: number; result?: Response; error?: string }>) => {
    const p = pending.get(e.data.id);
    if (!p) return;
    pending.delete(e.data.id);
    if (e.data.error !== undefined) p.reject(new Error(e.data.error));
    else p.resolve(e.data.result!);
  };
  return worker;
}

/** Run an image job in the worker. The worker keeps the last photo and detection for later jobs. */
export function run<T extends Request>(req: T): Promise<Of<T['type']>> {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve: resolve as (r: Response) => void, reject });
    getWorker().postMessage({ id, req });
  });
}

/** Gap closing radius in pixels for a slider level, relative to the page size. */
export const gapPixels = (level: number, width: number, height: number) => (level * Math.max(width, height)) / 1000;

/** Paper specks smaller than this join their neighbors. */
export const minAreaFor = (width: number, height: number) => Math.round(width * height * 4e-5);

/** Outline blobs smaller than this are dropped as dust. */
export const speckFor = (width: number, height: number) => Math.max(8, Math.round(width * height * 2e-5));
