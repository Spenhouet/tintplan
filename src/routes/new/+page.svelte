<script lang="ts">
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { onDestroy, onMount } from 'svelte';
  import { fade, slide } from 'svelte/transition';
  import { ChevronLeft, Eye, EyeOff, LoaderCircle, Maximize, ScanLine } from '@lucide/svelte';
  import { toast } from 'svelte-sonner';
  import CornerEditor from '$lib/components/app/CornerEditor.svelte';
  import Segmented from '$lib/components/app/Segmented.svelte';
  import Viewport from '$lib/components/app/Viewport.svelte';
  import ScanOverlay from '$lib/components/app/ScanOverlay.svelte';
  import { Button } from '$lib/components/ui/button';
  import { run, type DisplayMode, type Response } from '$lib/image/protocol';
  import { fullQuad } from '$lib/image/warp';
  import type { Quad } from '$lib/image/gray';
  import { db, newId } from '$lib/db';
  import { pending } from '$lib/pending';
  import { settings } from '$lib/settings.svelte';
  import { cn } from '$lib/utils';
  import { m } from '$lib/paraglide/messages.js';
  import { getLocale } from '$lib/paraglide/runtime';

  /** Longest side of the page. Enough detail for coloring pages, light enough for phones. */
  const MAX_SIDE = 1800;

  const file = pending.file;
  const photoUrl = file ? URL.createObjectURL(file) : '';

  let step = $state<'crop' | 'areas'>('crop');
  let size = $state<{ width: number; height: number } | null>(null);
  let detected = $state<Quad | null>(null);
  let quad = $state<Quad>(fullQuad(1, 1));

  let mode = $state<DisplayMode>('lines');
  /** Slider positions: line detection 0..100, gap closing 0..6 (per mille of the page size). */
  let strength = $state(55);
  let gapLevel = $state(1.5);

  let detection = $state<Extract<Response, { type: 'detect' }> | null>(null);
  /** Bumped per detection, replays the scan. */
  let scanRun = $state(0);
  let image = $state<{ url: string; blob: Blob; mode: DisplayMode } | null>(null);
  let showAreas = $state(true);
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
    if (image) URL.revokeObjectURL(image.url);
  });

  // Only the latest request wins; slider moves while a detection runs are picked up after it
  let job = 0;
  async function detect() {
    const mine = ++job;
    busy = true;
    try {
      const r = await run({
        type: 'detect',
        quad: $state.snapshot(quad) as Quad,
        maxSide: MAX_SIDE,
        strength: strength / 100,
        gapLevel
      });
      if (mine !== job) return;
      detection = r;
      scanRun++;
      await showImage(mode, mine);
    } catch (e) {
      toast.error(String(e));
    } finally {
      if (mine === job) busy = false;
    }
  }

  async function showImage(next: DisplayMode, mine = job) {
    const r = await run({ type: 'display', mode: next });
    if (mine !== job) return;
    if (image) URL.revokeObjectURL(image.url);
    image = { url: URL.createObjectURL(r.image), blob: r.image, mode: next };
  }

  let timer: ReturnType<typeof setTimeout>;
  function redetect() {
    clearTimeout(timer);
    timer = setTimeout(detect, 200);
  }

  async function start() {
    if (!detection || !image) return;
    busy = true;
    const now = Date.now();
    const id = newId();
    const date = new Date(now).toLocaleDateString(getLocale(), { day: 'numeric', month: 'short' });
    await db.projects.add({
      id,
      name: m.page_name_default({ date }),
      createdAt: now,
      updatedAt: now,
      width: detection.width,
      height: detection.height,
      line: image.blob,
      outline: detection.outline,
      gap: detection.gap,
      minArea: detection.minArea,
      fills: [],
      paletteId: settings.paletteId
    });
    pending.file = null;
    // eslint-disable-next-line svelte/no-navigation-without-resolve -- resolved path plus query
    await goto(`${resolve('/edit')}?id=${id}`, { replaceState: true });
  }

  const hints: Record<DisplayMode, () => string> = {
    lines: m.mode_lines_hint,
    gray: m.mode_gray_hint,
    original: m.mode_original_hint
  };
</script>

