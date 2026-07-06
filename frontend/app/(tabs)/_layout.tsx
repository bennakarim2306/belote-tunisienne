import { Ionicons } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/context/AuthContext";
import {
  NotificationsProvider,
  useNotifications,
} from "@/src/context/NotificationsContext";
import { useI18n } from "@/src/i18n";
import { C, F } from "@/src/theme";

function TabsInner() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { friendRequests, invites } = useNotifications();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.brand,
        tabBarInactiveTintColor: C.ink3,
        tabBarStyle: {
          backgroundColor: C.card,
          borderTopWidth: 1,
          borderTopColor: C.border,
          height: 60 + insets.bottom,
          paddingTop: 6,
          paddingBottom: Math.max(insets.bottom, 8),
        },
        tabBarLabelStyle: { fontFamily: F.bold, fontSize: 11 },
        tabBarBadgeStyle: {
          backgroundColor: C.brand,
          color: C.onBrand,
          fontFamily: F.bold,
          fontSize: 10,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: t("tabHome"),
          tabBarBadge: invites.length > 0 ? invites.length : undefined,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="leaderboard"
        options={{
          title: t("tabRanking"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="trophy" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="friends"
        options={{
          title: t("tabFriends"),
          tabBarBadge: friendRequests.length > 0 ? friendRequests.length : undefined,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t("tabProfile"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

export default function TabsLayout() {
  const { user, loading } = useAuth();

  if (!loading && !user) return <Redirect href="/auth" />;

  return (
    <NotificationsProvider>
      <TabsInner />
    </NotificationsProvider>
  );
}
