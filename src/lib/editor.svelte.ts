import { db, type Fill, type Project } from './db';
import { run } from './image/protocol';
import { Composite, type Box, type Label } from './image/render';
import type { Segmentation } from './image/segment';
import { labelBounds, layoutLabel } from './image/label';
import { isDark, paletteInfo } from './pens';
import { settings, type PenRef } from './settings.svelte';
import type { LegendItem } from './export';

export type Tool = 'fill' | 'erase' | 'pick';

interface Change {
  region: number;
  before: PenRef | null;
  after: PenRef | null;
}

const samePen = (a: PenRef | null, b: PenRef | null) => a?.p === b?.p && a?.c === b?.c;
const ref = ({ p, c, hex, n }: PenRef): PenRef => ({ p, c, hex, n });

/** An open page: its areas, fills, undo history and the canvas it paints to. */
export class Editor {
  project: Project;
  readonly seg: Segmentation;
  readonly composite: Composite;
  /** Pen per area, index 0 unused. */
  private fills: (PenRef | null)[];
  private ctx: CanvasRenderingContext2D | null = null;
  private saveTimer: ReturnType<typeof setTimeout> | undefined;

  /** Bumped on every fill change, for derived values. */
  version = $state(0);
  tool = $state<Tool>('fill');
  pen = $state<PenRef | null>(null);
  showCodes = $state(true);
  name = $state('');
  paletteId = $state('');
  setId = $state<string | undefined>(undefined);
  private undoStack = $state.raw<Change[][]>([]);
  private redoStack = $state.raw<Change[][]>([]);

  private constructor(project: Project, seg: Segmentation, line: Uint8ClampedArray) {
    this.project = project;
    this.seg = seg;
    this.composite = new Composite(seg, line);
    this.fills = new Array(seg.count + 1).fill(null);
    this.name = project.name;
    this.paletteId = project.paletteId;
    this.setId = project.setId;
    for (const f of project.fills) {
      const x = Math.min(seg.width - 1, Math.max(0, Math.round(f.x)));
      const y = Math.min(seg.height - 1, Math.max(0, Math.round(f.y)));
      const region = seg.labels[y * seg.width + x];
      if (!region) continue;
      this.fills[region] = ref(f);
      this.composite.set(region, f.hex);
    }
    this.pen = settings.recent[0] ?? null;
  }

  static async open(id: string): Promise<Editor | null> {
    const project = await db.projects.get(id);
    if (!project) return null;
    const { seg, line } = await run({ type: 'segment', blob: project.line, gap: project.gap });
    return new Editor(project, seg, line);
  }

  get width() {
    return this.seg.width;
  }
  get height() {
    return this.seg.height;
  }
  get canUndo() {
    return this.undoStack.length > 0;
  }
  get canRedo() {
    return this.redoStack.length > 0;
  }

  attach(canvas: HTMLCanvasElement) {
    canvas.width = this.width;
    canvas.height = this.height;
    this.ctx = canvas.getContext('2d');
    this.ctx?.putImageData(this.composite.image, 0, 0);
  }

  regionAt(x: number, y: number): number {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    if (xi < 0 || yi < 0 || xi >= this.width || yi >= this.height) return 0;
    return this.seg.labels[yi * this.width + xi];
  }

  fillOf(region: number): PenRef | null {
    return this.fills[region] ?? null;
  }

  /** Apply the current tool at image coordinates. Returns what happened, for haptics. */
  tap(x: number, y: number): 'filled' | 'erased' | 'picked' | null {
    const region = this.regionAt(x, y);
    if (!region) return null;
    if (this.tool === 'pick') {
      const f = this.fills[region];
      if (!f) return null;
      this.choosePen(f);
      this.tool = 'fill';
      return 'picked';
    }
    const after = this.tool === 'erase' ? null : this.pen;
    if (this.tool === 'fill' && !after) return null;
    if (samePen(this.fills[region], after)) return null;
    this.commit([{ region, before: this.fills[region], after: after && ref(after) }]);
    return after ? 'filled' : 'erased';
  }

  choosePen(pen: PenRef) {
    this.pen = ref(pen);
    settings.useRecent(this.pen);
    if (this.tool !== 'fill') this.tool = 'fill';
  }

  /** Swap every area filled with `from` to `to` (or clear them). */
  replace(from: PenRef, to: PenRef | null) {
    const changes: Change[] = [];
    this.fills.forEach((f, region) => {
      if (f && samePen(f, from)) changes.push({ region, before: f, after: to && ref(to) });
    });
    if (changes.length) this.commit(changes);
  }

