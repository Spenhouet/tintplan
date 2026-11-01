<script lang="ts">
  import { fade, scale } from 'svelte/transition';
  import { penInfo } from '$lib/peninfo.svelte';
  import { m } from '$lib/paraglide/messages.js';

  let card = $state<HTMLDivElement>();
  let size = $state({ w: 224, h: 120 });

  $effect(() => {
    if (card) size = { w: card.offsetWidth, h: card.offsetHeight };
  });

  /** Above the swatch, or below it when there's no room; always inside the screen. */
  const pos = $derived.by(() => {
    const a = penInfo.anchor;
    if (!a) return { x: 0, y: 0 };
    const margin = 8;
    const x = Math.min(innerWidth - size.w - margin, Math.max(margin, a.left + a.width / 2 - size.w / 2));
    const above = a.top - size.h - margin;
    const y = above >= margin ? above : Math.min(innerHeight - size.h - margin, a.bottom + margin);
    return { x, y };
  });

  // Touch: the card stays until the next touch anywhere
  $effect(() => {
    if (!penInfo.details) return;
    const close = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') penInfo.hide();
    };
    const t = setTimeout(() => document.addEventListener('pointerdown', close, true), 0);
    const onScroll = () => penInfo.hide();
    addEventListener('scroll', onScroll, true);
    return () => {
      clearTimeout(t);
      document.removeEventListener('pointerdown', close, true);
      removeEventListener('scroll', onScroll, true);
    };
  });
</script>

{#if penInfo.details}
  {@const d = penInfo.details}
  <div
    bind:this={card}
    role="tooltip"
    class="pointer-events-none fixed top-(--y) left-(--x) z-60 w-56 overflow-hidden surface shadow-xl"
    style="--x: {pos.x}px; --y: {pos.y}px"
    in:scale={{ duration: 140, start: 0.92 }}
    out:fade={{ duration: 100 }}
  >
    <div class="h-14 bg-(--c)" style="--c: {d.hex}"></div>
    <div class="flex flex-col gap-0.5 p-3">
      <div class="flex items-baseline gap-2">
        <span class="text-lg font-semibold tabular">{d.code}</span>
        <span class="min-w-0 flex-1 truncate text-sm">{d.name}</span>
      </div>
      {#if d.brand}
        <span class="text-xs text-muted-foreground">{d.brand}{d.range ? ` · ${d.range}` : ''}</span>
      {/if}
      <span class="text-xs text-muted-foreground tabular">
        {d.hex.toUpperCase()}{d.alt ? ` · ${m.former_code({ code: d.alt })}` : ''}
      </span>
    </div>
  </div>
{/if}
