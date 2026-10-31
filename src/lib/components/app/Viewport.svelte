<script lang="ts">
  import type { Snippet } from 'svelte';

  /**
   * Pan and zoom content of `width` x `height` image pixels. One finger drags, two fingers pinch,
   * the mouse wheel zooms. A short touch without movement is a tap, reported in image pixels.
   */
  let {
    width,
    height,
    ontap,
    onzoom,
    children,
    overlay
  }: {
    width: number;
    height: number;
    /** Image pixels, plus the tap position on screen relative to the viewport. */
    ontap: (x: number, y: number, screen: { x: number; y: number }) => void;
    /** Whether the page is zoomed or moved away from the fitted view. */
    onzoom?: (moved: boolean) => void;
    children: Snippet;
    /** Screen-space content over the page, like tap ripples and buttons. */
    overlay?: Snippet;
  } = $props();

  let box = $state<HTMLDivElement>();
  let content = $state<HTMLDivElement>();
  let boxW = $state(0);
  let boxH = $state(0);
  let view = { s: 1, tx: 0, ty: 0 };
  /** Until the user zooms or pans, the page keeps fitting the viewport as it resizes. */
  let userMoved = false;

  const fitScale = () => Math.min(boxW / width, boxH / height) * 0.96;

  function apply(animate = false) {
    if (!content) return;
    content.style.transition = animate ? 'transform 280ms cubic-bezier(0.2, 0.7, 0.3, 1)' : '';
    content.style.transform = `translate(${view.tx}px, ${view.ty}px) scale(${view.s})`;
  }

  function moved() {
    if (!userMoved) {
      userMoved = true;
      onzoom?.(true);
    }
  }

  /** Fit the whole page, animated when `animate`. */
  export function fit(animate = false) {
    const s = fitScale();
    view = { s, tx: (boxW - width * s) / 2, ty: (boxH - height * s) / 2 };
    apply(animate);
    if (userMoved) {
      userMoved = false;
      onzoom?.(false);
    }
  }

  $effect(() => {
    if (!boxW || !boxH) return;
    if (!userMoved) fit();
    else {
      clamp();
      apply();
    }
  });

  /** Keep at least a quarter of the page on screen. */
  function clamp() {
    const s = Math.min(16, Math.max(fitScale() * 0.5, view.s));
    const w = width * s;
    const h = height * s;
    const tx = Math.min(boxW - Math.min(w, boxW) / 4, Math.max(Math.min(w, boxW) / 4 - w, view.tx));
    const ty = Math.min(boxH - Math.min(h, boxH) / 4, Math.max(Math.min(h, boxH) / 4 - h, view.ty));
    view = { s, tx, ty };
  }

  function zoomAt(cx: number, cy: number, s: number, from = view) {
    const ix = (cx - from.tx) / from.s;
    const iy = (cy - from.ty) / from.s;
    view = { s, tx: cx - ix * s, ty: cy - iy * s };
    clamp();
    apply();
    moved();
  }

  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- local, not reactive state
  const pointers = new Map<number, { x: number; y: number }>();
  let gesture: {
    start: { x: number; y: number; t: number };
    moved: boolean;
    multi: boolean;
    pinch?: { dist: number; mid: { x: number; y: number }; view: typeof view };
    last: { x: number; y: number };
  } | null = null;

  const local = (e: PointerEvent | WheelEvent) => {
    const r = box!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  function pinchStart() {
    const [a, b] = [...pointers.values()];
    return {
      dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
      mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      view: { ...view }
    };
  }

  function down(e: PointerEvent) {
    if (e.button > 0) return;
    box!.setPointerCapture(e.pointerId);
    const p = local(e);
    pointers.set(e.pointerId, p);
    if (pointers.size === 1) {
      gesture = { start: { ...p, t: performance.now() }, moved: false, multi: false, last: p };
    } else if (gesture && pointers.size === 2) {
      gesture.multi = true;
      gesture.pinch = pinchStart();
    }
  }

  function move(e: PointerEvent) {
    if (!pointers.has(e.pointerId) || !gesture) return;
    const p = local(e);
    pointers.set(e.pointerId, p);
    if (pointers.size >= 2 && gesture.pinch) {
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const from = gesture.pinch.view;
      const s = from.s * (dist / gesture.pinch.dist);
      // Zoom around the starting midpoint, then follow the midpoint for panning
      const ix = (gesture.pinch.mid.x - from.tx) / from.s;
      const iy = (gesture.pinch.mid.y - from.ty) / from.s;
      view = { s, tx: mid.x - ix * s, ty: mid.y - iy * s };
      clamp();
      apply();
      moved();
      return;
    }
    if (!gesture.moved && Math.hypot(p.x - gesture.start.x, p.y - gesture.start.y) > 8) gesture.moved = true;
    if (gesture.moved) {
      view = { ...view, tx: view.tx + p.x - gesture.last.x, ty: view.ty + p.y - gesture.last.y };
      clamp();
      apply();
      moved();
    }
    gesture.last = p;
  }

  function up(e: PointerEvent) {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (!gesture) return;
    if (pointers.size === 0) {
      const g = gesture;
      gesture = null;
      if (!g.moved && !g.multi && performance.now() - g.start.t < 600) {
        const p = local(e);
        ontap((p.x - view.tx) / view.s, (p.y - view.ty) / view.s, p);
      }
    } else if (pointers.size === 1) {
      // One finger lifted from a pinch: continue as a pan from here
      const [p] = [...pointers.values()];
      gesture.pinch = undefined;
      gesture.last = p;
      gesture.moved = true;
    }
  }

  function cancel(e: PointerEvent) {
    pointers.delete(e.pointerId);
    if (pointers.size === 0) gesture = null;
  }

  function wheel(e: WheelEvent) {
    e.preventDefault();
    const p = local(e);
    zoomAt(p.x, p.y, view.s * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)));
  }
</script>

<div
  bind:this={box}
  bind:clientWidth={boxW}
  bind:clientHeight={boxH}
  class="relative size-full touch-none-all overflow-hidden"
  role="application"
  onpointerdown={down}
  onpointermove={move}
  onpointerup={up}
  onpointercancel={cancel}
  onwheel={wheel}
>
  <div
    bind:this={content}
    class="absolute top-0 left-0 h-(--h) w-(--w) origin-top-left shadow-lg"
    style="--w: {width}px; --h: {height}px"
  >
    {@render children()}
  </div>
  {@render overlay?.()}
</div>
