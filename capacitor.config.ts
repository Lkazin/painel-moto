import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'br.com.novaesweb.entregador',
  appName: 'NovaesWeb Entregador',
  webDir: 'dist',
  android: { useLegacyBridge: true },
  server: { androidScheme: 'https' },
  plugins: { CapacitorHttp: { enabled: true } },
};
export default config;
