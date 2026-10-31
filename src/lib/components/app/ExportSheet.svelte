<script lang="ts">
  import { Download, LoaderCircle, Share2 } from '@lucide/svelte';
  import { toast } from 'svelte-sonner';
  import Sheet from './Sheet.svelte';
  import Group from './Group.svelte';
  import Row from './Row.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Switch } from '$lib/components/ui/switch';
  import type { Editor } from '$lib/editor.svelte';
  import { embedProject, fileName, renderPng, saveFile } from '$lib/export';
  import { m } from '$lib/paraglide/messages.js';

  let { open = $bindable(false), editor }: { open: boolean; editor: Editor } = $props();

  let codes = $state(true);
  let legend = $state(true);
  let busy = $state(false);
  const canShare = typeof navigator !== 'undefined' && !!navigator.canShare;

  async function run(share: boolean) {
    busy = true;
    try {
      await editor.save();
      const png = await renderPng(editor.composite, {
        labels: codes ? editor.labels() : null,
        legend: legend ? editor.legend() : null,
        title: editor.name
      });
      const bytes = await embedProject(png, editor.project);
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
    <Group>
      <Row label={m.export_codes()}><Switch bind:checked={codes} /></Row>
      <Row label={m.export_legend()}><Switch bind:checked={legend} /></Row>
    </Group>
    <p class="px-1 text-xs text-muted-foreground">{m.export_editable_hint()}</p>
  </div>
  {#snippet footer()}
    {#if canShare}
      <Button variant="secondary" class="flex-1" disabled={busy} onclick={() => run(true)}><Share2 />{m.share()}</Button
      >
    {/if}
    <Button class="flex-1" disabled={busy} onclick={() => run(false)}>
      {#if busy}<LoaderCircle class="animate-spin" />{:else}<Download />{/if}
      {m.download()}
    </Button>
  {/snippet}
</Sheet>