<div class="flex h-dvh flex-col overflow-hidden bg-background">
  <header class="box-content flex h-14 shrink-0 items-center gap-1 px-2 pt-safe">
    <Button
      variant="ghost"
      size="icon"
      aria-label={m.back()}
      onclick={() => (step === 'areas' ? (step = 'crop') : goto(resolve('/')))}
    >
      <ChevronLeft class="size-6" />
    </Button>
    <h1 class="flex-1 truncate text-lg font-semibold">
      {step === 'crop' ? m.prepare_crop_title() : m.prepare_areas_title()}
    </h1>
    <span class="mr-3 text-xs font-medium text-muted-foreground tabular">{step === 'crop' ? 1 : 2} / 2</span>
  </header>

  <div class="relative grid min-h-0 flex-1 bg-muted">
    {#if step === 'crop' && size}
      <div class="min-h-0 stack-item p-4" in:fade={{ duration: 200 }} out:fade={{ duration: 150 }}>
        <CornerEditor src={photoUrl} width={size.width} height={size.height} bind:quad />
      </div>
    {:else if step === 'areas' && detection && image}
      <div class="min-h-0 stack-item" in:fade={{ duration: 200 }} out:fade={{ duration: 150 }}>
        <Viewport width={detection.width} height={detection.height} ontap={() => (showAreas = !showAreas)}>
          <img src={image.url} alt="" class="absolute inset-0 size-full bg-card" draggable="false" />
          {#if showAreas}
            {#key scanRun}
              <ScanOverlay map={detection.scan} hold sweep={scanRun > 1 ? 0.6 : 1.2} />
            {/key}
          {/if}
          {#snippet overlay()}
            <div class="pointer-events-none absolute inset-x-3 top-3 flex items-center justify-between gap-2">
              <span
                class="flex items-center gap-1.5 rounded-full bg-card/90 px-3 py-1.5 text-sm font-medium tabular shadow-lg ring-1 ring-border backdrop-blur-sm"
              >
                {#if busy}<LoaderCircle class="size-4 animate-spin text-primary" />{/if}
                {m.areas_found({ count: detection?.count ?? 0 })}
              </span>
              <span class="pointer-events-auto">
                <Button
                  variant="floating"
                  size="icon"
                  aria-label={m.show_areas()}
                  aria-pressed={showAreas}
                  onclick={() => (showAreas = !showAreas)}
                >
                  {#if showAreas}<Eye />{:else}<EyeOff />{/if}
                </Button>
              </span>
            </div>
          {/snippet}
        </Viewport>
      </div>
    {:else}
      <div class="flex stack-item items-center justify-center" in:fade={{ duration: 200, delay: 100 }}>
        <LoaderCircle class="size-8 animate-spin text-muted-foreground" />
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
          step = 'areas';
          detection = null;
          detect();
        }}>{m.next()}</Button
      >
    {:else}
      <div class="flex flex-col gap-1.5" in:slide={{ duration: 180 }}>
        <Segmented
          bind:value={mode}
          options={[
            { value: 'lines', label: m.mode_lines() },
            { value: 'gray', label: m.mode_gray() },
            { value: 'original', label: m.mode_original() }
          ]}
          onchange={(v) => detection && showImage(v)}
        />
        <p class="px-1 text-xs text-muted-foreground">{hints[mode]()}</p>
      </div>
      <label class="flex flex-col gap-1">
        <span class="flex items-baseline justify-between text-sm font-medium">
          {m.detect_lines()}
          <span class="text-xs font-normal text-muted-foreground">{m.detect_less()} – {m.detect_more()}</span>
        </span>
        <input type="range" min="0" max="100" bind:value={strength} oninput={redetect} class="w-full accent-primary" />
      </label>
      <label class="flex flex-col gap-1">
        <span class="flex items-baseline justify-between text-sm font-medium">
          {m.prepare_gaps()}
          <span class="text-xs font-normal text-muted-foreground">{m.gaps_off()} – {m.gaps_strong()}</span>
        </span>
        <input
          type="range"
          min="0"
          max="6"
          step="0.5"
          bind:value={gapLevel}
          oninput={redetect}
          class="w-full accent-primary"
        />
      </label>
      <p class={cn('px-1 text-xs text-muted-foreground', !detection && 'invisible')}>{m.areas_hint()}</p>
      <Button size="lg" disabled={!detection || !image || busy} onclick={start}>{m.prepare_start()}</Button>
    {/if}
  </div>
</div>
