import { useFonts } from "expo-font";
import * as Linking from "expo-linking";
import * as NavigationBar from "expo-navigation-bar";
import * as Notifications from "expo-notifications";
import { router, Stack } from "expo-router";
import * as ScreenOrientation from "expo-screen-orientation";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar, setStatusBarHidden } from "expo-status-bar";
import { useEffect } from "react";
import { Alert, AppState, LogBox, Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import AsyncStorage from "@react-native-async-storage/async-storage";

import RotateGate from "@/src/components/RotateGate";
import { consentSettled } from "@/src/ads/consentGate";
import { AuthProvider } from "@/src/context/AuthContext";
import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { LanguageProvider } from "@/src/i18n";

// Push notifications: foreground display behaviour must be configured early
// (JS-side only — safe at module scope).
if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

const openPushUrl = (data: Record<string, unknown>) => {
  const url = (data.deeplink || data.action_url) as string | undefined;
  if (!url) return;
  if (url.startsWith("http")) Linking.openURL(url);
  else router.push(url as never);
};

// Android can replay the LAST tapped notification on every cold start, which
// used to yank the user away from whatever screen they had just opened (e.g.
// Profile flashing then disappearing). Each response is handled exactly once.
const PUSH_SEEN_KEY = "lastPushResponseSeen";
let handledPushId: string | null = null; // in-memory guard against double fire
const handlePushResponse = async (
  response: Notifications.NotificationResponse,
  coldStart = false,
) => {
  try {
    const id = `${response.notification.request.identifier}:${response.notification.date ?? ""}`;
    if (handledPushId === id) return; // tap listener + cold-start replay race
    handledPushId = id;
    if (coldStart) {
      const seen = await AsyncStorage.getItem(PUSH_SEEN_KEY);
      if (seen === id) return; // stale tap replayed by the OS — ignore it
      // a genuine launch-by-tap is recent; anything older is a replay
      const ageMs = Date.now() - (Number(response.notification.date) || 0) * 1000;
      if (Number.isFinite(ageMs) && ageMs > 2 * 60 * 1000) {
        await AsyncStorage.setItem(PUSH_SEEN_KEY, id);
        return;
      }
    }
    await AsyncStorage.setItem(PUSH_SEEN_KEY, id);
    try {
      Notifications.clearLastNotificationResponse();
    } catch {}
    openPushUrl(response.notification.request.content.data || {});
  } catch {}
};


// Disable logbox errors etc so that users can see the app
// and agent works as expected.
LogBox.ignoreAllLogs(true)

// Keep the native splash visible from cold start until icon fonts register.
// Required because @expo/vector-icons' componentDidMount fallback fires
// Font.loadAsync against a broken vendor path if any <Icon> mounts before
// the family is registered — which throws on Android Expo Go.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [iconsLoaded, iconsError] = useIconFonts();
  const [fontsLoaded, fontsError] = useFonts({
    SpaceGrotesk: require("../assets/fonts/SpaceGrotesk-Bold.ttf"),
    SpaceGroteskMedium: require("../assets/fonts/SpaceGrotesk-Medium.ttf"),
    Jakarta: require("../assets/fonts/PlusJakartaSans-Regular.ttf"),
    JakartaBold: require("../assets/fonts/PlusJakartaSans-Bold.ttf"),
    JakartaExtraBold: require("../assets/fonts/PlusJakartaSans-ExtraBold.ttf"),
    Playfair: require("../assets/fonts/PlayfairDisplay-Bold.ttf"),
    PlayfairSemi: require("../assets/fonts/PlayfairDisplay-SemiBold.ttf"),
  });

  const iconsReady = iconsLoaded || !!iconsError;
  const fontsReady = fontsLoaded || !!fontsError;

  // the whole app runs landscape-locked (card table layout), fullscreen
  // immersive: status bar + Android navigation bar hidden (swipe to reveal).
  // Android restores the system bars when the app is backgrounded/resumed,
  // so immersive mode is re-applied on every return to the foreground.
  useEffect(() => {
    if (Platform.OS !== "web") {
      ScreenOrientation.lockAsync(
        ScreenOrientation.OrientationLock.LANDSCAPE,
      ).catch(() => {});
    }
    if (Platform.OS !== "android") return;
    const applyImmersive = () => {
      setStatusBarHidden(true, "none");
      NavigationBar.setVisibilityAsync("hidden").catch(() => {});
      NavigationBar.setBehaviorAsync("overlay-swipe").catch(() => {});
    };
    applyImmersive();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") applyImmersive();
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (iconsReady && fontsReady) {
      SplashScreen.hideAsync();
    }
  }, [iconsReady, fontsReady]);

  // Push notifications: tap handlers (warm + cold start) and a weekly nudge
  // for users who permanently denied the permission.
  useEffect(() => {
    if (Platform.OS === "web") return;

    // Android channel — created after native modules are fully registered
    // (module-scope native calls can hard-crash cold starts on SDK 54)
    if (Platform.OS === "android") {
      Notifications.setNotificationChannelAsync("default", {
        name: "Default",
        importance: Notifications.AndroidImportance.MAX,
        sound: "default",
      }).catch(() => {});
    }

    // warm tap — notification tapped while the app is open/backgrounded
    let tapSub: { remove: () => void } | null = null;
    try {
      tapSub = Notifications.addNotificationResponseReceivedListener(
        (response) => {
          handlePushResponse(response);
        },
      );
    } catch {}

    // cold-start tap — only act on a response never handled before (the OS
    // keeps returning the last tapped notification on later launches too)
    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response) handlePushResponse(response, true);
      })
      .catch(() => {});

    // denied-permission weekly nudge -> deep-link to system settings
    (async () => {
      try {
        await consentSettled; // never overlap the ads consent dialog
        const { status, canAskAgain } = await Notifications.getPermissionsAsync();
        if (status !== "denied" || canAskAgain) return;
        const lastNudge = await AsyncStorage.getItem("pushNudgeAt");
        const oneWeek = 7 * 24 * 60 * 60 * 1000;
        if (lastNudge && Date.now() - Number(lastNudge) <= oneWeek) return;
        Alert.alert(
          "Notifications désactivées",
          "Active les notifications pour être prévenu quand des joueurs attendent une partie en ligne.",
          [
            {
              text: "Plus tard",
              style: "cancel",
              onPress: () => {
                AsyncStorage.setItem("pushNudgeAt", String(Date.now())).catch(() => {});
              },
            },
            {
              text: "Ouvrir les réglages",
              onPress: () => {
                AsyncStorage.setItem("pushNudgeAt", String(Date.now())).catch(() => {});
                Linking.openSettings();
              },
            },
          ],
        );
      } catch {}
    })();

    return () => {
      tapSub?.remove();
    };
  }, []);

  // If the CDN is unreachable we fall through on error rather than wedging
  // the app — icons will tofu, but the app still boots.
  if (!iconsReady || !fontsReady) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar hidden />
      <KeyboardProvider>
        <SafeAreaProvider>
          <LanguageProvider>
            <AuthProvider>
              <RotateGate>
                <Stack
                  screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: "#120F0D" },
                  }}
                />
              </RotateGate>
            </AuthProvider>
          </LanguageProvider>
        </SafeAreaProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
