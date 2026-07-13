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
  const { BannerAd, BannerAdSize } = mod;
  return (
    <View style={styles.native} testID="ad-banner-native">
      <BannerAd
        unitId={AD_UNITS.banner}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: true }}
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
});
