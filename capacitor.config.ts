import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.contentmonitor.app',
  appName: 'Content Monitor',
  webDir: 'dist',
  server: {
    url: 'https://a7med-bakry.github.io/content-monitor/',
    cleartext: false
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 900,
      backgroundColor: '#0b0d12'
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    }
  }
};

export default config;
