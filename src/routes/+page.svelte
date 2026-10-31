<script lang="ts">
  import { resolve } from '$app/paths';
  import { liveQuery } from 'dexie';
  import { Palette, Settings, Trash2 } from '@lucide/svelte';
  import { onDestroy } from 'svelte';
  import { fade } from 'svelte/transition';
  import PageHeader from '$lib/components/app/PageHeader.svelte';
  import ImportButtons from '$lib/components/app/ImportButtons.svelte';
  import Confirm from '$lib/components/app/Confirm.svelte';
  import { Button } from '$lib/components/ui/button';
  import { db, type Project } from '$lib/db';
  import { m } from '$lib/paraglide/messages.js';
  import { getLocale } from '$lib/paraglide/runtime';

  const projects = liveQuery(() => db.projects.orderBy('updatedAt').reverse().toArray());

  // Object URLs for thumbnails, revoked when the blob changes or the page closes
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- local, not reactive state
  const urls = new Map<string, { blob: Blob; url: string }>();
  function thumb(p: Project): string | undefined {
    if (!p.thumb) return undefined;
    const hit = urls.get(p.id);
    if (hit?.blob === p.thumb) return hit.url;
    if (hit) URL.revokeObjectURL(hit.url);
    const url = URL.createObjectURL(p.thumb);
    urls.set(p.id, { blob: p.thumb, url });
    return url;
  }
  onDestroy(() => urls.forEach((u) => URL.revokeObjectURL(u.url)));

  const date = (t: number) =>
    new Date(t).toLocaleDateString(getLocale(), { day: 'numeric', month: 'short', year: 'numeric' });

  let toDelete = $state<Project | null>(null);
  let confirmOpen = $state(false);
</script>

<main class="mx-auto min-h-dvh max-w-lg px-4 pb-12 md:max-w-5xl md:px-8">
  <PageHeader title={m.library_title()}>
    {#snippet actions()}
      <Button variant="ghost" size="icon" href={resolve('/settings')} aria-label={m.settings()}>
        <Settings class="size-5" />
      </Button>
    {/snippet}
  </PageHeader>

  {#if $projects && $projects.length === 0}
    <section class="mx-auto mt-6 flex max-w-sm animate-rise flex-col items-center gap-4 surface p-6 text-center">
      <span class="flex size-16 items-center justify-center rounded-2xl bg-primary/12 text-primary">
        <Palette class="size-8" />
      </span>
      <div class="flex flex-col gap-1">
        <h2 class="text-lg font-semibold">{m.library_empty_title()}</h2>
        <p class="text-sm text-muted-foreground">{m.library_empty_text()}</p>
      </div>
      <div class="w-full"><ImportButtons stacked /></div>
    </section>
  {:else if $projects}
    <div class="mb-4"><ImportButtons size="default" /></div>
    <ul class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 md:gap-4">
      {#each $projects as p, i (p.id)}
        <li
          class="relative animate-rise overflow-hidden surface transition-transform delay-stagger active:scale-98"
          style="--i: {i}"
          out:fade={{ duration: 150 }}
        >
          <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
          <a href={`${resolve('/edit')}?id=${p.id}`} class="flex flex-col">
            <div class="flex aspect-3/4 items-center justify-center bg-muted">
              {#if thumb(p)}
                <img src={thumb(p)} alt="" class="size-full object-contain" />
              {/if}
            </div>
            <div class="flex flex-col p-3 pr-10">
              <span class="truncate text-sm font-medium">{p.name}</span>
              <span class="truncate text-xs text-muted-foreground">{m.edited({ date: date(p.updatedAt) })}</span>
            </div>
          </a>
          <Button
            variant="ghost"
            size="icon-sm"
            class="absolute right-1.5 bottom-2"
            aria-label={m.delete()}
            onclick={() => {
              toDelete = p;
              confirmOpen = true;
            }}><Trash2 /></Button
          >
        </li>
      {/each}
    </ul>
  {/if}
</main>

<Confirm
  bind:open={confirmOpen}
  title={m.delete_page_title()}
  message={m.delete_page_text({ name: toDelete?.name ?? '' })}
  confirmLabel={m.delete()}
  destructive
  onconfirm={() => toDelete && db.projects.delete(toDelete.id)}
/>
