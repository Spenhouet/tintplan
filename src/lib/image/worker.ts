/// <reference lib="webworker" />
import { toGray, grayToRgba, type Gray, type Quad } from './gray';
import { detectPage, enhance } from './enhance';
import { segment } from './segment';
import { warp, warpSize } from './warp';
import type { Request, Response } from './protocol';

/** Longest side of a decoded photo, before cropping. */
const MAX_INPUT = 3200;

let photo: Gray | null = null;

async function decode(blob: Blob, max: number): Promise<Gray> {
  const probe = await createImageBitmap(blob, { imageOrientation: 'from-image' });
  const f = Math.min(1, max / Math.max(probe.width, probe.height));
  const width = Math.max(1, Math.round(probe.width * f));
  const height = Math.max(1, Math.round(probe.height * f));
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(probe, 0, 0, width, height);
  probe.close();
  return toGray(ctx.getImageData(0, 0, width, height).data, width, height);
}

async function encodePng(g: Gray): Promise<Blob> {
  const canvas = new OffscreenCanvas(g.width, g.height);
  canvas.getContext('2d')!.putImageData(new ImageData(grayToRgba(g), g.width, g.height), 0, 0);
  return canvas.convertToBlob({ type: 'image/png' });
}

async function handle(req: Request): Promise<{ result: Response; transfer: Transferable[] }> {
  switch (req.type) {
    case 'load': {
      photo = await decode(req.blob, MAX_INPUT);
      return {
        result: { type: 'load', width: photo.width, height: photo.height, quad: detectPage(photo) },
        transfer: []
      };
    }
    case 'process': {
      if (!photo) throw new Error('no photo loaded');
      const q: Quad = req.quad;
      const { width, height } = warpSize(q, req.maxSide);
      let line = warp(photo, q, width, height);
      if (req.enhance) {
        const speck = Math.max(4, Math.round(width * height * 3e-6));
        line = enhance(line, { strength: req.strength, speck });
      }
      const png = await encodePng(line);
      return { result: { type: 'process', png, width, height }, transfer: [] };
    }
    case 'segment': {
      const line = await decode(req.blob, Infinity);
      const s = segment(line, req.gap);
      return {
        result: { type: 'segment', line: line.data, seg: s },
        transfer: [line.data.buffer, s.labels.buffer, s.offsets.buffer, s.pixels.buffer]
      };
    }
  }
}

self.onmessage = async (e: MessageEvent<{ id: number; req: Request }>) => {
  const { id, req } = e.data;
  try {
    const { result, transfer } = await handle(req);
    self.postMessage({ id, result }, { transfer });
  } catch (err) {
    self.postMessage({ id, error: err instanceof Error ? err.message : String(err) });
  }
};
