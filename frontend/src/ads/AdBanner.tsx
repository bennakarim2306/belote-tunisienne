import { StyleSheet, Text, View } from "react-native";

import { AD_UNITS, ADS_ENABLED } from "@/src/ads/config";
import { adsNativeSupported, getAdsModule } from "@/src/ads/env";
import { useI18n } from "@/src/i18n";
import { C, F } from "@/src/theme";

function PlaceholderBanner() {
  const { t } = useI18n();
  return (
    <View style={styles.placeholder} testID="ad-banner-placeholder">
      <View style={styles.adChip}>
        <Text style={styles.adChipText}>AD</Text>
      </View>
      <Text style={styles.placeholderText}>{t("adPlaceholder")}</Text>
    </View>
  );
}

function NativeBanner() {
  const mod = getAdsModule();
  if (!mod) return <PlaceholderBanner />;
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

// Banner slot shown above the tab bar. Real AdMob banner in native builds,
// discreet themed placeholder in Expo Go / web preview (to validate placement).
export default function AdBanner() {
  if (!ADS_ENABLED) return null;
  if (!adsNativeSupported) return <PlaceholderBanner />;
  return <NativeBanner />;
}

const styles = StyleSheet.create({
  native: {
    alignItems: "center",
    backgroundColor: C.bg,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  placeholder: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 46,
    backgroundColor: C.bg2,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  adChip: {
    backgroundColor: C.bg3,
    borderWidth: 1,
    borderColor: C.borderStrong,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  adChipText: { fontFamily: F.extra, fontSize: 9, color: C.ink3, letterSpacing: 1 },
  placeholderText: { fontFamily: F.text, fontSize: 11.5, color: C.ink3 },
});
