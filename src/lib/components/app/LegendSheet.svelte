<script lang="ts">
  import { Eraser, Replace } from '@lucide/svelte';
  import Sheet from './Sheet.svelte';
  import Confirm from './Confirm.svelte';
  import { Button } from '$lib/components/ui/button';
  import type { Editor } from '$lib/editor.svelte';
  import { paletteInfo } from '$lib/pens';
  import { m } from '$lib/paraglide/messages.js';

  /** The pens on this page: a shopping list, plus swapping or removing a pen everywhere. */
  let { open = $bindable(false), editor }: { open: boolean; editor: Editor } = $props();

  let confirmClear = $state(false);

  const pens = $derived.by(() => {
    void editor.version;
    return editor.usedPens().map((u) => ({ ...u, brand: paletteInfo(u.pen.p)?.brand ?? '' }));
  });
</script>

<Sheet bind:open title={m.pens_used()}>
  {#if pens.length === 0}
    <p class="py-6 text-center text-sm text-muted-foreground">{m.pens_used_empty()}</p>
  {:else}
    <ul class="flex flex-col divide-y">
      {#each pens as { pen, brand, count } (pen.p + pen.c)}
        <li class="flex items-center gap-3 py-2">
          <span class="size-9 shrink-0 rounded-lg bg-(--c) ring-1 ring-border ring-inset" style="--c: {pen.hex}"></span>
          <span class="min-w-0 flex-1">
            <span class="block truncate text-body font-medium">{pen.c} <span class="font-normal">{pen.n}</span></span>
            <span class="block truncate text-xs text-muted-foreground">{brand} · {m.areas_filled({ count })}</span>
          </span>
          {#if editor.pen && (editor.pen.p !== pen.p || editor.pen.c !== pen.c)}
            <Button
              variant="ghost"
              size="icon"
              aria-label={m.replace_with_current({ code: editor.pen.c })}
              title={m.replace_with_current({ code: editor.pen.c })}
              onclick={() => editor.pen && editor.replace(pen, editor.pen)}><Replace /></Button
            >
          {/if}
          <Button
            variant="ghost"
            size="icon"
            aria-label={m.clear_pen()}
            title={m.clear_pen()}
            onclick={() => editor.replace(pen, null)}><Eraser /></Button
          >
        </li>
      {/each}
    </ul>
  {/if}
  {#snippet footer()}
    <Button variant="destructive" class="flex-1" disabled={pens.length === 0} onclick={() => (confirmClear = true)}
      >{m.clear_all()}</Button
    >
  {/snippet}
</Sheet>

<Confirm
  bind:open={confirmClear}
  title={m.clear_all_title()}
  message={m.clear_all_text()}
  confirmLabel={m.clear_all()}
  destructive
  onconfirm={() => editor.clearAll()}
/>
