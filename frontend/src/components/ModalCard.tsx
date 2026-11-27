import React from "react";
import { Platform, Pressable, StyleProp, View, ViewStyle } from "react-native";

// Card of a window that closes when the dark area around it is tapped.
// Taps inside the card must not close it. On Android a Pressable around a
// list takes the swipe away from the list (score history could not scroll),
// so on phones the card is a plain View that only claims the tap; in the
// browser a View cannot stop the click from reaching the dark area, so there
// it stays a Pressable.
export default function ModalCard({
  style,
  testID,
  children,
}: {
  style?: StyleProp<ViewStyle>;
  testID?: string;
  children?: React.ReactNode;
}) {
  if (Platform.OS === "web") {
    return (
      <Pressable style={style} onPress={() => {}} testID={testID}>
        {children}
      </Pressable>
    );
  }
  return (
    <View style={style} testID={testID} onStartShouldSetResponder={() => true}>
      {children}
    </View>
  );
}
