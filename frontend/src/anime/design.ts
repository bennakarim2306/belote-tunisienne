import { useSyncExternalStore } from "react";

import { ANIME_THEME_ENABLED } from "@/src/anime/flags";
import { storage } from "@/src/utils/storage";

// Which design the player sees. The build flag (flags.ts) stays the master
// switch: flag off = always the original design, nothing is read or stored.
// Flag on = the saved choice of the player, the new design by default.
// Stored as a design NAME so that further designs can be added.
// See docs/ANIME_DESIGN_SWITCH_PLAN.md.
export type DesignId = "emerald" | "classic";

const STORAGE_KEY = "design";
const DEFAULT_DESIGN: DesignId = "emerald";
const KNOWN: readonly DesignId[] = ["emerald", "classic"];

let current: DesignId = DEFAULT_DESIGN;
const listeners = new Set<() => void>();

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

/** For code outside components (avatars, offline game). */
export const isAnime = (): boolean => ANIME_THEME_ENABLED && current === "emerald";

/** For components: re-renders when the design changes. */
export const useAnime = (): boolean => useSyncExternalStore(subscribe, isAnime, isAnime);

/** Changes the design of the running app (does not save). */
export function applyDesign(id: DesignId) {
  if (current === id) return;
  current = id;
  listeners.forEach((fn) => fn());
}

/** Saves the choice on this device; false when it could not be written. */
export const saveDesign = (id: DesignId): Promise<boolean> => storage.setItem(STORAGE_KEY, id);

/** Called once at start, while the splash screen is visible. Never rejects and
 *  never blocks the start for long. */
export async function loadDesign(): Promise<void> {
  if (!ANIME_THEME_ENABLED) return;
  const saved = await Promise.race([
    storage.getItem(STORAGE_KEY, DEFAULT_DESIGN as string),
    new Promise<null>((r) => setTimeout(() => r(null), 1500)),
  ]);
  if (saved && (KNOWN as readonly string[]).includes(saved)) applyDesign(saved as DesignId);
}
