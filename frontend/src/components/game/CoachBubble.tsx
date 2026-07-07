import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown, FadeOut } from "react-native-reanimated";

import { C, F, R, SP } from "@/src/theme";

// Animated coach bubble shown in the teaching (tutorial) game.
export default function CoachBubble({ text, label }: { text: string; label: string }) {
  return (
    <Animated.View
      key={text}
      entering={FadeInDown.duration(260)}
      exiting={FadeOut.duration(150)}
      style={styles.bubble}
      pointerEvents="none"
      testID="coach-bubble"
    >
      <View style={styles.iconWrap}>
        <Ionicons name="school" size={15} color="#1A1200" />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.text}>{text}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP.sm,
    backgroundColor: "rgba(20,16,8,0.92)",
    borderWidth: 1.5,
    borderColor: "rgba(255,190,60,0.65)",
    borderRadius: R.md,
    paddingVertical: SP.sm,
    paddingHorizontal: SP.md,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: C.gold,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { fontFamily: F.extra, fontSize: 10, color: C.gold, letterSpacing: 0.6 },
  text: { fontFamily: F.bold, fontSize: 12.5, color: C.ink, lineHeight: 17, marginTop: 1 },
});
