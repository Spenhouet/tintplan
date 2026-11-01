<script lang="ts">
  import { resolve } from '$app/paths';
  import { ChevronRight } from '@lucide/svelte';
  import PageHeader from '$lib/components/app/PageHeader.svelte';
  import PaletteStrip from '$lib/components/app/PaletteStrip.svelte';
  import { loadOwned, palettes, type OwnedPen, type PaletteInfo } from '$lib/pens';
  import { settings } from '$lib/settings.svelte';
  import { returnQuery, returnTo } from '$lib/returnto';
  import { m } from '$lib/paraglide/messages.js';

  // Ranges grouped by brand, in index order
  const brands = palettes.reduce<[string, PaletteInfo[]][]>((acc, p) => {
    const last = acc.at(-1);
    if (last?.[0] === p.brand) last[1].push(p);
    else acc.push([p.brand, [p]]);
    return acc;
  }, []);

  let mine = $state<OwnedPen[]>([]);
  $effect(() => {
    loadOwned(settings.ownedAll).then((p) => (mine = p));
  });
</script>

<main class="mx-auto min-h-dvh max-w-lg px-4 pb-12 md:max-w-2xl md:px-8">
  <PageHeader title={m.my_pens()} back={returnTo(resolve('/settings'))} />

  <div class="flex flex-col gap-6">
    <section class="flex flex-col gap-3 surface p-4">
      <p class="text-sm text-muted-foreground">{m.my_pens_settings_hint()}</p>
      {#if mine.length}
        <div class="flex h-8 overflow-hidden rounded-lg ring-1 ring-border ring-inset">
          {#each mine as pen (pen.p + pen.c)}
            <span class="h-full min-w-px flex-1 bg-(--c)" style="--c: {pen.hex}"></span>
          {/each}
        </div>
      {/if}
      <p class="text-sm font-medium tabular">
        {settings.ownedCount === 1 ? m.pens_count_one() : m.pens_count_other({ count: settings.ownedCount })}
      </p>
    </section>

    <!-- eslint-disable svelte/no-navigation-without-resolve -- resolved path plus query -->
    {#each brands as [brand, list] (brand)}
      <section class="flex flex-col gap-1.5">
        <h2 class="px-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{brand}</h2>
        <div class="divide-y overflow-hidden surface">
          {#each list as p (p.id)}
            {@const owned = settings.owned(p.id).length}
            <a
              href={`${resolve('/settings/pens/range')}?id=${p.id}${returnQuery().replace('?', '&')}`}
              class="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/60 active:bg-muted"
            >
              <PaletteStrip colors={p.preview} />
              <span class="min-w-0 flex-1">
                <span class="block truncate text-body font-medium">{p.name}</span>
                <span class="block truncate text-xs text-muted-foreground tabular">
                  {owned ? m.owned_of({ owned, total: p.count }) : m.pens_count_other({ count: p.count })}
                </span>
              </span>
              {#if owned}
                <span class="rounded-full bg-primary/12 px-2 py-0.5 text-xs font-medium text-primary tabular"
                  >{owned}</span
                >
              {/if}
              <ChevronRight class="size-4 shrink-0 text-muted-foreground" />
            </a>
          {/each}
        </div>
      </section>
    {/each}
    <!-- eslint-enable svelte/no-navigation-without-resolve -->
  </div>
</main>
