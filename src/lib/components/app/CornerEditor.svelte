<script lang="ts">
  import type { Point, Quad } from '$lib/image/gray';

  /**
   * Drag the four corners of the page over the photo. Coordinates are in image pixels.
   * While dragging, a magnifier above the finger shows the corner up close. The corner moves
   * with the finger's movement, not to the finger, so it never hides under the fingertip.
   */
  let { src, width, height, quad = $bindable() }: { src: string; width: number; height: number; quad: Quad } = $props();

  /** Magnifier diameter in CSS pixels (size-32) and its zoom over the on-screen photo. */
  const LOUPE = 128;
  const ZOOM = 4;

  let boxW = $state(0);
  let boxH = $state(0);
  let svg = $state<SVGSVGElement>();
  let dragging = $state(-1);
  let offset: Point = { x: 0, y: 0 };

  const scale = $derived(boxW && boxH ? Math.min(boxW / width, boxH / height) : 0);
  // Handles keep the same size on screen whatever the photo resolution
  const handle = $derived(scale ? 14 / scale : 0);

  function pointer(e: PointerEvent): Point {
    const r = svg!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * width, y: ((e.clientY - r.top) / r.height) * height };
  }

  function down(e: PointerEvent, i: number) {
    dragging = i;
    const p = pointer(e);
    offset = { x: quad[i].x - p.x, y: quad[i].y - p.y };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  }

  function move(e: PointerEvent) {
    if (dragging < 0) return;
    const p = pointer(e);
    const next = [...quad] as Quad;
    next[dragging] = {
      x: Math.min(width, Math.max(0, p.x + offset.x)),
      y: Math.min(height, Math.max(0, p.y + offset.y))
    };
    quad = next;
  }

  const loupe = $derived.by(() => {
    if (dragging < 0 || !scale) return null;
    const c = quad[dragging];
    const sx = c.x * scale;
    const sy = c.y * scale;
    const w = width * scale;
    const h = height * scale;
    // Above the finger, or below when there is no room above; always inside the photo
    const gap = LOUPE * 0.85;
    const half = LOUPE / 2;
    const ly = sy - gap - half >= 0 ? sy - gap : Math.min(h - half, sy + gap);
    const lx = Math.min(w - half, Math.max(half, sx));
    const span = LOUPE / (scale * ZOOM);
    return { c, sx, sy, lx, ly, span };
  });
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
            class="fill-transparent outline-none"
            role="slider"
            aria-valuenow={i}
            tabindex="-1"
            onpointerdown={(e) => down(e, i)}
          />
          <circle
            cx={p.x}
            cy={p.y}
            r={handle}
            fill={dragging === i ? 'none' : undefined}
            class="pointer-events-none fill-primary/30 stroke-primary"
            stroke-width={handle / 4}
          />
        {/each}
      </svg>

      {#if loupe}
        <div
          class="pointer-events-none absolute top-(--ly) left-(--lx) z-10 size-32 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full bg-card shadow-xl ring-2 ring-primary"
          style="--lx: {loupe.lx}px; --ly: {loupe.ly}px"
          aria-hidden="true"
        >
          <img
            {src}
            alt=""
            draggable="false"
            class="absolute top-(--iy) left-(--ix) h-(--ih) w-(--iw) max-w-none"
            style="--iw: {width * scale * ZOOM}px; --ih: {height * scale * ZOOM}px; --ix: {LOUPE / 2 -
              loupe.sx * ZOOM}px; --iy: {LOUPE / 2 - loupe.sy * ZOOM}px"
          />
          <svg
            viewBox="{loupe.c.x - loupe.span / 2} {loupe.c.y - loupe.span / 2} {loupe.span} {loupe.span}"
            class="absolute inset-0 size-full"
          >
            <path
              d="M-{width} -{height}H{width * 2}V{height * 2}H-{width}Z M{quad.map((p) => `${p.x} ${p.y}`).join(' L')}Z"
              class="fill-black/35"
              fill-rule="evenodd"
            />
            <polygon
              points={quad.map((p) => `${p.x},${p.y}`).join(' ')}
              fill="none"
              class="stroke-primary"
              stroke-width={loupe.span / 80}
            />
            <!-- Crosshair with an open center, so the exact corner stays visible -->
            {#each [[-1, 0], [1, 0], [0, -1], [0, 1]] as [dx, dy], k (k)}
              <line
                x1={loupe.c.x + dx * loupe.span * 0.05}
                y1={loupe.c.y + dy * loupe.span * 0.05}
                x2={loupe.c.x + dx * loupe.span * 0.22}
                y2={loupe.c.y + dy * loupe.span * 0.22}
                class="stroke-primary"
                stroke-width={loupe.span / 50}
                stroke-linecap="round"
              />
            {/each}
            <circle cx={loupe.c.x} cy={loupe.c.y} r={loupe.span / 120} class="fill-primary" />
          </svg>
        </div>
      {/if}
    </div>
  {/if}
</div>
