import { useRef, useState } from "react";
import {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from "react-native";
import {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

/** Collapsible top header: slides away when scrolling down a list and
 *  reappears when scrolling up. Header must be absolutely positioned at the
 *  top (apply `headerStyle`, call `onHeaderLayout`); give the list a
 *  paddingTop of `headerH` and forward scroll events to `onScrollDirection`. */
export function useCollapsibleHeader() {
  const [headerH, setHeaderH] = useState(120);
  const visible = useSharedValue(1);
  const lastY = useRef(0);

  const onScrollDirection = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const dy = y - lastY.current;
    if (y <= 12 || dy < -8) {
      visible.value = withTiming(1, { duration: 220 });
    } else if (dy > 8 && y > 48) {
      visible.value = withTiming(0, { duration: 220 });
    }
    lastY.current = y;
  };

  const headerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (visible.value - 1) * headerH }],
    opacity: visible.value,
  }));

  const onHeaderLayout = (e: LayoutChangeEvent) =>
    setHeaderH(Math.round(e.nativeEvent.layout.height));

  return { headerH, headerStyle, onHeaderLayout, onScrollDirection };
}
