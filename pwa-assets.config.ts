import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

export default defineConfig({
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, padding: 0, resizeOptions: { background: '#7c3aed' } },
    apple: { ...minimal2023Preset.apple, padding: 0, resizeOptions: { background: '#7c3aed' } }
  },
  images: ['static/favicon.svg']
});
