<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { ModeWatcher } from 'mode-watcher';
  import { Toaster } from '$lib/components/ui/sonner';
  import { onNavigate } from '$app/navigation';
  import { initNative } from '$lib/native';
  import { getLocale } from '$lib/paraglide/runtime';

  let { children } = $props();

  onMount(() => {
    document.documentElement.lang = getLocale();
    initNative();
  });

  /** How deep a screen sits: going deeper slides in from the right, going up slides back. */
  const depth = (path: string | undefined) => {
    if (!path) return 0;
    if (path.endsWith('/settings/pens/range')) return 3;
    if (path.endsWith('/edit') || path.endsWith('/settings/pens')) return 2;
    if (path.endsWith('/new') || path.endsWith('/settings')) return 1;
    return 0;
  };

  onNavigate((nav) => {
    if (!document.startViewTransition || nav.from?.url.pathname === nav.to?.url.pathname) return;
    const from = depth(nav.from?.url.pathname);
    const to = depth(nav.to?.url.pathname);
    document.documentElement.dataset.nav = to > from ? 'forward' : to < from ? 'back' : 'fade';
    return new Promise((resolve) => {
      document.startViewTransition(async () => {
        resolve();
        await nav.complete;
      });
    });
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
