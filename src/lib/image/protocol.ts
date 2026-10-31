import type { Quad } from './gray';
import type { Segmentation } from './segment';

export type Request =
  | { type: 'load'; blob: Blob }
  | { type: 'process'; quad: Quad; enhance: boolean; strength: number; maxSide: number }
  | { type: 'segment'; blob: Blob; gap: number };

export type Response =
  | { type: 'load'; width: number; height: number; quad: Quad | null }
  | { type: 'process'; png: Blob; width: number; height: number }
  | { type: 'segment'; line: Uint8ClampedArray; seg: Segmentation };

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

/** Run an image job in the worker. The worker keeps the last loaded photo for `process`. */
export function run<T extends Request>(req: T): Promise<Of<T['type']>> {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve: resolve as (r: Response) => void, reject });
    getWorker().postMessage({ id, req });
  });
}
