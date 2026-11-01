<script lang="ts">
  import { resolve } from '$app/paths';
  import { setMode, userPrefersMode } from 'mode-watcher';
  import { ExternalLink, Palette } from '@lucide/svelte';
  import PageHeader from '$lib/components/app/PageHeader.svelte';
  import Group from '$lib/components/app/Group.svelte';
  import Row from '$lib/components/app/Row.svelte';
  import Segmented from '$lib/components/app/Segmented.svelte';
  import { palettes } from '$lib/pens';
  import { settings } from '$lib/settings.svelte';
  import { getLocale, setLocale } from '$lib/paraglide/runtime';
  import { m } from '$lib/paraglide/messages.js';

  const REPO = 'https://github.com/Spenhouet/tintplan';

  // One row per data source: its brands, the ranges taken from it, and the license
  const sources = $derived.by(() => {
    // eslint-disable-next-line svelte/prefer-svelte-reactivity -- local, not reactive state
    const map = new Map<string, { license: string; brands: string[]; ranges: string[] }>();
    for (const p of palettes) {
      const s = map.get(p.source) ?? { license: p.license, brands: [], ranges: [] };
      if (!s.brands.includes(p.brand)) s.brands.push(p.brand);
      s.ranges.push(p.name);
      map.set(p.source, s);
    }
    return [...map];
  });
</script>

<main class="mx-auto min-h-dvh max-w-lg px-4 pb-12 md:max-w-2xl md:px-8">
  <PageHeader title={m.settings()} back={resolve('/')} />

  <div class="flex flex-col gap-6">
    <Group footer={m.my_pens_row_hint()}>
      <Row
        label={m.my_pens()}
        value={settings.ownedCount === 1 ? m.pens_count_one() : m.pens_count_other({ count: settings.ownedCount })}
        href={resolve('/settings/pens')}
        icon={Palette}
      />
    </Group>

    <Group title={m.settings_appearance()}>
      <div class="flex flex-col gap-2 px-4 py-3">
        <span class="text-body">{m.settings_language()}</span>
        <Segmented
          value={getLocale()}
          options={[
            { value: 'en', label: 'English' },
            { value: 'de', label: 'Deutsch' }
          ]}
          onchange={(v) => setLocale(v as 'en' | 'de')}
        />
      </div>
      <div class="flex flex-col gap-2 px-4 py-3">
        <span class="text-body">{m.settings_theme()}</span>
        <Segmented
          value={userPrefersMode.current}
          options={[
            { value: 'system', label: m.theme_system() },
            { value: 'light', label: m.theme_light() },
            { value: 'dark', label: m.theme_dark() }
          ]}
          onchange={(v) => setMode(v)}
        />
      </div>
      <div class="flex flex-col gap-2 px-4 py-3">
        <span class="text-body">{m.settings_labels()}</span>
        <Segmented
          value={settings.labelScale}
          options={[
            { value: 0.7, label: m.size_small() },
            { value: 1, label: m.size_medium() },
            { value: 1.4, label: m.size_large() }
          ]}
          onchange={(v) => (settings.labelScale = v)}
        />
      </div>
    </Group>

    <Group title={m.settings_data()} footer={m.settings_data_hint()}>
      {#each sources as [source, info] (source)}
        <Row
          label={info.brands.join(' · ')}
          description={`${info.ranges.join(', ')}. ${info.license}`}
          href={`https://${source}`}
          icon={ExternalLink}
        />
      {/each}
    </Group>

    <Group title={m.settings_about()} footer={m.settings_privacy()}>
      <Row label={m.settings_version()} value={__APP_VERSION__} />
      <Row label={m.settings_source()} value="GitHub" href={REPO} />
    </Group>
  </div>
</main>