  clearAll() {
    const changes: Change[] = [];
    this.fills.forEach((f, region) => {
      if (f) changes.push({ region, before: f, after: null });
    });
    if (changes.length) this.commit(changes);
  }

  undo() {
    const last = this.undoStack.at(-1);
    if (!last) return;
    this.undoStack = this.undoStack.slice(0, -1);
    this.redoStack = [...this.redoStack, last];
    this.apply(last.map((c) => ({ region: c.region, before: c.after, after: c.before })));
  }

  redo() {
    const last = this.redoStack.at(-1);
    if (!last) return;
    this.redoStack = this.redoStack.slice(0, -1);
    this.undoStack = [...this.undoStack, last];
    this.apply(last);
  }

  private commit(changes: Change[]) {
    this.undoStack = [...this.undoStack.slice(-199), changes];
    this.redoStack = [];
    this.apply(changes);
  }

  private apply(changes: Change[]) {
    let box: Box | null = null;
    for (const { region, after } of changes) {
      this.fills[region] = after;
      const b = this.composite.set(region, after?.hex ?? null);
      box = box
        ? {
            x0: Math.min(box.x0, b.x0),
            y0: Math.min(box.y0, b.y0),
            x1: Math.max(box.x1, b.x1),
            y1: Math.max(box.y1, b.y1)
          }
        : b;
    }
    if (box && this.ctx) this.composite.draw(this.ctx, box);
    this.version++;
    this.scheduleSave();
  }

  /** Codes to print, one per filled area. */
  labels(scale = settings.labelScale): Label[] {
    const bounds = labelBounds(this.width, this.height);
    const out: Label[] = [];
    this.fills.forEach((f, region) => {
      if (!f) return;
      const reg = this.seg.regions[region];
      if (!reg.area) return;
      const l = layoutLabel(reg, f.c, { ...bounds, scale });
      out.push({ region, text: f.c, ...l, dark: isDark(f.hex) });
    });
    return out;
  }

  /** Pens used on the page with how many areas each fills, most used first. */
  usedPens(): { pen: PenRef; count: number }[] {
    // eslint-disable-next-line svelte/prefer-svelte-reactivity -- local, not reactive state
    const map = new Map<string, { pen: PenRef; count: number }>();
    for (const f of this.fills) {
      if (!f) continue;
      const key = `${f.p}|${f.c}`;
      const item = map.get(key);
      if (item) item.count++;
      else map.set(key, { pen: f, count: 1 });
    }
    return [...map.values()].sort((a, b) => b.count - a.count || a.pen.c.localeCompare(b.pen.c));
  }

  legend(): LegendItem[] {
    return this.usedPens().map(({ pen, count }) => ({
      code: pen.c,
      name: pen.n,
      brand: paletteInfo(pen.p)?.brand ?? '',
      hex: pen.hex,
      count
    }));
  }

  toFills(): Fill[] {
    const out: Fill[] = [];
    this.fills.forEach((f, region) => {
      if (!f) return;
      const reg = this.seg.regions[region];
      out.push({ x: reg.x, y: reg.y, ...ref(f) });
    });
    return out;
  }

  rename(name: string) {
    this.name = name.trim() || this.name;
    this.scheduleSave(0);
  }

  setPalette(paletteId: string, setId?: string) {
    this.paletteId = paletteId;
    this.setId = setId;
    settings.paletteId = paletteId;
    this.scheduleSave(0);
  }

  private scheduleSave(delay = 500) {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.save(), delay);
  }

  /** Write fills and a fresh thumbnail to the database. */
  async save() {
    clearTimeout(this.saveTimer);
    this.saveTimer = undefined;
    const patch = {
      name: this.name,
      fills: this.toFills(),
      paletteId: this.paletteId,
      setId: this.setId,
      updatedAt: Date.now(),
      thumb: await this.thumbnail()
    };
    this.project = { ...this.project, ...patch };
    await db.projects.update(this.project.id, patch);
  }

  get dirty() {
    return this.saveTimer !== undefined;
  }

  private async thumbnail(): Promise<Blob> {
    const f = Math.min(1, 480 / Math.max(this.width, this.height));
    const full = new OffscreenCanvas(this.width, this.height);
    full.getContext('2d')!.putImageData(this.composite.image, 0, 0);
    const small = new OffscreenCanvas(Math.round(this.width * f), Math.round(this.height * f));
    const ctx = small.getContext('2d')!;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(full, 0, 0, small.width, small.height);
    return small.convertToBlob({ type: 'image/jpeg', quality: 0.8 });
  }
}
