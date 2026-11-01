<script lang="ts">
  import { Dialog as DialogPrimitive } from 'bits-ui';
  import { ChevronLeft, X } from '@lucide/svelte';
  import type { Snippet } from 'svelte';

  let {
    open = $bindable(false),
    title,
    header,
    footer,
    onback,
    children
  }: {
    open: boolean;
    title: string;
    header?: Snippet;
    footer?: Snippet;
    /** Shows a back arrow before the title, for sheets with a sub-view. */
    onback?: () => void;
    children: Snippet;
  } = $props();

  let content = $state<HTMLElement | null>(null);
  let scroller = $state<HTMLElement | null>(null);

  $effect(() => {
    const el = scroller;
    if (!el) return;
    let pull: { y: number; t: number; dy: number; active: boolean } | null = null;
    const start = (e: TouchEvent) => {
      if (e.touches.length !== 1 || matchMedia('(min-width: 640px)').matches) return;
      pull = { y: e.touches[0].clientY, t: performance.now(), dy: 0, active: false };
    };
    const move = (e: TouchEvent) => {
      if (!pull || !content) return;
      const dy = e.touches[0].clientY - pull.y;
      if (!pull.active) {
        // Only a downward pull from the very top; anything else is normal scrolling
        if (el.scrollTop > 0 || dy < 8) {
          if (dy < -8 || el.scrollTop > 0) pull = null;
          return;
        }
        pull.active = true;
        pull.y += 8;
        pull.t = performance.now();
      }
      e.preventDefault();
      pull.dy = Math.max(0, e.touches[0].clientY - pull.y);
      content.style.transition = 'none';
      content.style.transform = `translateY(${pull.dy}px)`;
    };
    const end = () => {
      if (pull?.active) release(pull);
      pull = null;
    };
    el.addEventListener('touchstart', start, { passive: true });
    el.addEventListener('touchmove', move, { passive: false });
    el.addEventListener('touchend', end);
    el.addEventListener('touchcancel', end);
    return () => {
      el.removeEventListener('touchstart', start);
      el.removeEventListener('touchmove', move);
      el.removeEventListener('touchend', end);
      el.removeEventListener('touchcancel', end);
    };
  });
  /** Set when the sheet was swiped away, so the exit animation doesn't play a second time. */
  let swiped = $state(false);

  $effect(() => {
    if (open) {
      swiped = false;
      if (content) content.style.transform = content.style.transition = '';
    }
  });

  // Drag the handle or title bar down to close (bottom sheet layout only)
  let drag: { y: number; t: number; dy: number; moved: boolean } | null = null;

  function down(e: PointerEvent) {
    if (!content || matchMedia('(min-width: 640px)').matches) return;
    drag = { y: e.clientY, t: performance.now(), dy: 0, moved: false };
  }

  function move(e: PointerEvent) {
    if (!drag || !content) return;
    const dy = e.clientY - drag.y;
    if (!drag.moved && Math.abs(dy) < 6) return;
    if (!drag.moved) (e.currentTarget as Element).setPointerCapture(e.pointerId);
    drag.moved = true;
    // Pulling up gives a little resistance, pulling down follows the finger
    drag.dy = dy > 0 ? dy : dy * 0.2;
    content.style.transition = 'none';
    content.style.transform = `translateY(${drag.dy}px)`;
  }

  function up() {
    const d = drag;
    drag = null;
    if (d?.moved) release(d);
  }

  /** Close when pulled far or flicked, otherwise spring back. */
  function release(d: { t: number; dy: number }) {
    if (!content) return;
    const el = content;
    const velocity = d.dy / Math.max(1, performance.now() - d.t);
    el.style.transition = 'transform 200ms cubic-bezier(0.2, 0.7, 0.3, 1)';
    if (d.dy > 90 || (d.dy > 30 && velocity > 0.5)) {
      el.style.transform = 'translateY(100%)';
      setTimeout(() => {
        swiped = true;
        open = false;
      }, 180);
    } else {
      el.style.transform = '';
    }
  }
</script>

<!--
  Pulling the content down while it is scrolled to the top drags the sheet too. Touch events,
  because the browser takes over pointer events once it scrolls.
-->
<DialogPrimitive.Root bind:open>
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay
      class="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
    />
    <DialogPrimitive.Content
      bind:ref={content}
      data-swiped={swiped}
      class="fixed inset-x-0 bottom-0 z-50 flex max-h-11/12 flex-col rounded-t-3xl bg-popover pb-safe text-popover-foreground shadow-2xl outline-none data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom data-[swiped=true]:animate-none data-[swiped=true]:opacity-0 sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl sm:data-[state=closed]:slide-out-to-bottom-8 sm:data-[state=open]:slide-in-from-bottom-8"
    >
      <div
        class="shrink-0 touch-none"
        role="presentation"
        onpointerdown={down}
        onpointermove={move}
        onpointerup={up}
        onpointercancel={up}
      >
        <div class="mx-auto mt-2 h-1 w-10 rounded-full bg-muted sm:hidden"></div>
        <div class="flex items-center gap-2 px-5 pt-3 pb-2">
          {#if onback}
            <button
              type="button"
              class="-ml-2 flex size-9 items-center justify-center rounded-full hover:bg-muted"
              aria-label="Back"
              onclick={onback}
            >
              <ChevronLeft class="size-5" />
            </button>
          {/if}
          <DialogPrimitive.Title class="flex-1 truncate text-lg font-semibold">{title}</DialogPrimitive.Title>
          {@render header?.()}
          <DialogPrimitive.Close
            class="-mr-2 flex size-9 items-center justify-center rounded-full hover:bg-muted"
            aria-label="Close"
          >
            <X class="size-5" />
          </DialogPrimitive.Close>
        </div>
      </div>
      <div bind:this={scroller} class="flex-1 overflow-y-auto overscroll-contain px-5 pt-1 pb-4">
        {@render children()}
      </div>
      {#if footer}
        <div class="flex gap-2 border-t px-5 py-3">
          {@render footer()}
        </div>
      {/if}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
</DialogPrimitive.Root>
