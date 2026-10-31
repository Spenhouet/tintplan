<script lang="ts">
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { onDestroy, onMount } from 'svelte';
  import { ChevronLeft, LoaderCircle, Maximize, ScanLine } from '@lucide/svelte';
  import { toast } from 'svelte-sonner';
  import CornerEditor from '$lib/components/app/CornerEditor.svelte';
  import Segmented from '$lib/components/app/Segmented.svelte';
  import Field from '$lib/components/app/Field.svelte';
  import { Button } from '$lib/components/ui/button';
  import { run } from '$lib/image/protocol';
  import { fullQuad } from '$lib/image/warp';
  import type { Quad } from '$lib/image/gray';
  import { db, newId } from '$lib/db';
  import { pending } from '$lib/pending';
  import { settings } from '$lib/settings.svelte';
  import { m } from '$lib/paraglide/messages.js';
  import { getLocale } from '$lib/paraglide/runtime';

  /** Longest side of the cleaned page. Enough for A4 line art, small enough for phones. */
  const MAX_SIDE = 2048;

  const file = pending.file;
  const photoUrl = file ? URL.createObjectURL(file) : '';

  let step = $state<'crop' | 'clean'>('crop');
  let size = $state<{ width: number; height: number } | null>(null);
  let detected = $state<Quad | null>(null);
  let quad = $state<Quad>(fullQuad(1, 1));
  let enhance = $state<'on' | 'off'>('on');
  let strength = $state(50);
  let gap = $state(3);
  let result = $state<{ url: string; png: Blob; width: number; height: number } | null>(null);
  let busy = $state(false);

  onMount(async () => {
    if (!file) {
      toast.error(m.prepare_lost());
      await goto(resolve('/'), { replaceState: true });
      return;
    }
    try {
      const r = await run({ type: 'load', blob: file });
      size = { width: r.width, height: r.height };
      detected = r.quad;
      quad = r.quad ?? fullQuad(r.width, r.height);
    } catch {
      toast.error(m.import_failed());
      await goto(resolve('/'), { replaceState: true });
    }
  });

  onDestroy(() => {
    URL.revokeObjectURL(photoUrl);
    if (result) URL.revokeObjectURL(result.url);
  });

  let job = 0;
  async function process() {
    const mine = ++job;
    busy = true;
    try {
      const r = await run({
        type: 'process',
        quad: $state.snapshot(quad) as Quad,
        enhance: enhance === 'on',
        strength: strength / 100,
        maxSide: MAX_SIDE
      });
      if (mine !== job) return;
      if (result) URL.revokeObjectURL(result.url);
      result = { url: URL.createObjectURL(r.png), png: r.png, width: r.width, height: r.height };
    } finally {
      if (mine === job) busy = false;
    }
  }

  let timer: ReturnType<typeof setTimeout>;
  function reprocess() {
    clearTimeout(timer);
    timer = setTimeout(process, 250);
  }

  async function start() {
    if (!result) return;
    busy = true;
    const now = Date.now();
    const id = newId();
    const date = new Date(now).toLocaleDateString(getLocale(), { day: 'numeric', month: 'short' });
    await db.projects.add({
      id,
      name: m.page_name_default({ date }),
      createdAt: now,
      updatedAt: now,
      width: result.width,
      height: result.height,
      line: result.png,
      gap,
      fills: [],
      paletteId: settings.paletteId
    });
    pending.file = null;
    // eslint-disable-next-line svelte/no-navigation-without-resolve -- resolved path plus query
    await goto(`${resolve('/edit')}?id=${id}`, { replaceState: true });
  }
</script>

<div class="flex h-dvh flex-col bg-background">
  <header class="flex h-14 shrink-0 items-center gap-1 px-2 pt-safe">
    <Button
      variant="ghost"
      size="icon"
      aria-label={m.back()}
      onclick={() => (step === 'clean' ? (step = 'crop') : goto(resolve('/')))}
    >
      <ChevronLeft class="size-6" />
    </Button>
    <h1 class="flex-1 truncate text-lg font-semibold">
      {step === 'crop' ? m.prepare_crop_title() : m.prepare_clean_title()}
    </h1>
    {#if busy}<LoaderCircle class="mr-3 size-5 animate-spin text-muted-foreground" />{/if}
  </header>

  <div class="min-h-0 flex-1 bg-muted p-4">
    {#if step === 'crop' && size}
      <CornerEditor src={photoUrl} width={size.width} height={size.height} bind:quad />
    {:else if step === 'clean' && result}
      <img src={result.url} alt="" class="size-full object-contain" />
    {:else}
      <div class="flex size-full items-center justify-center">
        <LoaderCircle class="size-8 animate-spin text-muted-foreground" />
      </div>
    {/if}
  </div>

  <div class="mx-auto flex w-full max-w-lg shrink-0 flex-col gap-4 p-4 pb-safe-4">
    {#if step === 'crop'}
      <p class="text-sm text-muted-foreground">{m.prepare_crop_hint()}</p>
      <div class="flex gap-2">
        <Button
          variant="outline"
          class="flex-1"
          disabled={!size}
          onclick={() => size && (quad = fullQuad(size.width, size.height))}
        >
          <Maximize />{m.prepare_reset()}
        </Button>
        {#if detected}
          <Button variant="outline" class="flex-1" onclick={() => detected && (quad = detected)}>
            <ScanLine />{m.prepare_detect()}
          </Button>
        {/if}
      </div>
      <Button
        size="lg"
        disabled={!size}
        onclick={() => {
          step = 'clean';
          process();
        }}>{m.next()}</Button
      >
    {:else}
      <Segmented
        bind:value={enhance}
        options={[
          { value: 'on', label: m.prepare_cleanup_on() },
          { value: 'off', label: m.prepare_cleanup_off() }
        ]}
        onchange={reprocess}
      />
      <p class="-mt-2 text-xs text-muted-foreground">{m.prepare_cleanup_hint()}</p>
      {#if enhance === 'on'}
        <Field label={m.prepare_strength()} hint={m.prepare_strength_hint()}>
          <input
            type="range"
            min="0"
            max="100"
            bind:value={strength}
            oninput={reprocess}
            class="w-full accent-primary"
          />
        </Field>
      {/if}
      <Field label={m.prepare_gaps()} hint={m.prepare_gaps_hint()}>
        <input type="range" min="0" max="8" step="1" bind:value={gap} class="w-full accent-primary" />
      </Field>
      <Button size="lg" disabled={!result || busy} onclick={start}>{m.prepare_start()}</Button>
    {/if}
  </div>
</div>
