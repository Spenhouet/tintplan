/**
 * Read and write a private PNG chunk. Exported pages carry their project (fills, palette and the
 * clean line art) in a `tpLn` chunk, so importing the PNG again restores an editable page.
 * The name marks it as ancillary, private and safe to copy.
 */
export const CHUNK = 'tpLn';
const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(bytes: Uint8Array, start = 0, end = bytes.length): number {
  let c = 0xffffffff;
  for (let i = start; i < end; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function isPng(bytes: Uint8Array): boolean {
  return bytes.length > 8 && SIGNATURE.every((b, i) => bytes[i] === b);
}

/** Insert a chunk right before IEND. */
export function addChunk(png: Uint8Array, type: string, data: Uint8Array): Uint8Array<ArrayBuffer> {
  if (!isPng(png)) throw new Error('not a PNG');
  const iend = findChunk(png, 'IEND');
  if (iend < 0) throw new Error('PNG has no IEND');
  const chunk = new Uint8Array(12 + data.length);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) chunk[4 + i] = type.charCodeAt(i);
  chunk.set(data, 8);
  view.setUint32(8 + data.length, crc32(chunk, 4, 8 + data.length));
  const out = new Uint8Array(png.length + chunk.length);
  out.set(png.subarray(0, iend));
  out.set(chunk, iend);
  out.set(png.subarray(iend), iend + chunk.length);
  return out;
}

/** Data of the first chunk of `type`, or null. Chunks with a bad checksum are ignored. */
export function readChunk(png: Uint8Array, type: string): Uint8Array | null {
  if (!isPng(png)) return null;
  const at = findChunk(png, type);
  if (at < 0) return null;
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  const len = view.getUint32(at);
  if (at + 12 + len > png.length) return null;
  if (crc32(png, at + 4, at + 8 + len) !== view.getUint32(at + 8 + len)) return null;
  return png.slice(at + 8, at + 8 + len);
}

function findChunk(png: Uint8Array, type: string): number {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  let at = 8;
  while (at + 8 <= png.length) {
    const len = view.getUint32(at);
    let match = true;
    for (let i = 0; i < 4; i++) if (png[at + 4 + i] !== type.charCodeAt(i)) match = false;
    if (match) return at;
    at += 12 + len;
  }
  return -1;
}

/** Pack JSON plus a binary attachment: 4-byte JSON length, JSON, attachment. */
export function pack(json: unknown, attachment: Uint8Array): Uint8Array {
  const text = new TextEncoder().encode(JSON.stringify(json));
  const out = new Uint8Array(4 + text.length + attachment.length);
  new DataView(out.buffer).setUint32(0, text.length);
  out.set(text, 4);
  out.set(attachment, 4 + text.length);
  return out;
}

export function unpack<T>(data: Uint8Array): { json: T; attachment: Uint8Array } {
  const len = new DataView(data.buffer, data.byteOffset, data.byteLength).getUint32(0);
  const json = JSON.parse(new TextDecoder().decode(data.subarray(4, 4 + len))) as T;
  return { json, attachment: data.slice(4 + len) };
}
