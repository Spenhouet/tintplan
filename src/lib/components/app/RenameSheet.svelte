<script lang="ts">
  import Sheet from './Sheet.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { m } from '$lib/paraglide/messages.js';

  let {
    open = $bindable(false),
    name,
    onsave
  }: { open: boolean; name: string; onsave: (name: string) => void } = $props();

  let value = $state('');
  $effect(() => {
    if (open) value = name;
  });

  function submit(e: SubmitEvent) {
    e.preventDefault();
    onsave(value);
    open = false;
  }
</script>

<Sheet bind:open title={m.rename()}>
  <form class="flex flex-col gap-3" onsubmit={submit}>
    <Input bind:value aria-label={m.rename()} />
    <Button type="submit">{m.save()}</Button>
  </form>
</Sheet>
