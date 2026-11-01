<script lang="ts">
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import { Check } from '@lucide/svelte';
  import PageHeader from '$lib/components/app/PageHeader.svelte';
  import Swatch from '$lib/components/app/Swatch.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { loadPalette, matchesQuery, paletteInfo, type Palette } from '$lib/pens';
  import { settings } from '$lib/settings.svelte';
  import { returnQuery } from '$lib/returnto';
  import { cn } from '$lib/utils';
  import { m } from '$lib/paraglide/messages.js';

  const id = $derived(page.url.searchParams.get('id') ?? '');
  const info = $derived(paletteInfo(id));
  let palette = $state<Palette | null>(null);
  let query = $state('');

  $effect(() => {
    if (id) loadPalette(id).then((p) => (palette = p));
  });

  const owned = $derived(new Set(settings.owned(id)));
  const pens = $derived(palette?.pens.filter((p) => matchesQuery(p, query)) ?? []);

  /** Sets named only by their size read as "24 pens"; named sets keep their name. */
  const setLabel = (name: string, count: number) =>
    /^\d+$/.test(name) ? m.pens_count_other({ count }) : name.includes(String(count)) ? name : `${name} (${count})`;

  /** Adding a set adds all its pens; tapping a complete set removes them again. */
  function toggleSet(codes: string[]) {
    const all = codes.every((c) => owned.has(c));
    // eslint-disable-next-line svelte/prefer-svelte-reactivity -- local copy, stored through settings
    const next = new Set(owned);
    for (const c of codes) {
      if (all) next.delete(c);
      else next.add(c);
    }
    settings.setOwned(id, next);
  }
</script>

<main class="mx-auto min-h-dvh max-w-lg px-4 pb-12 md:max-w-2xl md:px-8">
  <PageHeader
    title={info ? `${info.brand} ${info.name}` : m.my_pens()}
    back={`${resolve('/settings/pens')}${returnQuery()}`}
  />

  {#if palette}
    <div class="flex flex-col gap-5">
      {#if palette.sets.length}
        <section class="flex flex-col gap-2">
          <h2 class="px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{m.sets()}</h2>
          <p class="px-1 text-xs text-muted-foreground">{m.sets_hint()}</p>
          <div class="flex flex-wrap gap-1.5">
            {#each palette.sets as s (s.id)}
              {@const complete = s.codes.every((c) => owned.has(c))}
              <button
                type="button"
                aria-pressed={complete}
                class={cn(
                  'flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium transition-all active:scale-95',
                  complete
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                )}
                onclick={() => toggleSet(s.codes)}
              >
                {#if complete}<Check class="size-3.5" />{/if}{setLabel(s.name, s.codes.length)}
              </button>
            {/each}
          </div>
        </section>
      {/if}

      <section class="flex flex-col gap-2">
        <div class="flex items-center gap-2 px-1">
          <h2 class="flex-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase tabular">
            {m.owned_of({ owned: owned.size, total: palette.pens.length })}
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onclick={() =>
              palette &&
              settings.setOwned(
                id,
                palette.pens.map((p) => p.code)
              )}>{m.select_all()}</Button
          >
          <Button variant="ghost" size="sm" onclick={() => settings.setOwned(id, [])}>{m.select_none()}</Button>
        </div>
        <Input bind:value={query} placeholder={m.search_pens()} type="search" aria-label={m.search_pens()} />
        <div class="grid grid-cols-swatches gap-1">
          {#each pens as pen (pen.code)}
            <Swatch
              hex={pen.hex}
              code={pen.code}
              details={{
                code: pen.code,
                name: pen.name,
                hex: pen.hex,
                brand: info?.brand,
                range: info?.name,
                alt: pen.alt
              }}
              checked={owned.has(pen.code)}
              dimmed={!owned.has(pen.code)}
              onclick={() => settings.toggleOwned(id, pen.code)}
            />
          {/each}
        </div>
      </section>
    </div>
  {/if}
</main>
