import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.spenhouet.tintplan',
  appName: 'Tintplan',
  webDir: 'build',
  plugins: {
    SystemBars: {
      insetsHandling: 'css'
    }
  }
};

export default config;
