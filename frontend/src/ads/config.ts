import { Platform } from "react-native";

// Master switch — set to false to disable all ads without touching the UI code.
export const ADS_ENABLED = true;

// REAL AdMob unit IDs (provided by the owner — AdMob console account 5073907506851296).
export const AD_UNITS = {
  banner: Platform.select({
    android: "ca-app-pub-5073907506851296/3759850400",
    ios: "ca-app-pub-5073907506851296/2875355594",
    default: "",
  }) as string,
  interstitial: Platform.select({
    android: "ca-app-pub-5073907506851296/9305032572",
    ios: "ca-app-pub-5073907506851296/4226754266",
    default: "",
  }) as string,
};
