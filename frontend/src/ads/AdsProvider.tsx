import { useEffect } from "react";

import { ADS_ENABLED } from "@/src/ads/config";
import { adsNativeSupported, getAdsModule } from "@/src/ads/env";
import { preloadInterstitial } from "@/src/ads/interstitial";

// Initializes the Google Mobile Ads SDK once (native builds only), after
// gathering UMP (GDPR) consent — REQUIRED for any ad to serve in the EEA/UK.
// The certified Google consent form is shown automatically when required;
// it needs a published GDPR message in AdMob -> Privacy & messaging.
// No-op on web / Expo Go — children render normally everywhere.
export default function AdsProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!ADS_ENABLED || !adsNativeSupported) return;
    const mod = getAdsModule();
    if (!mod) return;
    (async () => {
      try {
        // requestInfoUpdate + loadAndShowConsentFormIfRequired in one call
        await mod.AdsConsent.gatherConsent();
      } catch {
        // network error or no GDPR message published in the AdMob console —
        // continue anyway (non-EEA users are unaffected)
      }
      try {
        await mod.default().initialize();
        preloadInterstitial();
      } catch {}
    })();
  }, []);

  return children;
}
