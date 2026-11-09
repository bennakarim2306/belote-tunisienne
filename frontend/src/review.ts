// Store rating: native in-app review prompt (Google Play / App Store) shown
// after a WIN once the player is loyal (>= 5 finished games), at most once
// every 30 days and 3 times ever. Works only on a store-installed build —
// Expo Go and web silently skip it. The profile "rate the game" row opens
// the store listing directly and works everywhere.
import * as StoreReview from "expo-store-review";
import { Linking, Platform } from "react-native";

import { APP_INSTALL_URL } from "@/src/share";
import { storage } from "@/src/utils/storage";

const KEY = "store_review_state_v1"; // JSON {count, last}
const MIN_GAMES = 5;
const COOLDOWN_MS = 30 * 24 * 3600 * 1000;
const MAX_PROMPTS = 3;

export async function maybeAskStoreReview(gamesPlayed: number) {
  try {
    if (Platform.OS === "web") return;
    if (gamesPlayed < MIN_GAMES) return;
    const raw = (await storage.getItem(KEY, "")) || "";
    let st = { count: 0, last: 0 };
    try {
      if (raw) st = JSON.parse(raw);
    } catch {
      // corrupt state: start fresh
    }
    if (st.count >= MAX_PROMPTS) return;
    if (Date.now() - st.last < COOLDOWN_MS) return;
    if (!(await StoreReview.hasAction())) return;
    // count the attempt BEFORE showing: the OS may silently drop the popup
    await storage.setItem(KEY, JSON.stringify({ count: st.count + 1, last: Date.now() }));
    await StoreReview.requestReview();
  } catch {
    // never disturb the victory screen
  }
}

export function openStoreListing() {
  Linking.openURL(APP_INSTALL_URL).catch(() => {});
}
