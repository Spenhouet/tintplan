<script lang="ts">
  import type { Point, Quad } from '$lib/image/gray';

  /** Drag the four corners of the page over the photo. Coordinates are in image pixels. */
  let { src, width, height, quad = $bindable() }: { src: string; width: number; height: number; quad: Quad } = $props();

  let boxW = $state(0);
  let boxH = $state(0);
  let svg = $state<SVGSVGElement>();
  let dragging = $state(-1);

  const scale = $derived(boxW && boxH ? Math.min(boxW / width, boxH / height) : 0);
  // Handles keep the same size on screen whatever the photo resolution
  const handle = $derived(scale ? 14 / scale : 0);

  function toImage(e: PointerEvent): Point {
    const r = svg!.getBoundingClientRect();
    return {
      x: Math.min(width, Math.max(0, ((e.clientX - r.left) / r.width) * width)),
      y: Math.min(height, Math.max(0, ((e.clientY - r.top) / r.height) * height))
    };
  }

  function down(e: PointerEvent, i: number) {
    dragging = i;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  }

  function move(e: PointerEvent) {
    if (dragging < 0) return;
    const next = [...quad] as Quad;
    next[dragging] = toImage(e);
    quad = next;
  }
</script>

<div class="flex size-full items-center justify-center" bind:clientWidth={boxW} bind:clientHeight={boxH}>
  {#if scale}
    <div class="relative h-(--h) w-(--w) touch-none-all" style="--w: {width * scale}px; --h: {height * scale}px">
      <img {src} alt="" class="absolute inset-0 size-full rounded-md" draggable="false" />
      <svg
        bind:this={svg}
        viewBox="0 0 {width} {height}"
        class="absolute inset-0 size-full overflow-visible"
        role="presentation"
        onpointermove={move}
        onpointerup={() => (dragging = -1)}
        onpointercancel={() => (dragging = -1)}
      >
        <path
          d="M0 0H{width}V{height}H0Z M{quad.map((p) => `${p.x} ${p.y}`).join(' L')}Z"
          class="fill-black/45"
          fill-rule="evenodd"
        />
        <polygon
          points={quad.map((p) => `${p.x},${p.y}`).join(' ')}
          fill="none"
          class="stroke-primary"
          stroke-width={handle / 5}
        />
        {#each quad as p, i (i)}
          <circle
            cx={p.x}
            cy={p.y}
            r={handle * 2.4}
            class="fill-transparent"
            role="slider"
            aria-valuenow={i}
            tabindex="-1"
            onpointerdown={(e) => down(e, i)}
          />
          <circle
            cx={p.x}
            cy={p.y}
            r={handle}
            class="pointer-events-none fill-primary/30 stroke-primary"
            stroke-width={handle / 4}
          />
        {/each}
      </svg>
    </div>
  {/if}
</div>
