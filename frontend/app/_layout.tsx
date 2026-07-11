import { useFonts } from "expo-font";
import * as NavigationBar from "expo-navigation-bar";
import { Stack } from "expo-router";
import * as ScreenOrientation from "expo-screen-orientation";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar, setStatusBarHidden } from "expo-status-bar";
import { useEffect } from "react";
import { AppState, LogBox, Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import RotateGate from "@/src/components/RotateGate";
import { AuthProvider } from "@/src/context/AuthContext";
import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { LanguageProvider } from "@/src/i18n";


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
