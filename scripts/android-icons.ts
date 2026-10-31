/**
 * Render the Android launcher icons and splash screens from static/favicon.svg.
 * Usage: bun scripts/android-icons.ts (after `bunx cap add android`, or when the icon changes)
 */
import sharp from 'sharp';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const res = join(root, 'android/app/src/main/res');
const VIOLET = '#7c3aed';
const svg = readFileSync(join(root, 'static/favicon.svg'), 'utf8');
// The artwork without the rounded violet tile
const art = svg
  .replace(/<rect[^>]*\/>/, '')
  .replace(/<svg[^>]*>/, '')
  .replace('</svg>', '');

/** Artwork scaled around the center of a 512 canvas, on an optional background. */
function compose(scale: number, background?: string, round = false): Buffer {
  const bg = background
    ? round
      ? `<circle cx="256" cy="256" r="256" fill="${background}"/>`
      : `<rect width="512" height="512" rx="112" fill="${background}"/>`
    : '';
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${bg}<g transform="translate(256 256) scale(${scale}) translate(-256 -256)">${art}</g></svg>`
  );
}

const densities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 } as const;
for (const [name, f] of Object.entries(densities)) {
  const dir = join(res, `mipmap-${name}`);
  // Adaptive foreground: 108 dp canvas, the art inside the 66 dp safe zone
  await sharp(compose(0.95), { density: 300 })
    .resize(Math.round(108 * f))
    .png()
    .toFile(join(dir, 'ic_launcher_foreground.png'));
  await sharp(compose(1, VIOLET), { density: 300 })
    .resize(Math.round(48 * f))
    .png()
    .toFile(join(dir, 'ic_launcher.png'));
  await sharp(compose(0.85, VIOLET, true), { density: 300 })
    .resize(Math.round(48 * f))
    .png()
    .toFile(join(dir, 'ic_launcher_round.png'));
}

// Splash screens (before Android 12): the icon centered on violet, same sizes as the templates
for (const dir of readdirSync(res).filter((d) => d.startsWith('drawable'))) {
  const file = join(res, dir, 'splash.png');
  if (!existsSync(file)) continue;
  const { width = 480, height = 800 } = await sharp(file).metadata();
  const size = Math.round(Math.min(width, height) * 0.4);
  const icon = await sharp(compose(1), { density: 300 }).resize(size).png().toBuffer();
  await sharp({ create: { width, height, channels: 4, background: VIOLET } })
    .composite([{ input: icon, gravity: 'center' }])
    .png()
    .toFile(file);
}
console.log('Android icons and splash screens written');
