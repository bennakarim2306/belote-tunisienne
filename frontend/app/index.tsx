import { Redirect } from "expo-router";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/src/context/AuthContext";
import { C, F } from "@/src/theme";

export default function Index() {
  const { user, loading } = useAuth();

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
