<script lang="ts">
  import Sheet from './Sheet.svelte';
  import Swatch from './Swatch.svelte';
  import NativeSelect from './NativeSelect.svelte';
  import Field from './Field.svelte';
  import { Input } from '$lib/components/ui/input';
  import { loadPalette, matchesQuery, paletteInfo, paletteLabel, palettes, type Palette } from '$lib/pens';
  import type { PenRef } from '$lib/settings.svelte';
  import { settings } from '$lib/settings.svelte';
  import type { Editor } from '$lib/editor.svelte';
  import { m } from '$lib/paraglide/messages.js';

  let { open = $bindable(false), editor }: { open: boolean; editor: Editor } = $props();

  let palette = $state<Palette | null>(null);
  let query = $state('');

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

<Sheet bind:open title={m.choose_pen()}>
  <div class="flex flex-col gap-4">
    <div class="grid grid-cols-2 gap-2">
      <Field label={m.palette()}>
        <NativeSelect
          value={editor.paletteId}
          options={palettes.map((p) => ({ value: p.id, label: p.name, group: p.brand }))}
          onchange={(v) => editor.setPalette(v)}
        />
      </Field>
      <Field label={m.pen_set()}>
        <NativeSelect
          value={editor.setId ?? ''}
          options={[
            { value: '', label: m.all_pens() },
            ...(palette?.sets ?? []).map((s) => ({ value: s.id, label: `${s.name} (${s.codes.length})` }))
          ]}
          onchange={(v) => editor.setPalette(editor.paletteId, v || undefined)}
        />
      </Field>
    </div>

    {@render row(m.on_this_page(), used)}
    {@render row(
      m.recent(),
      settings.recent.filter((r) => !used.some((u) => u.p === r.p && u.c === r.c))
    )}

    <section class="flex flex-col gap-2">
      <div class="flex items-center gap-2">
        <h3 class="flex-1 truncate text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {palette ? paletteLabel(palette) : ''}
        </h3>
        <span class="text-xs text-muted-foreground tabular">{m.pens_count({ count: pens.length })}</span>
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
</Sheet>
