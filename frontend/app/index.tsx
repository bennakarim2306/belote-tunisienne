import { Redirect } from "expo-router";
import { ActivityIndicator, Image, StyleSheet, Text, View } from "react-native";

import { BG_ENTRY, LOGO } from "@/src/anime/assets";
import { ScreenBackground, TurningCard } from "@/src/anime/components/ScreenParts";
import { useAnime } from "@/src/anime/design";
import { useAuth } from "@/src/context/AuthContext";
import { C, F } from "@/src/theme";

export default function Index() {
  const { user, loading } = useAuth();
  const ANIME = useAnime();

  if (loading && ANIME) {
    return (
      <View style={styles.container} testID="splash-loading">
        <ScreenBackground source={BG_ENTRY} shade={0.3} />
        <Image source={LOGO.source} style={{ height: 96, width: 96 * LOGO.aspect }} resizeMode="contain" fadeDuration={0} />
        <View style={{ marginTop: 18 }}>
          <TurningCard height={86} />
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.container} testID="splash-loading">
        <Text style={styles.logo}>Belote</Text>
        <Text style={styles.logoAr}>بلوت تونسية</Text>
        <ActivityIndicator color={C.brand} size="large" style={{ marginTop: 24 }} />
      </View>
    );
  }

  if (user) return <Redirect href="/(tabs)/home" />;
  return <Redirect href="/auth" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    fontFamily: F.display,
    fontSize: 42,
    color: C.brand,
  },
  logoAr: {
    fontFamily: F.bold,
    fontSize: 20,
    color: C.ink2,
    marginTop: 4,
  },
});
