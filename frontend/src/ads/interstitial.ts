import * as NavigationBar from "expo-navigation-bar";
import { setStatusBarHidden } from "expo-status-bar";
import { Platform } from "react-native";

import { AD_UNITS, ADS_ENABLED } from "@/src/ads/config";
import { adsNativeSupported, getAdsModule } from "@/src/ads/env";

let interstitial: any | null = null;
let loaded = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleRetry() {
  if (retryTimer) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    preloadInterstitial();
  }, 30000);
}

function ensureInterstitial() {
  if (!ADS_ENABLED || !adsNativeSupported || interstitial) return;
  const mod = getAdsModule();
  if (!mod) return;
  const { InterstitialAd, AdEventType } = mod;
  try {
    interstitial = InterstitialAd.createForAdRequest(AD_UNITS.interstitial, {
      requestNonPersonalizedAdsOnly: true,
    });
    interstitial.addAdEventListener(AdEventType.LOADED, () => {
      loaded = true;
    });
    interstitial.addAdEventListener(AdEventType.OPENED, () => {
      // iOS: hide the status bar so it can never overlap the ad's close (X)
      if (Platform.OS === "ios") setStatusBarHidden(true, "none");
    });
    interstitial.addAdEventListener(AdEventType.CLOSED, () => {
      loaded = false;
      // restore the game's immersive mode (the ad activity resets system bars)
      if (Platform.OS === "android") {
        setStatusBarHidden(true, "none");
        NavigationBar.setVisibilityAsync("hidden").catch(() => {});
      }
      interstitial.load(); // prepare the next one
    });
    interstitial.addAdEventListener(AdEventType.ERROR, () => {
      // no fill / network error: retry in 30s so the ad is ready by match end
      loaded = false;
      scheduleRetry();
    });
  } catch {
    interstitial = null;
  }
}

/** Idempotent: creates the ad on first call, (re)loads whenever not loaded. */
export function preloadInterstitial() {
  ensureInterstitial();
  if (interstitial && !loaded) {
    try {
      interstitial.load();
    } catch {}
  }
}

// Shown at EVERY match end, in all modes (online, solo, private, tutorial).
// Always resolves (no-op on web/Expo Go or when no ad is loaded yet).
export async function showInterstitialAfterMatch(): Promise<boolean> {
  if (!ADS_ENABLED || !adsNativeSupported) return false;
  if (!interstitial || !loaded) {
    preloadInterstitial(); // too late for this match, be ready for the next
    return false;
  }
  try {
    // immersiveModeEnabled: the ads SDK lays the ad out for immersive
    // (fullscreen) apps itself — fixes the close "X" being clipped behind
    // hidden system bars on Android 13-15 (our app runs immersive landscape)
    await interstitial.show({ immersiveModeEnabled: true });
    return true;
  } catch {
    return false;
  }
}
