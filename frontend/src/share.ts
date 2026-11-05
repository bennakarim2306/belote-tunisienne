import * as Clipboard from "expo-clipboard";
import { Linking, Share } from "react-native";

// Web URL of the app (used for deep links like room invites).
export const WEB_APP_URL = process.env.EXPO_PUBLIC_BACKEND_URL ?? "";

// Install link shared with friends: the Play Store listing of the game.
export const APP_INSTALL_URL =
  "https://play.google.com/store/apps/details?id=com.emergent.cardtableorient.b0nhgs";

// Smart link: opens the app/web directly on the room with the code pre-filled.
export const roomLink = (code: string) => `${WEB_APP_URL}/join/${code}`;

export function shareWhatsApp(text: string) {
  Linking.openURL(`https://wa.me/?text=${encodeURIComponent(text)}`).catch(() => {});
}

export function shareFacebook(text: string, url: string) {
  Linking.openURL(
    `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(text)}`,
  ).catch(() => {});
}

// Instagram has no text-share API: copy the message, then open the app.
export async function shareInstagram(text: string) {
  await Clipboard.setStringAsync(text).catch(() => {});
  try {
    await Linking.openURL("instagram://app");
  } catch {
    Linking.openURL("https://www.instagram.com/").catch(() => {});
  }
}

export async function copyToClipboard(text: string) {
  await Clipboard.setStringAsync(text).catch(() => {});
}

export function shareNative(text: string) {
  Share.share({ message: text }).catch(() => {});
}
