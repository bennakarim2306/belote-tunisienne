import AsyncStorage from "@react-native-async-storage/async-storage";

import { AD_UNITS, ADS_ENABLED, INTERSTITIAL_EVERY } from "@/src/ads/config";
import { adsNativeSupported, getAdsModule } from "@/src/ads/env";

let interstitial: any | null = null;
let loaded = false;

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
    interstitial.addAdEventListener(AdEventType.CLOSED, () => {
      loaded = false;
      interstitial.load(); // prepare the next one
    });
    interstitial.addAdEventListener(AdEventType.ERROR, () => {
      loaded = false;
    });
  } catch {
    interstitial = null;
  }
}

export function preloadInterstitial() {
  ensureInterstitial();
  if (interstitial && !loaded) {
    try {
      interstitial.load();
    } catch {}
  }
}

// Frequency-capped interstitial after a finished match.
// Rules: 1 match out of 2 (online/solo), 1 out of 6 (private rooms).
// Counters persist across app restarts. Always resolves (no-op on web/Expo Go).
export async function maybeShowInterstitialAfterMatch(
  origin: string,
): Promise<boolean> {
  if (!ADS_ENABLED) return false;
  const every = INTERSTITIAL_EVERY[origin] ?? INTERSTITIAL_EVERY.online;
  const key = origin === "private" ? "ads_matches_private" : "ads_matches_normal";
  let count = 0;
  try {
    count = (parseInt((await AsyncStorage.getItem(key)) ?? "0", 10) || 0) + 1;
    await AsyncStorage.setItem(key, String(count >= every ? 0 : count));
  } catch {}
  if (count < every) return false;

  if (!adsNativeSupported || !interstitial || !loaded) return false;
  try {
    await interstitial.show();
    return true;
  } catch {
    return false;
  }
}
