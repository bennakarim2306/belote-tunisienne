import React, { useEffect, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

import { ICONS } from "@/src/anime/assets";
import { useAnime } from "@/src/anime/design";
import { AnimeTitle, AnimeWindowFrame, GameButton } from "@/src/anime/game/AnimeUI";
import { A } from "@/src/anime/tokens";
import { useI18n } from "@/src/i18n";
import { storage } from "@/src/utils/storage";
import { F, SP } from "@/src/theme";

// One-time note after the update to 1.4.0: introduces the new design and says
// where to switch back. Shown once per device, only while the new design is
// on. Drawn inside the screen (not a native dialog), so it can never collide
// with the ads consent form or the notification permission prompt.
const SEEN_KEY = "design_notice_1_4_0";

export default function DesignNotice() {
  const ANIME = useAnime();
  const { t } = useI18n();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!ANIME) return;
    let alive = true;
    storage.getItem(SEEN_KEY, false).then((seen) => {
      if (alive && !seen) setTimeout(() => alive && setShow(true), 900);
    });
    return () => {
      alive = false;
    };
  }, [ANIME]);

  if (!show || !ANIME) return null;
  const close = () => {
    setShow(false);
    storage.setItem(SEEN_KEY, true);
  };
  return (
    <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(160)} style={styles.scrim} testID="design-notice">
      <View style={styles.window} onStartShouldSetResponder={() => true}>
        <AnimeWindowFrame />
        <AnimeTitle text={t("designNoticeTitle")} />
        <View style={styles.body}>
          <Image source={ICONS.design} style={styles.icon} resizeMode="contain" fadeDuration={0} />
          <Text style={styles.text}>{t("designNoticeBody")}</Text>
        </View>
        <View style={styles.hint}>
          <Image source={ICONS.profile} style={styles.hintIcon} resizeMode="contain" fadeDuration={0} />
          <Text style={styles.hintText}>{t("designNoticeHint")}</Text>
        </View>
        <GameButton testID="design-notice-ok" label={t("designNoticeOk")} onPress={close} style={styles.ok} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
    backgroundColor: "rgba(2,14,10,0.72)",
    alignItems: "center",
    justifyContent: "center",
    padding: SP.lg,
  },
  window: { width: "100%", maxWidth: 520, paddingHorizontal: 34, paddingTop: 22, paddingBottom: 24 },
  body: { flexDirection: "row", alignItems: "center", gap: SP.md, marginTop: SP.sm },
  icon: { width: 56, height: 56 },
  text: { flex: 1, fontFamily: F.text, fontSize: 14, lineHeight: 20, color: A.ivory },
  hint: { flexDirection: "row", alignItems: "center", gap: SP.sm, marginTop: SP.md },
  hintIcon: { width: 28, height: 28 },
  hintText: { flex: 1, fontFamily: F.bold, fontSize: 13, color: A.goldLight },
  ok: { marginTop: SP.md, minWidth: 200 },
});
