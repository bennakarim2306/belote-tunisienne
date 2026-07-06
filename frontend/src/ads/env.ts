import Constants, { ExecutionEnvironment } from "expo-constants";
import { Platform } from "react-native";

import loadNativeAdsModule from "@/src/ads/nativeAdsModule";

export const isWeb = Platform.OS === "web";
export const isExpoGo =
  !isWeb && Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

// AdMob's native SDK only exists in dev/production builds (Emergent Publish),
// never in Expo Go or on web. All ad code must be gated behind this flag.
export const adsNativeSupported = !isWeb && !isExpoGo;

// Lazy, crash-safe access to the native module (null on web / Expo Go).
let cachedModule: any | undefined;
export function getAdsModule(): any {
  if (cachedModule === undefined) {
    cachedModule = adsNativeSupported ? loadNativeAdsModule() : null;
  }
  return cachedModule;
}
