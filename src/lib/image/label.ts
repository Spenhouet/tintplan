import type { Region } from './segment';

export interface LabelLayout {
  x: number;
  y: number;
  size: number;
  /** The text is smaller than the area wants: draw it with a white halo so it stays readable. */
  tight: boolean;
}

/**
 * Font size for `text` centered at the region's label spot. The text box (about 0.6 em per
 * character wide, 0.75 em tall) has to fit inside the region's largest inscribed circle.
 * `scale` multiplies the result (user setting), `min` and `max` are in image pixels.
 */
export function layoutLabel(
  region: Region,
  text: string,
  { min, max, scale = 1 }: { min: number; max: number; scale?: number }
): LabelLayout {
  const halfW = 0.3 * Math.max(1, text.length);
  const halfH = 0.375;
  const fit = ((region.r - 1) / Math.hypot(halfW, halfH)) * scale;
  const size = Math.min(max * scale, Math.max(min, fit));
  return { x: region.x + 0.5, y: region.y + 0.5, size, tight: fit < min };
}

/** Label size bounds for an image, so labels read well on a phone and on paper. */
export function labelBounds(width: number, height: number): { min: number; max: number } {
  const side = Math.max(width, height);
  return { min: Math.max(6, side / 200), max: side / 28 };
}
