import AsyncStorage from "@react-native-async-storage/async-storage";
import { AudioPlayer, createAudioPlayer, setAudioModeAsync } from "expo-audio";

// Game SFX must NEVER interrupt music playing in another app:
// 'mixWithOthers' requests NO audio focus on Android (no pause/duck of the
// user's music) and mixes alongside other audio on iOS.
// playsInSilentMode: iOS mutes all app audio when the ring/silent hardware
// switch is on silent unless this is true (game SFX must ignore the switch).
setAudioModeAsync({ playsInSilentMode: true, interruptionMode: "mixWithOthers" }).catch(() => {});

const SOURCES = {
  deal: require("../assets/sounds/deal.wav"),
  card: require("../assets/sounds/card.wav"),
  trick: require("../assets/sounds/trick.wav"),
  belote: require("../assets/sounds/belote.wav"),
  victory: require("../assets/sounds/victory.wav"),
  defeat: require("../assets/sounds/defeat.wav"),
  yourTurn: require("../assets/sounds/your_turn.wav"),
  bid: require("../assets/sounds/bid.wav"),
  contre: require("../assets/sounds/contre.wav"),
  surcontre: require("../assets/sounds/surcontre.wav"),
  capot: require("../assets/sounds/capot.wav"),
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
