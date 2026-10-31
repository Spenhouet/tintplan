/**
 * Converts third-party pen color data into Tintplan palettes.
 *
 * Usage: bun scripts/import-pens.ts <dir>
 *
 * <dir> holds the raw files, downloaded from these MIT-licensed repositories:
 *   copic.js, copic-sets.js  github.com/scottgfhong310/copic-color          public/apps/copic-color/data/
 *   fc.js                    github.com/scottgfhong310/faber-castell-color  public/apps/faber-castell-color/data/fc-colors.js
 *   cda.js                   github.com/scottgfhong310/caran-dache-color    public/apps/caran-dache-color/data/cda-colors.js
 *   fine.js                  github.com/scottgfhong310/finecolour-color     public/apps/finecolour-color/data/finecolour-colors.js
 *   ohuhu.json, decotime.json github.com/dferrandizmont/ink-lab            assets/data/
 *
 * The .js files are only parsed as JSON (`window.X = {...};`), never executed.
 * Output: src/lib/pens/data/<palette>.json and src/lib/pens/data/index.json.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Palette, PaletteInfo, Pen, PenSet } from '../src/lib/pens/types';

const dir = process.argv[2];
if (!dir) throw new Error('usage: bun scripts/import-pens.ts <dir>');
const out = join(import.meta.dirname, '../src/lib/pens/data');
mkdirSync(out, { recursive: true });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = any;

function loadJs(file: string): Record<string, Raw> {
  const text = readFileSync(join(dir, file), 'utf8');
  const vars: Record<string, Raw> = {};
  for (const m of text.matchAll(/window\.(\w+)\s*=\s*([\s\S]*?);\s*(?=window\.|$)/g)) vars[m[1]] = JSON.parse(m[2]);
  return vars;
}
const loadJson = (file: string): Raw => JSON.parse(readFileSync(join(dir, file), 'utf8'));

const hex = (h: string) => '#' + h.replace('#', '').toLowerCase();
const titleCase = (s: string) => s.replace(/(^|\s)\p{Ll}/gu, (c) => c.toUpperCase());

const SCOTT = 'MIT, © 2026 Scott G.F. Hong';
const INKLAB = 'MIT, © 2026 Daniel Mont Ferrandiz';
const index: PaletteInfo[] = [];

function emit(info: Omit<PaletteInfo, 'count'>, pens: Pen[], sets: PenSet[] = []) {
  const seen = new Set<string>();
  pens = pens.filter((p) => !seen.has(p.code) && seen.add(p.code));
  // Only keep sets whose colors are all in this palette
  sets = sets.filter((s) => s.codes.length > 0 && s.codes.every((c) => seen.has(c)));
  const palette: Palette = { ...info, count: pens.length, pens, sets };
  writeFileSync(join(out, `${info.id}.json`), JSON.stringify(palette));
  index.push({ ...info, count: pens.length });
  console.log(`${info.id}: ${pens.length} pens, ${sets.length} sets`);
}

// Copic: one palette per marker line
{
  const { COPIC_COLORS } = loadJs('copic.js');
  const { COPIC_SETS } = loadJs('copic-sets.js');
  const lines = { sketch: 'Sketch', ciao: 'Ciao', classic: 'Classic' } as const;
  for (const [line, label] of Object.entries(lines)) {
    emit(
      {
        id: `copic-${line}`,
        brand: 'Copic',
        name: label,
        kind: 'marker',
        source: 'github.com/scottgfhong310/copic-color',
        license: SCOTT
      },
      COPIC_COLORS.filter((c: Raw) => c.lines.includes(line)).map((c: Raw) => ({
        code: c.code,
        name: c.name,
        hex: hex(c.hex)
      })),
      COPIC_SETS.filter((s: Raw) => s.line === line).map((s: Raw) => ({
        id: s.code,
        name: s.name.replace(/^Copic \w+ /, ''),
        codes: s.colors
      }))
    );
  }
}

// Ohuhu: new codes, old code kept as alternative
{
  const colors = loadJson('ohuhu.json');
  const setIds = [...new Set<string>(colors.flatMap((c: Raw) => c.sets ?? []))];
  const setName = (id: string) =>
    titleCase(
      id
        .replace(/^(honolulu|kaala)_/, '')
        .replace(/_v(\d)$/, ' (v$1)')
        .replaceAll('_', ' ')
    );
  const lines = { honolulu: 'Honolulu', oahu: 'Oahu', kaala: 'Kaala' } as const;
  for (const [line, label] of Object.entries(lines)) {
    const prefix = new RegExp(`^${line}_`);
    emit(
      {
        id: `ohuhu-${line}`,
        brand: 'Ohuhu',
        name: label,
        kind: 'marker',
        source: 'github.com/dferrandizmont/ink-lab',
        license: INKLAB
      },
      colors
        .filter((c: Raw) => c.lines.includes(line))
        .map((c: Raw) => ({
          code: c.newCode,
          name: c.newName,
          hex: hex(c.hex),
          ...(c.oldCode !== c.newCode ? { alt: c.oldCode } : {})
        })),
      setIds
        .filter((id) => line === 'oahu' || prefix.test(id))
        .map((id) => ({
          id,
          name: setName(id),
          codes: colors.filter((c: Raw) => c.sets?.includes(id)).map((c: Raw) => c.newCode)
        }))
    );
  }
}

// DecoTime
{
  const colors = loadJson('decotime.json');
  const setIds = [...new Set<string>(colors.flatMap((c: Raw) => c.sets ?? []))];
  emit(
    {
      id: 'decotime',
      brand: 'DecoTime',
      name: 'Alcohol markers',
      kind: 'marker',
      source: 'github.com/dferrandizmont/ink-lab',
      license: INKLAB
    },
    colors.map((c: Raw) => ({ code: c.code, name: c.name, hex: hex(c.hex) })),
    setIds.map((id) => ({
      id,
      name: titleCase(id.replace(/^decotime_/, '').replaceAll('_', ' ')),
      codes: colors.filter((c: Raw) => c.sets?.includes(id)).map((c: Raw) => c.code)
    }))
  );
}

// Faber-Castell: one palette per pencil line, sets by size
{
  const { FC_COLORS } = loadJs('fc.js');
  const lines = [
    ['faber-castell-polychromos', 'Polychromos', 'Polychromos colour pencils'],
    ['faber-castell-albrecht-durer', 'Albrecht Dürer', 'Albrecht Durer watercolour pencils'],
    ['faber-castell-goldfaber', 'Goldfaber', 'Goldfaber'],
    ['faber-castell-black-edition', 'Black Edition', 'Black Edition colour pencils']
  ] as const;
  for (const [id, label, key] of lines) {
    const pens = FC_COLORS.filter((c: Raw) => c.sets?.[key]);
    const sizes = [...new Set<number>(pens.flatMap((c: Raw) => c.sets[key]))].sort((a, b) => a - b);
    emit(
      {
        id,
        brand: 'Faber-Castell',
        name: label,
        kind: 'pencil',
        source: 'github.com/scottgfhong310/faber-castell-color',
        license: SCOTT
      },
      pens.map((c: Raw) => ({ code: c.code, name: titleCase(c.name), hex: hex(c.hex) })),
      sizes.map((size) => ({
        id: `${id}-${size}`,
        name: `${size}`,
        codes: pens.filter((c: Raw) => c.sets[key].includes(size)).map((c: Raw) => c.code)
      }))
    );
  }
}

// Caran d'Ache: one palette per series
{
  const { CDA_COLORS } = loadJs('cda.js');
  const series = [
    ['LUM', 'caran-dache-luminance', 'Luminance 6901', 'pencil'],
    ['PAB', 'caran-dache-pablo', 'Pablo', 'pencil'],
    ['SUP', 'caran-dache-supracolor', 'Supracolor Soft Aquarelle', 'pencil'],
    ['MUS', 'caran-dache-museum', 'Museum Aquarelle', 'pencil'],
    ['NC2', 'caran-dache-neocolor-ii', 'Neocolor II Aquarelle', 'crayon']
  ] as const;
  for (const [sid, id, label, kind] of series) {
    emit(
      {
        id,
        brand: "Caran d'Ache",
        name: label,
        kind,
        source: 'github.com/scottgfhong310/caran-dache-color',
        license: SCOTT
      },
      CDA_COLORS.filter((c: Raw) => c.seriesId === sid)
        .sort((a: Raw, b: Raw) => a.order - b.order)
        .map((c: Raw) => ({ code: c.code, name: titleCase(c.name), hex: hex(c.hex) }))
    );
  }
}

// Finecolour markers (the fineliners have Chinese names only)
{
  const { FINECOLOUR_COLORS } = loadJs('fine.js');
  emit(
    {
      id: 'finecolour',
      brand: 'Finecolour',
      name: 'Markers',
      kind: 'marker',
      source: 'github.com/scottgfhong310/finecolour-color',
      license: SCOTT
    },
    FINECOLOUR_COLORS.filter((c: Raw) => c.space === 'marker').map((c: Raw) => ({
      code: c.code,
      name: c.name,
      hex: hex(c.hex)
    }))
  );
}

index.sort((a, b) => a.brand.localeCompare(b.brand) || a.name.localeCompare(b.name));
writeFileSync(join(out, 'index.json'), JSON.stringify(index, null, 2) + '\n');
