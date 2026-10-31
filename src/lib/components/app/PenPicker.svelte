<script lang="ts">
  import Sheet from './Sheet.svelte';
  import Swatch from './Swatch.svelte';
  import PaletteStrip from './PaletteStrip.svelte';
  import { Check, ChevronRight } from '@lucide/svelte';
  import { fly } from 'svelte/transition';
  import { cn } from '$lib/utils';
  import { Input } from '$lib/components/ui/input';
  import { loadPalette, matchesQuery, paletteInfo, palettes, type Palette, type PaletteInfo } from '$lib/pens';
  import type { PenRef } from '$lib/settings.svelte';
  import { settings } from '$lib/settings.svelte';
  import type { Editor } from '$lib/editor.svelte';
  import { m } from '$lib/paraglide/messages.js';

  let { open = $bindable(false), editor }: { open: boolean; editor: Editor } = $props();

  let palette = $state<Palette | null>(null);
  let query = $state('');
  /** The pen grid, or the list of brands and ranges. */
  let view = $state<'pens' | 'palettes'>('pens');

  $effect(() => {
    if (open) view = 'pens';
  });

  const info = $derived(paletteInfo(editor.paletteId));

  // Ranges grouped by brand, in index order
  const brands = palettes.reduce<[string, PaletteInfo[]][]>((acc, p) => {
    const last = acc.at(-1);
    if (last?.[0] === p.brand) last[1].push(p);
    else acc.push([p.brand, [p]]);
    return acc;
  }, []);

  const kindLabel = (kind: PaletteInfo['kind']) =>
    kind === 'marker' ? m.kind_marker() : kind === 'crayon' ? m.kind_crayon() : m.kind_pencil();

  /** Sets named only by their size read as "24 pens"; named sets keep their name. */
  const setLabel = (name: string, count: number) =>
    /^\d+$/.test(name) ? m.pens_count_other({ count }) : name.includes(String(count)) ? name : `${name} (${count})`;

  /** Bring the selected range into view when the list appears. */
  const reveal = (selected: boolean) => (el: HTMLElement) => {
    if (selected) requestAnimationFrame(() => el.scrollIntoView({ block: 'center' }));
  };

  /** Center the selected chip in its row, scrolling only sideways. */
  const centerChip = (selected: boolean) => (el: HTMLElement) => {
    const row = el.parentElement;
    if (!selected || !row) return;
    requestAnimationFrame(() =>
      row.scrollTo({ left: el.offsetLeft - (row.clientWidth - el.clientWidth) / 2, behavior: 'smooth' })
    );
  };

  function choosePalette(id: string) {
    query = '';
    editor.setPalette(id);
    view = 'pens';
  }

  $effect(() => {
    const id = editor.paletteId;
    loadPalette(id)
      .then((p) => (palette = p))
      .catch(() => loadPalette(palettes[0].id).then((p) => (palette = p)));
  });

  const set = $derived(palette?.sets.find((s) => s.id === editor.setId));
  const pens = $derived.by(() => {
    if (!palette) return [];
    const inSet = set ? new Set(set.codes) : null;
    return palette.pens.filter((p) => (!inSet || inSet.has(p.code)) && matchesQuery(p, query));
  });

  const used = $derived.by(() => {
    void editor.version;
    return editor.usedPens().map((u) => u.pen);
  });

  function choose(pen: PenRef) {
    editor.choosePen(pen);
    open = false;
  }

  const isCurrent = (p: PenRef) => editor.pen?.p === p.p && editor.pen?.c === p.c;
</script>

