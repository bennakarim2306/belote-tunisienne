import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "tutorial_progress";

// Number of completed lessons = index of the first still-locked lesson.
export async function getTutorialProgress(): Promise<number> {
  try {
    const v = await AsyncStorage.getItem(KEY);
    const n = v ? parseInt(v, 10) : 0;
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

export async function setTutorialProgress(n: number) {
  try {
    await AsyncStorage.setItem(KEY, String(n));
  } catch {}
}
