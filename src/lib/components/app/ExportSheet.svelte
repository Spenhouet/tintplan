<script lang="ts">
  import { Download, LoaderCircle, Share2 } from '@lucide/svelte';
  import { toast } from 'svelte-sonner';
  import { fade } from 'svelte/transition';
  import Sheet from './Sheet.svelte';
  import Group from './Group.svelte';
  import Row from './Row.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Switch } from '$lib/components/ui/switch';
  import type { Editor } from '$lib/editor.svelte';
  import { embedProject, fileName, renderPng, saveFile } from '$lib/export';
  import { isNative } from '$lib/native';
  import { m } from '$lib/paraglide/messages.js';

  let { open = $bindable(false), editor }: { open: boolean; editor: Editor } = $props();

  let codes = $state(true);
  let legend = $state(true);
  let busy = $state(false);
  // The app always hands files to the Android share sheet, which also saves to Files
  const canShare = !isNative && typeof navigator !== 'undefined' && !!navigator.canShare;

  /** The rendered image for the current options, shown as preview and reused for saving. */
  let render = $state<{ key: string; png: Uint8Array; url: string } | null>(null);
  let rendering = $state(false);

  $effect(() => {
    if (!open) return;
    const key = `${codes}|${legend}|${editor.version}|${editor.name}`;
    if (render?.key === key) return;
    rendering = true;
    // Let the sheet finish sliding in before the heavy render
    const timer = setTimeout(async () => {
      try {
        const png = await renderPng(editor.composite, {
          labels: codes ? editor.labels() : null,
          legend: legend ? editor.legend() : null,
          title: editor.name
        });
        if (render) URL.revokeObjectURL(render.url);
        render = { key, png, url: URL.createObjectURL(new Blob([png as BlobPart], { type: 'image/png' })) };
      } finally {
        rendering = false;
      }
    }, 220);
    return () => clearTimeout(timer);
  });

  async function run(share: boolean) {
    if (!render) return;
    busy = true;
    try {
      await editor.save();
      const bytes = await embedProject(render.png, editor.project);
      await saveFile(fileName(editor.name, 'png'), bytes, 'image/png', share);
      open = false;
    } catch (e) {
      toast.error(String(e));
    } finally {
      busy = false;
    }
  }
</script>

<Sheet bind:open title={m.export_title()}>
  <div class="flex flex-col gap-3">
    <div class="relative flex h-64 items-center justify-center overflow-hidden rounded-xl bg-muted p-2">
      {#if render}
        <img src={render.url} alt={m.export_title()} class="max-h-full max-w-full rounded-xs shadow-lg" />
      {/if}
      {#if rendering}
        <span class="absolute inset-0 flex items-center justify-center bg-muted/50" transition:fade={{ duration: 120 }}>
          <LoaderCircle class="size-6 animate-spin text-muted-foreground" />
        </span>
      {/if}
    </div>
    <Group>
      <Row label={m.export_codes()}><Switch bind:checked={codes} /></Row>
      <Row label={m.export_legend()}><Switch bind:checked={legend} /></Row>
    </Group>
    <p class="px-1 text-xs text-muted-foreground">{m.export_editable_hint()}</p>
  </div>
  {#snippet footer()}
    {#if canShare}
      <Button variant="secondary" class="flex-1" disabled={busy || !render || rendering} onclick={() => run(true)}
        ><Share2 />{m.share()}</Button
      >
    {/if}
    <Button class="flex-1" disabled={busy || !render || rendering} onclick={() => run(false)}>
      {#if busy}<LoaderCircle class="animate-spin" />{:else}<Download />{/if}
      {isNative ? m.save_or_share() : m.download()}
    </Button>
  {/snippet}
</Sheet>