{#snippet row(title: string, list: PenRef[])}
  {#if list.length}
    <section class="flex flex-col gap-1.5">
      <h3 class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h3>
      <div class="-mx-1 flex gap-1 overflow-x-auto pb-1">
        {#each list as p (p.p + p.c)}
          <Swatch
            size="sm"
            hex={p.hex}
            code={p.c}
            title={`${p.n} · ${paletteInfo(p.p)?.brand ?? ''}`}
            selected={isCurrent(p)}
            onclick={() => choose(p)}
          />
        {/each}
      </div>
    </section>
  {/if}
{/snippet}

<Sheet
  bind:open
  title={view === 'palettes' ? m.palette() : m.choose_pen()}
  onback={view === 'palettes' ? () => (view = 'pens') : undefined}
>
  {#if view === 'palettes'}
    <div class="flex flex-col gap-4" in:fly={{ x: 40, duration: 200 }}>
      {#each brands as [brand, list] (brand)}
        <section class="flex flex-col gap-1.5">
          <h3 class="px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{brand}</h3>
          <div class="divide-y overflow-hidden surface">
            {#each list as p (p.id)}
              <button
                type="button"
                class="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/60 active:bg-muted"
                aria-pressed={p.id === editor.paletteId}
                {@attach reveal(p.id === editor.paletteId)}
                onclick={() => choosePalette(p.id)}
              >
                <PaletteStrip colors={p.preview} />
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-body font-medium">{p.name}</span>
                  <span class="block truncate text-xs text-muted-foreground">
                    {kindLabel(p.kind)} · {m.pens_count_other({ count: p.count })}
                  </span>
                </span>
                {#if p.id === editor.paletteId}<Check class="size-5 shrink-0 text-primary" />{/if}
              </button>
            {/each}
          </div>
        </section>
      {/each}
    </div>
  {:else}
    <div class="flex flex-col gap-4" in:fly={{ x: -40, duration: 200 }}>
      <button
        type="button"
        class="flex w-full items-center gap-3 surface px-3 py-2.5 text-left transition-all hover:bg-muted/60 active:scale-98"
        onclick={() => (view = 'palettes')}
      >
        <PaletteStrip colors={info?.preview ?? []} />
        <span class="min-w-0 flex-1">
          <span class="block truncate text-xs text-muted-foreground">{info?.brand}</span>
          <span class="block truncate text-body font-medium">{info?.name}</span>
        </span>
        <span class="text-xs text-muted-foreground">{m.change()}</span>
        <ChevronRight class="size-4 shrink-0 text-muted-foreground" />
      </button>

      {#if palette?.sets.length}
        <section class="flex flex-col gap-1.5">
          <h3 class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{m.pen_set()}</h3>
          <div class="-mx-5 flex gap-1.5 overflow-x-auto px-5 pb-1" role="radiogroup">
            {#each [{ id: '', name: m.all_pens(), codes: [] }, ...palette.sets] as s (s.id)}
              {@const selected = (editor.setId ?? '') === s.id}
              <button
                type="button"
                role="radio"
                aria-checked={selected}
                {@attach centerChip(selected)}
                class={cn(
                  'shrink-0 rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-all active:scale-95',
                  selected
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                )}
                onclick={() => editor.setPalette(editor.paletteId, s.id || undefined)}
              >
                {s.id ? setLabel(s.name, s.codes.length) : s.name}
              </button>
            {/each}
          </div>
        </section>
      {/if}

      {@render row(m.on_this_page(), used)}
      {@render row(
        m.recent(),
        settings.recent.filter((r) => !used.some((u) => u.p === r.p && u.c === r.c))
      )}

      <section class="flex flex-col gap-2">
        <div class="flex items-center gap-2">
          <h3 class="flex-1 truncate text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {m.pens()}
          </h3>
          <span class="text-xs text-muted-foreground tabular"
            >{pens.length === 1 ? m.pens_count_one() : m.pens_count_other({ count: pens.length })}</span
          >
        </div>
        <Input bind:value={query} placeholder={m.search_pens()} type="search" aria-label={m.search_pens()} />
        {#if pens.length}
          <div class="grid grid-cols-swatches gap-1">
            {#each pens as pen (pen.code)}
              {@const ref = { p: palette!.id, c: pen.code, hex: pen.hex, n: pen.name }}
              <Swatch
                hex={pen.hex}
                code={pen.code}
                title={pen.alt ? `${pen.name} (${pen.alt})` : pen.name}
                selected={isCurrent(ref)}
                onclick={() => choose(ref)}
              />
            {/each}
          </div>
        {:else}
          <p class="py-6 text-center text-sm text-muted-foreground">{m.no_results()}</p>
        {/if}
      </section>
    </div>
  {/if}
</Sheet>
