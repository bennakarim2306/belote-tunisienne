import { useEffect } from "react";

import { ADS_ENABLED } from "@/src/ads/config";
import { adsNativeSupported, getAdsModule } from "@/src/ads/env";
import { preloadInterstitial } from "@/src/ads/interstitial";

// Initializes the Google Mobile Ads SDK once (native builds only).
// No-op on web / Expo Go — children render normally everywhere.
export default function AdsProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!ADS_ENABLED || !adsNativeSupported) return;
    const mod = getAdsModule();
    if (!mod) return;
    mod
      .default()
      .initialize()
      .then(() => preloadInterstitial())
      .catch(() => {});
  }, []);

  return children;
}
