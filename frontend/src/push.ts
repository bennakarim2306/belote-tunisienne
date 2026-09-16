// Push notification registration (Emergent managed push — native builds only).
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { consentSettled } from "@/src/ads/consentGate";
import { api } from "@/src/api";

/**
 * Register this device for push. Safe to call often (backend upserts).
 * - Waits for the ads (UMP) consent dialog to fully settle first, so the
 *   Android permission dialog never races another native dialog (crash-safe).
 * - With `onlyIfGranted`, never shows the permission dialog (used on app
 *   resume: refresh the token only when permission was already given).
 */
export async function registerForPush(
  userId: string,
  opts?: { onlyIfGranted?: boolean },
) {
  if (Platform.OS === "web") return;
  try {
    await consentSettled;
    await new Promise((r) => setTimeout(r, 600)); // let the UMP activity close
    if (opts?.onlyIfGranted) {
      const cur = await Notifications.getPermissionsAsync();
      if (cur.status !== "granted") return;
    } else {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== "granted") return;
    }
    const tokenResp = await Notifications.getDevicePushTokenAsync();
    await api.post("/register-push", {
      user_id: userId,
      platform: Platform.OS,
      device_token: tokenResp.data,
    });
  } catch {
    // Expo Go / missing google-services.json / offline — never block the app
  }
}
