import React, { useState } from "react";
import { StyleSheet, View } from "react-native";

import { AD_UNITS, ADS_ENABLED } from "@/src/ads/config";
import { adsNativeSupported, getAdsModule } from "@/src/ads/env";
import { C } from "@/src/theme";

// Banner slot shown above the tab bar. Real AdMob banner in native builds;
// nothing is rendered in Expo Go / web preview (no ad SDK there).
export default function AdBanner() {
  if (!ADS_ENABLED || !adsNativeSupported) return null;
  const mod = getAdsModule();
  if (!mod) return null;
  return <NativeBanner mod={mod} />;
}

// Collapsed to 0 height until an ad is actually loaded, so the screen uses
// the full height (like Expo Go) whenever there is no fill / ad not ready.
function NativeBanner({ mod }: { mod: any }) {
  const [loaded, setLoaded] = useState(false);
  const { BannerAd, BannerAdSize } = mod;
  return (
    <View style={loaded ? styles.native : styles.collapsed} testID="ad-banner-native">
      <BannerAd
        unitId={AD_UNITS.banner}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: true }}
        onAdLoaded={() => setLoaded(true)}
        onAdFailedToLoad={() => setLoaded(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  native: {
    alignItems: "center",
    backgroundColor: C.bg,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  collapsed: { height: 0, overflow: "hidden" },
});
