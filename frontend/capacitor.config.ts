import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.alexkalish.healthfitnesscoach",
  appName: "Health Fitness Coach",
  webDir: "dist",
  bundledWebRuntime: false,
  server: {
    iosScheme: "capacitor"
  }
};

export default config;
