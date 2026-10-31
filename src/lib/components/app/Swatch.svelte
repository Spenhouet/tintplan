<script lang="ts">
  import { cn } from '$lib/utils';

  /** A pen color chip with its code. `size` lg is the current pen in the toolbar. */
  let {
    hex,
    code,
    selected = false,
    size = 'md',
    title,
    onclick
  }: {
    hex: string;
    code: string;
    selected?: boolean;
    size?: 'sm' | 'md' | 'lg';
    title?: string;
    onclick?: () => void;
  } = $props();
</script>

<button
  type="button"
  {title}
  {onclick}
  aria-pressed={selected}
  class={cn(
    'flex shrink-0 flex-col items-center gap-1 rounded-xl p-1 transition-colors hover:bg-muted',
    selected && 'bg-primary/12',
    size === 'sm' ? 'w-12' : size === 'lg' ? 'w-16' : 'w-full'
  )}
>
  <span
    class={cn(
      'block w-full rounded-lg bg-(--c) ring-1 ring-border ring-inset',
      size === 'sm' ? 'h-8' : size === 'lg' ? 'h-10' : 'h-9',
      selected && 'ring-2 ring-primary'
    )}
    style="--c: {hex}"
  ></span>
  <span class="max-w-full truncate text-caption font-medium tabular">{code}</span>
</button>
