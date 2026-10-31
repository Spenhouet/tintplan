<script lang="ts">
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { onDestroy, onMount } from 'svelte';
  import { ChevronLeft, LoaderCircle, Maximize, ScanLine } from '@lucide/svelte';
  import { toast } from 'svelte-sonner';
  import CornerEditor from '$lib/components/app/CornerEditor.svelte';
  import Segmented from '$lib/components/app/Segmented.svelte';
  import { fade, slide } from 'svelte/transition';
  import { cn } from '$lib/utils';
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
    await goto(`${resolve('/edit')}?id=${id}&scan`, { replaceState: true });
  }
</script>

<div class="flex h-dvh flex-col overflow-hidden bg-background">
  <header class="box-content flex h-14 shrink-0 items-center gap-1 px-2 pt-safe">
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
    <span class="mr-3 text-xs font-medium text-muted-foreground tabular">{step === 'crop' ? 1 : 2} / 2</span>
  </header>

  <div class="relative grid min-h-0 flex-1 bg-muted p-4">
    {#if step === 'crop' && size}
      <div class="min-h-0 stack-item" in:fade={{ duration: 200 }} out:fade={{ duration: 150 }}>
        <CornerEditor src={photoUrl} width={size.width} height={size.height} bind:quad />
      </div>
    {:else if step === 'clean' && result}
      <div class="relative min-h-0 stack-item" in:fade={{ duration: 200 }} out:fade={{ duration: 150 }}>
        <img
          src={result.url}
          alt=""
          class={cn('size-full object-contain transition-opacity duration-200', busy && 'opacity-60')}
        />
      </div>
    {:else}
      <div class="flex stack-item items-center justify-center" in:fade={{ duration: 200, delay: 100 }}>
        <LoaderCircle class="size-8 animate-spin text-muted-foreground" />
      </div>
    {/if}
    {#if busy && result}
      <div
        class="pointer-events-none absolute inset-0 flex items-center justify-center"
        transition:fade={{ duration: 150 }}
      >
        <span class="flex items-center gap-2 rounded-full bg-card px-3 py-1.5 text-sm shadow-lg">
          <LoaderCircle class="size-4 animate-spin text-primary" />{m.prepare_working()}
        </span>
      </div>
    {/if}
  </div>

  <div class="mx-auto flex w-full max-w-lg shrink-0 flex-col gap-3 px-4 pt-3 pb-safe-4">
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
      <div class="flex flex-col gap-1.5">
        <Segmented
          bind:value={enhance}
          options={[
            { value: 'on', label: m.prepare_cleanup_on() },
            { value: 'off', label: m.prepare_cleanup_off() }
          ]}
          onchange={reprocess}
        />
        <p class="px-1 text-xs text-muted-foreground">
          {enhance === 'on' ? m.prepare_cleanup_on_hint() : m.prepare_cleanup_off_hint()}
        </p>
      </div>
      {#if enhance === 'on'}
        <label class="flex flex-col gap-1" transition:slide={{ duration: 180 }}>
          <span class="flex items-baseline justify-between text-sm font-medium">
            {m.prepare_strength()}
            <span class="text-xs font-normal text-muted-foreground">
              {m.prepare_strength_faint()} – {m.prepare_strength_bold()}
            </span>
          </span>
          <input
            type="range"
            min="0"
            max="100"
            bind:value={strength}
            oninput={reprocess}
            class="w-full accent-primary"
          />
        </label>
      {/if}
      <label class="flex flex-col gap-1">
        <span class="flex items-baseline justify-between text-sm font-medium">
          {m.prepare_gaps()}
          <span class="text-xs font-normal text-muted-foreground tabular">{gap}</span>
        </span>
        <input type="range" min="0" max="8" step="1" bind:value={gap} class="w-full accent-primary" />
      </label>
      <Button size="lg" disabled={!result || busy} onclick={start}>{m.prepare_start()}</Button>
    {/if}
  </div>
</div>
