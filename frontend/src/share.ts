import * as Clipboard from "expo-clipboard";
import { Linking, Share } from "react-native";

// Public link of the app. Once published on the stores, replace with the
// Play Store / App Store URL (or a smart onelink) to boost installs.
export const APP_INSTALL_URL = process.env.EXPO_PUBLIC_BACKEND_URL ?? "";

// Smart link: opens the app/web directly on the room with the code pre-filled.
export const roomLink = (code: string) => `${APP_INSTALL_URL}/join/${code}`;

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
