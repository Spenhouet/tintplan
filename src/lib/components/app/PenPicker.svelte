<script lang="ts">
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import { Palette } from '@lucide/svelte';
  import Sheet from './Sheet.svelte';
  import Swatch from './Swatch.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { brandShort, loadOwned, matchesQuery, type OwnedPen } from '$lib/pens';
  import { family, type Family } from '$lib/pens/color';
  import { settings, type PenRef } from '$lib/settings.svelte';
  import { m } from '$lib/paraglide/messages.js';

  /**
   * Choose a pen from the pens the user owns (Settings → My pens), all brands in one list sorted
   * as a color gradient. With `replacing`, picking a pen calls `onpick` instead of selecting it.
   */
  let {
    open = $bindable(false),
    current = null,
    replacing = null,
    onpick
  }: {
    open: boolean;
    /** The selected pen, highlighted in the list. */
    current?: PenRef | null;
    replacing?: PenRef | null;
    onpick: (pen: PenRef) => void;
  } = $props();

  let mine = $state<OwnedPen[] | null>(null);
  let query = $state('');

  $effect(() => {
    if (!open) return;
    query = '';
    loadOwned(settings.ownedAll).then((p) => (mine = p));
  });

  const pens = $derived(
    (mine ?? []).filter((p) => matchesQuery({ code: p.c, name: p.n, hex: p.hex, alt: p.alt }, query))
  );
  /** The (already color-sorted) list cut into its color families, for section headings. */
  const sections = $derived(
    pens.reduce<{ family: Family; pens: OwnedPen[] }[]>((acc, pen) => {
      const f = family(pen.hex);
      if (acc.at(-1)?.family === f) acc.at(-1)!.pens.push(pen);
      else acc.push({ family: f, pens: [pen] });
      return acc;
    }, [])
  );

  const familyNames: Record<Family, () => string> = {
    red: m.family_red,
    orange: m.family_orange,
    yellow: m.family_yellow,
    green: m.family_green,
    teal: m.family_teal,
    blue: m.family_blue,
    violet: m.family_violet,
    pink: m.family_pink,
    brown: m.family_brown,
    gray: m.family_gray
  };

  /** Show the brand under each code when pens come from more than one brand. */
  const brands = $derived(new Set((mine ?? []).map((p) => p.brand)).size);
  const marked = $derived(replacing ?? current);

  function choose(pen: OwnedPen) {
    onpick({ p: pen.p, c: pen.c, hex: pen.hex, n: pen.n });
    open = false;
  }

  function editPens() {
    open = false;
    // eslint-disable-next-line svelte/no-navigation-without-resolve -- resolved path plus query
    goto(`${resolve('/settings/pens')}?return=${encodeURIComponent(page.url.pathname + page.url.search)}`);
  }
</script>

<Sheet bind:open title={replacing ? m.replace_title({ code: replacing.c }) : m.choose_pen()}>
  {#if mine && mine.length === 0}
    <div class="flex flex-col items-center gap-3 py-6 text-center">
      <span class="flex size-14 items-center justify-center rounded-2xl bg-primary/12 text-primary">
        <Palette class="size-7" />
      </span>
      <p class="text-sm text-muted-foreground">{m.no_pens_yet()}</p>
      <Button onclick={editPens}>{m.choose_my_pens()}</Button>
    </div>
  {:else if mine}
    <div class="flex flex-col gap-3">
      <div class="flex items-center gap-2">
        <Input
          bind:value={query}
          placeholder={m.search_pens()}
          type="search"
          aria-label={m.search_pens()}
          class="flex-1"
        />
        <Button variant="ghost" size="sm" onclick={editPens}>{m.my_pens()}</Button>
      </div>
      {#if pens.length}
        <div class="flex flex-col gap-3">
          {#each sections as section (section.family)}
            <section class="flex flex-col gap-1">
              <h3 class="px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {familyNames[section.family]()}
              </h3>
              <div class="grid grid-cols-swatches gap-1">
                {#each section.pens as pen (pen.p + pen.c)}
                  <Swatch
                    hex={pen.hex}
                    code={pen.c}
                    sub={brands > 1 ? brandShort(pen.brand) : undefined}
                    details={{
                      code: pen.c,
                      name: pen.n,
                      hex: pen.hex,
                      brand: pen.brand,
                      range: pen.range,
                      alt: pen.alt
                    }}
                    selected={marked?.p === pen.p && marked?.c === pen.c}
                    onclick={() => choose(pen)}
                  />
                {/each}
              </div>
            </section>
          {/each}
        </div>
      {:else}
        <p class="py-6 text-center text-sm text-muted-foreground">{m.no_results()}</p>
      {/if}
    </div>
  {/if}
</Sheet>
