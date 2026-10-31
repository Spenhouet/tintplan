<script lang="ts">
  import { ChevronDown } from '@lucide/svelte';
  import { cn } from '$lib/utils';

  let {
    value = $bindable(),
    options,
    class: className = '',
    onchange,
    id
  }: {
    value: string;
    /** Options with a `group` are shown under that heading. */
    options: { value: string; label: string; group?: string }[];
    class?: string;
    onchange?: (v: string) => void;
    id?: string;
  } = $props();

  const groups = $derived.by(() => {
    // eslint-disable-next-line svelte/prefer-svelte-reactivity -- local, not reactive state
    const map = new Map<string, typeof options>();
    for (const o of options) map.set(o.group ?? '', [...(map.get(o.group ?? '') ?? []), o]);
    return [...map];
  });
</script>

<div class={cn('relative', className)}>
  <select
    {id}
    bind:value
    onchange={() => onchange?.(value)}
    class="h-10 w-full appearance-none rounded-lg border border-input bg-transparent pr-9 pl-3 text-body outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
  >
    {#each groups as [group, list] (group)}
      {#if group}
        <optgroup label={group}>
          {#each list as o (o.value)}<option value={o.value}>{o.label}</option>{/each}
        </optgroup>
      {:else}
        {#each list as o (o.value)}<option value={o.value}>{o.label}</option>{/each}
      {/if}
    {/each}
  </select>
  <ChevronDown class="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
</div>
