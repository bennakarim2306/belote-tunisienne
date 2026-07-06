import AsyncStorage from "@react-native-async-storage/async-storage";
import { AudioPlayer, createAudioPlayer } from "expo-audio";

const SOURCES = {
  deal: require("../assets/sounds/deal.wav"),
  card: require("../assets/sounds/card.wav"),
  trick: require("../assets/sounds/trick.wav"),
  belote: require("../assets/sounds/belote.wav"),
  victory: require("../assets/sounds/victory.wav"),
  defeat: require("../assets/sounds/defeat.wav"),
} as const;

export type SoundName = keyof typeof SOURCES;

const STORAGE_KEY = "sound_enabled";
let enabled = true;
const players: Partial<Record<SoundName, AudioPlayer>> = {};

AsyncStorage.getItem(STORAGE_KEY)
  .then((v) => {
    if (v !== null) enabled = v === "1";
  })
  .catch(() => {});

export function isSoundEnabled() {
  return enabled;
}

export function setSoundEnabled(v: boolean) {
  enabled = v;
  AsyncStorage.setItem(STORAGE_KEY, v ? "1" : "0").catch(() => {});
}

export function playSound(name: SoundName, volume = 0.8) {
  if (!enabled) return;
  try {
    let p = players[name];
    if (!p) {
      p = createAudioPlayer(SOURCES[name]);
      players[name] = p;
    }
    p.volume = volume;
    p.seekTo(0);
    p.play();
  } catch {
    // web autoplay policy or missing audio output — fail silently
  }
}
