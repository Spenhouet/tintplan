<script lang="ts">
  import Sheet from './Sheet.svelte';
  import Swatch from './Swatch.svelte';
  import PaletteStrip from './PaletteStrip.svelte';
  import { Check, ChevronRight, Pencil } from '@lucide/svelte';
  import { fly } from 'svelte/transition';
  import { cn } from '$lib/utils';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { loadPalette, matchesQuery, paletteInfo, palettes, type Palette, type PaletteInfo } from '$lib/pens';
  import type { PenRef } from '$lib/settings.svelte';
  import { settings } from '$lib/settings.svelte';
  import type { Editor } from '$lib/editor.svelte';
  import { m } from '$lib/paraglide/messages.js';

  /**
   * Choose a pen: from the user's own pens or a whole range, with search, this page's pens and
   * recent ones. Also edits which pens the user owns. With `replacing`, picking a pen calls
   * `onpick` instead of selecting it.
   */
  let {
    open = $bindable(false),
    editor,
    replacing = null,
    onpick
  }: { open: boolean; editor: Editor; replacing?: PenRef | null; onpick?: (pen: PenRef) => void } = $props();

  let palette = $state<Palette | null>(null);
  let query = $state('');
  let view = $state<'pens' | 'palettes' | 'own'>('pens');
  /** Show only owned pens, when the range has any marked. */
  let onlyOwned = $state(true);

  $effect(() => {
    if (open) view = 'pens';
  });

  $effect(() => {
    const id = editor.paletteId;
    loadPalette(id)
      .then((p) => (palette = p))
      .catch(() => loadPalette(palettes[0].id).then((p) => (palette = p)));
  });

  const info = $derived(paletteInfo(editor.paletteId));
  const owned = $derived(new Set(settings.owned(editor.paletteId)));

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

  const filtering = $derived(onlyOwned && owned.size > 0);
  const pens = $derived.by(() => {
    if (!palette) return [];
    return palette.pens.filter((p) => (!filtering || owned.has(p.code)) && matchesQuery(p, query));
  });

  const used = $derived.by(() => {
    void editor.version;
    return editor.usedPens().map((u) => u.pen);
  });

  /** Bring the selected range into view when the list appears. */
  const reveal = (selected: boolean) => (el: HTMLElement) => {
    if (selected) requestAnimationFrame(() => el.scrollIntoView({ block: 'center' }));
  };

  function choosePalette(id: string) {
    query = '';
    onlyOwned = true;
    editor.setPalette(id);
    view = 'pens';
  }

  function choose(pen: PenRef) {
    if (replacing && onpick) onpick(pen);
    else editor.choosePen(pen);
    open = false;
  }

  function toggleSet(codes: string[]) {
    const all = codes.every((c) => owned.has(c));
    // eslint-disable-next-line svelte/prefer-svelte-reactivity -- local copy, stored through settings
    const next = new Set(owned);
    for (const c of codes) {
      if (all) next.delete(c);
      else next.add(c);
    }
    settings.setOwned(editor.paletteId, next);
  }

  const isCurrent = (p: PenRef) =>
    replacing ? replacing.p === p.p && replacing.c === p.c : editor.pen?.p === p.p && editor.pen?.c === p.c;

  const title = $derived(
    view === 'palettes'
      ? m.palette()
      : view === 'own'
        ? m.my_pens()
        : replacing
          ? m.replace_title({ code: replacing.c })
          : m.choose_pen()
  );
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

{#snippet chip(label: string, selected: boolean, onclick: () => void, check = false)}
  <button
    type="button"
    aria-pressed={selected}
    class={cn(
      'flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-all active:scale-95',
      selected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
    )}
    {onclick}
  >
    {#if check && selected}<Check class="size-3.5" />{/if}{label}
  </button>
{/snippet}

<Sheet bind:open {title} onback={view !== 'pens' ? () => (view = 'pens') : undefined}>
  {#if view === 'palettes'}
    <div class="flex flex-col gap-4" in:fly={{ x: 40, duration: 200 }}>
      {#each brands as [brand, list] (brand)}
        <section class="flex flex-col gap-1.5">
          <h3 class="px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{brand}</h3>
          <div class="divide-y overflow-hidden surface">
            {#each list as p (p.id)}
              {@const mine = settings.owned(p.id).length}
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
                    {kindLabel(p.kind)} · {mine
                      ? m.owned_of({ owned: mine, total: p.count })
                      : m.pens_count_other({ count: p.count })}
                  </span>
                </span>
                {#if p.id === editor.paletteId}<Check class="size-5 shrink-0 text-primary" />{/if}
              </button>
            {/each}
          </div>
        </section>
      {/each}
    </div>
  {:else if view === 'own'}
    <div class="flex flex-col gap-4" in:fly={{ x: 40, duration: 200 }}>
      <p class="text-sm text-muted-foreground">{m.my_pens_hint()}</p>
      {#if palette?.sets.length}
        <section class="flex flex-col gap-1.5">
          <h3 class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{m.sets()}</h3>
          <div class="flex flex-wrap gap-1.5">
            {#each palette.sets as s (s.id)}
              {@render chip(
                setLabel(s.name, s.codes.length),
                s.codes.every((c) => owned.has(c)),
                () => toggleSet(s.codes),
                true
              )}
            {/each}
          </div>
        </section>
      {/if}
      <section class="flex flex-col gap-2">
        <div class="flex items-center gap-2">
          <h3 class="flex-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase tabular">
            {m.owned_of({ owned: owned.size, total: palette?.pens.length ?? 0 })}
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onclick={() =>
              palette &&
              settings.setOwned(
                editor.paletteId,
                palette.pens.map((p) => p.code)
              )}>{m.select_all()}</Button
          >
          <Button variant="ghost" size="sm" onclick={() => settings.setOwned(editor.paletteId, [])}
            >{m.select_none()}</Button
          >
        </div>
        <div class="grid grid-cols-swatches gap-1">
          {#each palette?.pens ?? [] as pen (pen.code)}
            <Swatch
              hex={pen.hex}
              code={pen.code}
              title={pen.name}
              checked={owned.has(pen.code)}
              dimmed={!owned.has(pen.code)}
              onclick={() => settings.toggleOwned(editor.paletteId, pen.code)}
            />
          {/each}
        </div>
      </section>
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

      {#if owned.size}
        <div class="flex items-center gap-1.5">
          {@render chip(m.my_pens_count({ count: owned.size }), onlyOwned, () => (onlyOwned = true))}
          {@render chip(m.all_pens(), !onlyOwned, () => (onlyOwned = false))}
          <Button variant="ghost" size="sm" class="ml-auto" onclick={() => (view = 'own')}>
            <Pencil />{m.edit()}
          </Button>
        </div>
      {:else}
        <button
          type="button"
          class="flex items-center gap-3 rounded-xl bg-primary/8 px-3 py-2.5 text-left transition-colors hover:bg-primary/12"
          onclick={() => (view = 'own')}
        >
          <span class="min-w-0 flex-1 text-sm">{m.my_pens_empty()}</span>
          <span class="shrink-0 text-sm font-medium text-primary">{m.choose_my_pens()}</span>
        </button>
      {/if}

      {#if !replacing}
        {@render row(m.on_this_page(), used)}
        {@render row(
          m.recent(),
          settings.recent.filter((r) => !used.some((u) => u.p === r.p && u.c === r.c))
        )}
      {/if}

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
