// iOS/Android only (Metro picks .native.ts over .ts on native platforms).
// The require is executed lazily and only in real dev/production builds
// (callers gate on adsNativeSupported), so Expo Go never loads the module.
export default function loadNativeAdsModule(): any {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("react-native-google-mobile-ads");
  } catch {
    return null;
  }
}
