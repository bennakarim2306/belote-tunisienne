import { Platform } from "react-native";

// Master switch — set to false to disable all ads without touching the UI code.
export const ADS_ENABLED = true;

// GOOGLE TEST ad unit IDs (safe, always serve "Test Ad" content).
// TODO before store release: replace with real AdMob unit IDs from the AdMob console.
export const AD_UNITS = {
  banner: Platform.select({
    android: "ca-app-pub-3940256099942544/6300978111",
    ios: "ca-app-pub-3940256099942544/2934735716",
    default: "",
  }) as string,
  interstitial: Platform.select({
    android: "ca-app-pub-3940256099942544/1033173712",
    ios: "ca-app-pub-3940256099942544/4411468910",
    default: "",
  }) as string,
};

// Interstitial frequency: show one ad every N finished matches.
export const INTERSTITIAL_EVERY: Record<string, number> = {
  online: 2,
  solo: 2,
  private: 6,
};
