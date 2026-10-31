<script lang="ts">
  import { Check } from '@lucide/svelte';
  import { cn } from '$lib/utils';

  /** A pen color chip with its code. `size` lg is the current pen in the toolbar. */
  let {
    hex,
    code,
    selected = false,
    size = 'md',
    dimmed = false,
    checked = false,
    title,
    onclick
  }: {
    hex: string;
    code: string;
    selected?: boolean;
    size?: 'sm' | 'md' | 'lg';
    /** Faded, for pens the user doesn't own while editing their collection. */
    dimmed?: boolean;
    /** Shows a check mark, for owned pens while editing the collection. */
    checked?: boolean;
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
      'relative flex w-full items-center justify-center rounded-lg bg-(--c) ring-1 ring-border transition-opacity ring-inset',
      dimmed && 'opacity-30',
      size === 'sm' ? 'h-8' : size === 'lg' ? 'h-10' : 'h-9',
      selected && 'ring-2 ring-primary'
    )}
    style="--c: {hex}"
  >
    {#if checked}
      <span class="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
        <Check class="size-3.5" />
      </span>
    {/if}
  </span>
  <span class="max-w-full truncate text-caption font-medium tabular">{code}</span>
</button>
