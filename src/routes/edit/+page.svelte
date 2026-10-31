<script lang="ts">
  import { goto, replaceState } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import { onDestroy, onMount } from 'svelte';
  import {
    ChevronLeft,
    Eraser,
    Hash,
    ListChecks,
    LoaderCircle,
    Maximize,
    PaintBucket,
    Pipette,
    Plus,
    Redo2,
    Share,
    Undo2
  } from '@lucide/svelte';
  import { toast } from 'svelte-sonner';
  import Viewport from '$lib/components/app/Viewport.svelte';
  import ScanOverlay from '$lib/components/app/ScanOverlay.svelte';
  import Swatch from '$lib/components/app/Swatch.svelte';
  import PenPicker from '$lib/components/app/PenPicker.svelte';
  import LegendSheet from '$lib/components/app/LegendSheet.svelte';
  import ExportSheet from '$lib/components/app/ExportSheet.svelte';
  import RenameSheet from '$lib/components/app/RenameSheet.svelte';
  import { Button } from '$lib/components/ui/button';
  import { fade, scale } from 'svelte/transition';
  import { haptic } from '$lib/native';
  import { Editor, type Tool } from '$lib/editor.svelte';
  import { settings } from '$lib/settings.svelte';
  import { cn } from '$lib/utils';
  import { m } from '$lib/paraglide/messages.js';

  let editor = $state<Editor | null>(null);
  let canvas = $state<HTMLCanvasElement>();
  let pickerOpen = $state(false);
  let legendOpen = $state(false);
  let exportOpen = $state(false);
  let renameOpen = $state(false);
  /** Show the area scan once, right after a page is created or imported. */
  let scanning = $state(false);

  onMount(async () => {
    const id = page.url.searchParams.get('id');
    const e = id ? await Editor.open(id) : null;
    if (!e) {
      toast.error(m.page_missing());
      await goto(resolve('/'), { replaceState: true });
      return;
    }
    editor = e;
    if (page.url.searchParams.has('scan')) {
      scanning = true;
      const url = new URL(page.url);
      url.searchParams.delete('scan');
      // eslint-disable-next-line svelte/no-navigation-without-resolve -- same page, query only
      replaceState(url, {});
    }
  });

  $effect(() => {
    if (editor && canvas) editor.attach(canvas);
  });

  // Write pending changes when leaving the page or the app
  function flush() {
    if (editor?.dirty) editor.save();
  }
  onMount(() => {
    const hide = () => document.visibilityState === 'hidden' && flush();
    document.addEventListener('visibilitychange', hide);
    return () => document.removeEventListener('visibilitychange', hide);
  });
  onDestroy(flush);

  const labels = $derived.by(() => {
    if (!editor || !editor.showCodes) return [];
    void editor.version;
    return editor.labels(settings.labelScale);
  });

  /** Pens for the quick strip: this page's, then recent ones. */
  const strip = $derived.by(() => {
    if (!editor) return [];
    void editor.version;
    const used = editor.usedPens().map((u) => u.pen);
    const rest = settings.recent.filter((r) => !used.some((u) => u.p === r.p && u.c === r.c));
    return [...used, ...rest].slice(0, 30);
  });

  let viewport = $state<Viewport>();
  let zoomed = $state(false);

  /** Short-lived rings where a tap changed the page. */
  let ripples = $state<{ id: number; x: number; y: number; hex: string }[]>([]);
  let rippleId = 0;

  function tap(x: number, y: number, screen: { x: number; y: number }) {
    if (!editor) return;
    if (editor.tool === 'fill' && !editor.pen) {
      pickerOpen = true;
      toast(m.no_pen_hint());
      return;
    }
    const result = editor.tap(x, y);
    if (!result) return;
    haptic();
    const hex = result === 'erased' ? '#9ca3af' : (editor.pen?.hex ?? '#7c3aed');
    const id = ++rippleId;
    ripples = [...ripples, { id, ...screen, hex }];
    setTimeout(() => (ripples = ripples.filter((r) => r.id !== id)), 550);
  }

  function keydown(e: KeyboardEvent) {
    if (!editor || !(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z') return;
    e.preventDefault();
    if (e.shiftKey) editor.redo();
    else editor.undo();
  }

  const tools: { value: Tool; label: () => string; icon: typeof PaintBucket }[] = [
    { value: 'fill', label: m.tool_fill, icon: PaintBucket },
    { value: 'erase', label: m.tool_erase, icon: Eraser },
    { value: 'pick', label: m.tool_pick, icon: Pipette }
  ];
</script>

<svelte:window onkeydown={keydown} />

<div class="flex h-dvh flex-col overflow-hidden bg-background">
  <header class="box-content flex h-14 shrink-0 items-center gap-0.5 px-2 pt-safe">
    <Button variant="ghost" size="icon" href={resolve('/')} aria-label={m.back()}>
      <ChevronLeft class="size-6" />
    </Button>
    <button
      type="button"
      class="min-w-0 flex-1 truncate rounded-lg px-1 py-1 text-left text-lg font-semibold hover:bg-muted"
      disabled={!editor}
      onclick={() => (renameOpen = true)}>{editor?.name ?? ''}</button
    >
    <Button
      variant="ghost"
      size="icon"
      aria-label={m.undo()}
      disabled={!editor?.canUndo}
      onclick={() => editor?.undo()}
    >
      <Undo2 />
    </Button>
    <Button
      variant="ghost"
      size="icon"
      aria-label={m.redo()}
      disabled={!editor?.canRedo}
      onclick={() => editor?.redo()}
    >
      <Redo2 />
    </Button>
    <Button
      variant="ghost"
      size="icon"
      aria-label={m.pens_used()}
      disabled={!editor}
      onclick={() => (legendOpen = true)}
    >
      <ListChecks />
    </Button>
    <Button variant="ghost" size="icon" aria-label={m.export()} disabled={!editor} onclick={() => (exportOpen = true)}>
      <Share />
    </Button>
  </header>

  <div class="min-h-0 flex-1 bg-muted">
    {#if editor}
      <Viewport
        bind:this={viewport}
        width={editor.width}
        height={editor.height}
        ontap={tap}
        onzoom={(z) => (zoomed = z)}
      >
        <canvas bind:this={canvas} class="absolute inset-0 size-full bg-card"></canvas>
        {#if labels.length}
          <svg
            viewBox="0 0 {editor.width} {editor.height}"
            class="pointer-events-none absolute inset-0 size-full font-semibold"
            aria-hidden="true"
            transition:fade={{ duration: 150 }}
          >
            {#each labels as l (l.region)}
              <text
                x={l.x}
                y={l.y}
                font-size={l.size}
                text-anchor="middle"
                dominant-baseline="central"
                stroke-width={l.size * (l.tight ? 0.28 : 0.18)}
                stroke-linejoin="round"
                paint-order="stroke"
                class={l.dark ? 'fill-white stroke-black/55' : 'fill-black stroke-white/85'}>{l.text}</text
              >
            {/each}
          </svg>
        {/if}
        {#if scanning}
          <ScanOverlay map={editor.seg.scan} onend={() => (scanning = false)} />
        {/if}
        {#snippet overlay()}
          {#each ripples as r (r.id)}
            <span
              class="pointer-events-none absolute top-(--y) left-(--x) size-20 animate-ripple rounded-full border-4 border-(--c)"
              style="--x: {r.x}px; --y: {r.y}px; --c: {r.hex}"
            ></span>
          {/each}
          {#if zoomed}
            <div class="absolute right-3 bottom-3" transition:scale={{ duration: 160, start: 0.8 }}>
              <Button variant="floating" size="icon" aria-label={m.fit_page()} onclick={() => viewport?.fit(true)}>
                <Maximize />
              </Button>
            </div>
          {/if}
        {/snippet}
      </Viewport>
    {:else}
      <div class="flex size-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle class="size-8 animate-spin" />
        {m.loading_page()}
      </div>
    {/if}
  </div>

  {#if editor}
    <div class="shrink-0 border-t bg-card pb-safe">
      <div class="flex items-center gap-1 px-2 pt-2">
        <button
          type="button"
          class="flex shrink-0 flex-col items-center gap-1 rounded-xl p-1 hover:bg-muted"
          aria-label={m.choose_pen()}
          onclick={() => (pickerOpen = true)}
        >
          {#if editor.pen}
            <span
              class="flex h-10 w-16 items-center justify-center rounded-lg bg-(--c) ring-2 ring-primary ring-offset-2 ring-offset-card"
              style="--c: {editor.pen.hex}"
            ></span>
            <span class="max-w-16 truncate text-caption font-semibold tabular">{editor.pen.c}</span>
          {:else}
            <span class="flex h-10 w-16 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Plus class="size-5" />
            </span>
            <span class="text-caption font-medium">{m.pens()}</span>
          {/if}
        </button>
        <div class="flex min-w-0 flex-1 gap-0.5 overflow-x-auto">
          {#each strip as p (p.p + p.c)}
            <Swatch
              size="sm"
              hex={p.hex}
              code={p.c}
              title={p.n}
              selected={editor.pen?.p === p.p && editor.pen?.c === p.c}
              onclick={() => editor?.choosePen(p)}
            />
          {/each}
          <button
            type="button"
            class="flex w-12 shrink-0 flex-col items-center gap-1 rounded-xl p-1 text-muted-foreground hover:bg-muted"
            aria-label={m.choose_pen()}
            onclick={() => (pickerOpen = true)}
          >
            <span class="flex h-8 w-full items-center justify-center rounded-lg border border-dashed"
              ><Plus class="size-4" /></span
            >
            <span class="text-caption font-medium">{m.pens()}</span>
          </button>
        </div>
      </div>
      <div class="mx-auto grid max-w-lg grid-cols-4 gap-1 px-2 pt-1 pb-2" role="toolbar">
        {#each tools as t (t.value)}
          <button
            type="button"
            aria-pressed={editor.tool === t.value}
            class={cn(
              'flex h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-caption font-medium transition-all active:scale-95',
              editor.tool === t.value ? 'bg-primary/12 text-primary' : 'text-muted-foreground hover:bg-muted'
            )}
            onclick={() => editor && (editor.tool = t.value)}
          >
            <t.icon class="size-5" />{t.label()}
          </button>
        {/each}
        <button
          type="button"
          aria-pressed={editor.showCodes}
          aria-label={m.show_codes()}
          class={cn(
            'flex h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-caption font-medium transition-all active:scale-95',
            editor.showCodes ? 'bg-primary/12 text-primary' : 'text-muted-foreground hover:bg-muted'
          )}
          onclick={() => editor && (editor.showCodes = !editor.showCodes)}
        >
          <Hash class="size-5" />{m.codes()}
        </button>
      </div>
    </div>

    <PenPicker bind:open={pickerOpen} {editor} />
    <LegendSheet bind:open={legendOpen} {editor} />
    <ExportSheet bind:open={exportOpen} {editor} />
    <RenameSheet bind:open={renameOpen} name={editor.name} onsave={(n) => editor?.rename(n)} />
  {/if}
</div>
