<script lang="ts">
  import { cn } from '$lib/utils';

  /** A row of color bars previewing a pen range. */
  let { colors, class: className = '' }: { colors: string[]; class?: string } = $props();
</script>

<span class={cn('flex h-8 w-20 shrink-0 overflow-hidden rounded-lg ring-1 ring-border ring-inset', className)}>
  {#each colors as c, i (i)}
    <span class="h-full flex-1 bg-(--c)" style="--c: {c}"></span>
  {/each}
</span>
