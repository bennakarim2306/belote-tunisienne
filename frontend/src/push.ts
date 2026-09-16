// Push notification registration (Emergent managed push — native builds only).
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { api } from "@/src/api";

/** Register this device for push. Safe to call often (backend upserts). */
export async function registerForPush(userId: string) {
  if (Platform.OS === "web") return;
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== "granted") return;
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
