import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.samuraitechpark.hostelconnect',
  appName: 'HostelConnect',
  webDir: 'build',
  server: {
    androidScheme: 'https',
  },
};

export default config;
