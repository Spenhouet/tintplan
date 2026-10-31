<script lang="ts">
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { Camera, ImagePlus } from '@lucide/svelte';
  import { toast } from 'svelte-sonner';
  import { Button } from '$lib/components/ui/button';
  import { importEmbedded } from '$lib/export';
  import { pending } from '$lib/pending';
  import { cn } from '$lib/utils';
  import { isNative, takePhoto } from '$lib/native';
  import { m } from '$lib/paraglide/messages.js';

  /** `stacked` puts the buttons under each other, for narrow cards. */
  let { size = 'lg', stacked = false }: { size?: 'lg' | 'default'; stacked?: boolean } = $props();

  let camera: HTMLInputElement;
  let gallery: HTMLInputElement;

  async function onpick(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) await open(file);
  }

  async function photo() {
    if (!isNative) return camera.click();
    try {
      const file = await takePhoto();
      if (file) await open(file);
    } catch {
      toast.error(m.camera_failed());
    }
  }

  async function open(file: File) {
    try {
      // A PNG exported by Tintplan opens as an editable page, skipping the cleanup
      const id = file.type === 'image/png' || file.name.endsWith('.png') ? await importEmbedded(file) : null;
      if (id) {
        toast.success(m.imported_editable());
        // eslint-disable-next-line svelte/no-navigation-without-resolve -- resolved path plus query
        await goto(`${resolve('/edit')}?id=${id}`);
        return;
      }
    } catch {
      toast.error(m.import_failed());
      return;
    }
    pending.file = file;
    await goto(resolve('/new'));
  }
</script>

<input bind:this={camera} type="file" accept="image/*" capture="environment" class="hidden" onchange={onpick} />
<input bind:this={gallery} type="file" accept="image/*" class="hidden" onchange={onpick} />

<div class={cn('flex gap-2', stacked && 'flex-col')}>
  <Button {size} class={stacked ? 'w-full' : 'flex-1'} onclick={photo}><Camera />{m.take_photo()}</Button>
  <Button {size} variant="secondary" class={stacked ? 'w-full' : 'flex-1'} onclick={() => gallery.click()}>
    <ImagePlus />{m.choose_image()}
  </Button>
</div>
