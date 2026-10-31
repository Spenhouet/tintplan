import { CHUNK, addChunk, pack, readChunk, unpack } from './image/png';
import { drawLabels, LABEL_FONT, type Composite, type Label } from './image/render';
import { db, newId, type Fill, type Project } from './db';

export interface LegendItem {
  code: string;
  name: string;
  brand: string;
  hex: string;
  count: number;
}

/** What an exported PNG carries so it can be opened again for editing. */
interface Embedded {
  v: 1;
  name: string;
  width: number;
  height: number;
  gap: number;
  paletteId: string;
  setId?: string;
  fills: Fill[];
}

/** Render the colored page, optionally with codes and a legend of the pens used, as PNG bytes. */
export async function renderPng(
  composite: Composite,
  { labels, legend, title }: { labels: Label[] | null; legend: LegendItem[] | null; title: string }
): Promise<Uint8Array> {
  const { width, height } = composite.seg;
  const unit = Math.max(24, Math.round(width / 36));
  const cols = Math.max(1, Math.floor(width / (unit * 9)));
  const rows = legend?.length ? Math.ceil(legend.length / cols) : 0;
  const legendHeight = rows ? unit * 2.2 + rows * unit * 1.4 : 0;
  const canvas = new OffscreenCanvas(width, Math.ceil(height + legendHeight));
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.putImageData(composite.image, 0, 0);
  if (labels) drawLabels(ctx, labels);

  if (legend?.length) {
    const pad = unit * 0.8;
    let y = height + unit * 1.1;
    ctx.fillStyle = '#111';
    ctx.textBaseline = 'middle';
    ctx.font = LABEL_FONT.replace('{size}', String(unit * 0.6));
    ctx.fillText(title, pad, y);
    y += unit * 1.1;
    const colWidth = (width - pad * 2) / cols;
    legend.forEach((item, i) => {
      const x = pad + (i % cols) * colWidth;
      const cy = y + Math.floor(i / cols) * unit * 1.4 + unit * 0.5;
      ctx.fillStyle = item.hex;
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = Math.max(1, unit / 24);
      ctx.beginPath();
      ctx.roundRect(x, cy - unit * 0.45, unit * 0.9, unit * 0.9, unit * 0.2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#111';
      ctx.font = LABEL_FONT.replace('{size}', String(unit * 0.5));
      const code = `${item.code}`;
      ctx.fillText(code, x + unit * 1.15, cy);
      const codeWidth = ctx.measureText(code + '  ').width;
      ctx.fillStyle = '#555';
      ctx.font = LABEL_FONT.replace('600', '400').replace('{size}', String(unit * 0.42));
      const rest = `${item.name} · ${item.brand} · ${item.count}×`;
      const maxW = colWidth - unit * 1.3 - codeWidth;
      let text = rest;
      while (text.length > 3 && ctx.measureText(text).width > maxW) text = text.slice(0, -2);
      if (text !== rest) text = text.slice(0, -1) + '…';
      ctx.fillText(text, x + unit * 1.15 + codeWidth, cy);
    });
  }
  const blob = await canvas.convertToBlob({ type: 'image/png' });
  return new Uint8Array(await blob.arrayBuffer());
}

/** Attach the editable project to exported PNG bytes. */
export async function embedProject(png: Uint8Array, project: Project): Promise<Uint8Array<ArrayBuffer>> {
  const meta: Embedded = {
    v: 1,
    name: project.name,
    width: project.width,
    height: project.height,
    gap: project.gap,
    paletteId: project.paletteId,
    setId: project.setId,
    fills: project.fills
  };
  const line = new Uint8Array(await project.line.arrayBuffer());
  return addChunk(png, CHUNK, pack(meta, line));
}

/** If `file` is a PNG exported by Tintplan, restore it as a new project and return its id. */
export async function importEmbedded(file: Blob): Promise<string | null> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const chunk = readChunk(bytes, CHUNK);
  if (!chunk) return null;
  const { json, attachment } = unpack<Embedded>(chunk);
  if (json.v !== 1) return null;
  const now = Date.now();
  const id = newId();
  await db.projects.add({
    id,
    name: json.name,
    createdAt: now,
    updatedAt: now,
    width: json.width,
    height: json.height,
    gap: json.gap,
    line: new Blob([attachment as BlobPart], { type: 'image/png' }),
    fills: json.fills,
    paletteId: json.paletteId,
    setId: json.setId
  });
  return id;
}

/** Share the file where the browser can (phones), otherwise download it. */
export async function saveFile(filename: string, bytes: Uint8Array, mime: string, share = false): Promise<void> {
  const file = new File([bytes as BlobPart], filename, { type: mime });
  if (share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const fileName = (name: string, ext: string) =>
  `${name.replace(/[^\p{L}\p{N} _-]+/gu, '').trim() || 'tintplan'}.${ext}`;
