import type { Segmentation } from './segment';

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * The colored page as RGBA pixels: each area's pen color multiplied with the line art, the way
 * marker ink sits under printed lines. Repaints one area at a time.
 */
export class Composite {
  readonly image: ImageData;
  /** 0xRRGGBB per area, -1 for unfilled. */
  readonly colors: Int32Array;
  private boxes: (Box | null)[];

  constructor(
    readonly seg: Segmentation,
    readonly line: Uint8ClampedArray
  ) {
    this.image = new ImageData(seg.width, seg.height);
    this.colors = new Int32Array(seg.count + 1).fill(-1);
    this.boxes = new Array(seg.count + 1).fill(null);
    const d = this.image.data;
    for (let i = 0, j = 0; i < line.length; i++, j += 4) {
      d[j] = d[j + 1] = d[j + 2] = line[i];
      d[j + 3] = 255;
    }
  }

  /** Set an area's color (`#rrggbb` or null) and return the box that changed. */
  set(region: number, hex: string | null): Box {
    const c = hex ? parseInt(hex.slice(1), 16) : -1;
    this.colors[region] = c;
    const { offsets, pixels } = this.seg;
    const d = this.image.data;
    const line = this.line;
    const r = c >= 0 ? (c >> 16) & 255 : 255;
    const g = c >= 0 ? (c >> 8) & 255 : 255;
    const b = c >= 0 ? c & 255 : 255;
    for (let k = offsets[region]; k < offsets[region + 1]; k++) {
      const i = pixels[k];
      const l = line[i];
      const j = i * 4;
      d[j] = (r * l) / 255;
      d[j + 1] = (g * l) / 255;
      d[j + 2] = (b * l) / 255;
    }
    return this.box(region);
  }

  box(region: number): Box {
    const cached = this.boxes[region];
    if (cached) return cached;
    const { offsets, pixels, width } = this.seg;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -1;
    let y1 = -1;
    for (let k = offsets[region]; k < offsets[region + 1]; k++) {
      const x = pixels[k] % width;
      const y = (pixels[k] / width) | 0;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
    const box = { x0, y0, x1: x1 + 1, y1: y1 + 1 };
    this.boxes[region] = box;
    return box;
  }

  draw(ctx: CanvasRenderingContext2D, box?: Box) {
    if (!box) ctx.putImageData(this.image, 0, 0);
    else ctx.putImageData(this.image, 0, 0, box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0);
  }
}

export interface Label {
  region: number;
  text: string;
  x: number;
  y: number;
  size: number;
  tight: boolean;
  dark: boolean;
}

export const LABEL_FONT = '600 {size}px ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

/** Draw pen codes onto a canvas, centered on their spots. */
export function drawLabels(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, labels: Label[]) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  for (const l of labels) {
    ctx.font = LABEL_FONT.replace('{size}', l.size.toFixed(1));
    ctx.lineWidth = l.size * (l.tight ? 0.28 : 0.18);
    ctx.strokeStyle = l.dark ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.85)';
    ctx.fillStyle = l.dark ? '#fff' : '#111';
    ctx.strokeText(l.text, l.x, l.y);
    ctx.fillText(l.text, l.x, l.y);
  }
  ctx.restore();
}
