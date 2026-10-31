/// <reference lib="webworker" />
import { toGray, grayToRgba, type Gray, type Quad } from './gray';
import { detectPage } from './enhance';
import { extractLines } from './lines';
import { segment } from './segment';
import { warpRgba, warpSize } from './warp';
import { gapPixels, minAreaFor, speckFor, type DisplayMode, type Request, type Response } from './protocol';

/** Longest side of a decoded photo, before cropping. */
const MAX_INPUT = 3200;

interface Rgba {
  width: number;
  height: number;
  data: Uint8ClampedArray<ArrayBuffer>;
}

let photo: Rgba | null = null;
/** The cropped page and its outlines, kept while the user tunes the detection. */
let page: { key: string; rgba: Rgba } | null = null;
let outlines: { key: string; lines: Gray } | null = null;

async function decode(blob: Blob, max = Infinity): Promise<Rgba> {
  const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
  const f = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * f));
  const height = Math.max(1, Math.round(bitmap.height * f));
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return { width, height, data: ctx.getImageData(0, 0, width, height).data };
}

function encode(img: Rgba, type: 'image/png' | 'image/jpeg'): Promise<Blob> {
  const canvas = new OffscreenCanvas(img.width, img.height);
  canvas.getContext('2d')!.putImageData(new ImageData(img.data, img.width, img.height), 0, 0);
  return canvas.convertToBlob(type === 'image/jpeg' ? { type, quality: 0.92 } : { type });
}

const grayRgba = (g: Gray): Rgba => ({ width: g.width, height: g.height, data: grayToRgba(g) });

async function handle(req: Request): Promise<{ result: Response; transfer: Transferable[] }> {
  switch (req.type) {
    case 'load': {
      photo = await decode(req.blob, MAX_INPUT);
      page = outlines = null;
      const quad = detectPage(toGray(photo.data, photo.width, photo.height));
      return { result: { type: 'load', width: photo.width, height: photo.height, quad }, transfer: [] };
    }
    case 'detect': {
      if (!photo) throw new Error('no photo loaded');
      const q: Quad = req.quad;
      const pageKey = JSON.stringify([q, req.maxSide]);
      if (page?.key !== pageKey) {
        const { width, height } = warpSize(q, req.maxSide);
        page = {
          key: pageKey,
          rgba: { width, height, data: warpRgba(photo.data, photo.width, photo.height, q, width, height) }
        };
        outlines = null;
      }
      const { width, height } = page.rgba;
      const lineKey = `${pageKey}|${req.strength}`;
      if (outlines?.key !== lineKey) {
        const lines = extractLines(page.rgba.data, width, height, {
          strength: req.strength,
          speck: speckFor(width, height)
        });
        outlines = { key: lineKey, lines };
      }
      const gap = gapPixels(req.gapLevel, width, height);
      const minArea = minAreaFor(width, height);
      const s = segment(outlines.lines, gap, minArea);
      const outline = await encode(grayRgba(outlines.lines), 'image/png');
      return {
        result: { type: 'detect', width, height, count: s.count, scan: s.scan, outline, gap, minArea },
        transfer: [s.scan.data.buffer]
      };
    }
    case 'display': {
      if (!page || !outlines) throw new Error('nothing detected yet');
      return { result: { type: 'display', image: await displayImage(req.mode) }, transfer: [] };
    }
    case 'open': {
      const display = await decode(req.display);
      // Pages made before outlines were stored separately use their (grayscale) image
      const source = req.outline ? await decode(req.outline) : display;
      const s = segment(toGray(source.data, source.width, source.height), req.gap, req.minArea);
      return {
        result: { type: 'open', display: display.data, seg: s },
        transfer: [display.data.buffer, s.labels.buffer, s.offsets.buffer, s.pixels.buffer, s.scan.data.buffer]
      };
    }
  }
}

function displayImage(mode: DisplayMode): Promise<Blob> {
  const rgba = page!.rgba;
  if (mode === 'lines') return encode(grayRgba(outlines!.lines), 'image/png');
  if (mode === 'original') return encode(rgba, 'image/jpeg');
  return encode(grayRgba(toGray(rgba.data, rgba.width, rgba.height)), 'image/jpeg');
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
