import { Redirect, Tabs } from "expo-router";
import { View } from "react-native";

import AdBanner from "@/src/ads/AdBanner";
import AdsProvider from "@/src/ads/AdsProvider";
import { useAuth } from "@/src/context/AuthContext";
import { NotificationsProvider } from "@/src/context/NotificationsContext";

// The bottom tab bar is replaced by a hamburger side menu (MenuButton, top-left
// of each screen) — only the ad banner remains anchored at the bottom.
function TabsInner() {
  return (
    <Tabs
      tabBar={() => (
        <View>
          <AdBanner />
        </View>
      )}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="home" />
      <Tabs.Screen name="leaderboard" />
      <Tabs.Screen name="friends" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}

export default function TabsLayout() {
  const { user, loading } = useAuth();

  if (!loading && !user) return <Redirect href="/auth" />;

  return (
    <NotificationsProvider>
      <AdsProvider>
        <TabsInner />
      </AdsProvider>
    </NotificationsProvider>
  );
}
