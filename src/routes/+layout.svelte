<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { ModeWatcher } from 'mode-watcher';
  import { Toaster } from '$lib/components/ui/sonner';
  import { getLocale } from '$lib/paraglide/runtime';

  let { children } = $props();

  onMount(() => {
    document.documentElement.lang = getLocale();
  });
</script>

<ModeWatcher themeColors={{ dark: '#17141f', light: '#fbfafd' }} />
<Toaster
  position="top-center"
  richColors
  closeButton={false}
  offset={{ top: '64px' }}
  mobileOffset={{ top: 'calc(env(safe-area-inset-top) + 64px)' }}
/>

{@render children()}
