// Web fallback: the AdMob native library is never bundled on web.
export default function loadNativeAdsModule(): any {
  return null;
}
