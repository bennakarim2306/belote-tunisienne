import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Platform, StyleSheet, Text, View, useWindowDimensions } from "react-native";

import { useI18n } from "@/src/i18n";
import { C, F, SP } from "@/src/theme";

/** Web-only: the app is landscape-locked on native, but a browser can't be
 *  locked — show a full-screen overlay while the viewport is portrait. */
export default function RotateGate({ children }: { children: React.ReactNode }) {
  const { width, height } = useWindowDimensions();
  const { t } = useI18n();
  const portrait = Platform.OS === "web" && height > width;

  return (
    <View style={{ flex: 1 }}>
      {children}
      {portrait && (
        <View style={styles.overlay} testID="rotate-gate">
          <Ionicons name="phone-landscape" size={64} color={C.brand} />
          <Text style={styles.text}>{t("rotateDevice")}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: C.bg,
    alignItems: "center",
    justifyContent: "center",
    gap: SP.lg,
    padding: SP.xl,
    zIndex: 9999,
  },
  text: {
    fontFamily: F.display,
    fontSize: 18,
    color: C.ink,
    textAlign: "center",
  },
});
