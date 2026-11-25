import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Image, Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { BTN_ICON_GREEN, ICONS } from "@/src/anime/assets";
import { IconTextButton } from "@/src/anime/components/ScreenParts";
import { useAnime } from "@/src/anime/design";
import { AnimeTitle, AnimeWindowFrame } from "@/src/anime/game/AnimeUI";
import { A } from "@/src/anime/tokens";
import ChunkyButton from "@/src/components/ChunkyButton";
import { useI18n } from "@/src/i18n";
import {
  copyToClipboard,
  shareFacebook,
  shareInstagram,
  shareNative,
  shareWhatsApp,
} from "@/src/share";
import { C, F, R, SP } from "@/src/theme";

interface Props {
  visible: boolean;
  onClose: () => void;
  title: string;
  message: string; // full text shared (includes the link)
  url: string; // bare link (copied / used by Facebook)
}

// Bottom sheet with WhatsApp / Facebook / Instagram / copy-link + native share.
export default function ShareSheet({ visible, onClose, title, message, url }: Props) {
  const { t } = useI18n();
  const ANIME = useAnime();
  const [feedback, setFeedback] = useState<string | null>(null);

  const flash = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 2200);
  };

  const channels = [
    {
      id: "whatsapp",
      label: "WhatsApp",
      icon: "logo-whatsapp" as const,
      color: "#25D366",
      onPress: () => shareWhatsApp(message),
    },
    {
      id: "facebook",
      label: "Facebook",
      icon: "logo-facebook" as const,
      color: "#1877F2",
      onPress: () => shareFacebook(message, url),
    },
    {
      id: "instagram",
      label: "Instagram",
      icon: "logo-instagram" as const,
      color: "#E1306C",
      onPress: async () => {
        await shareInstagram(message);
        flash(t("igCopied"));
      },
    },
    {
      id: "copy",
      label: t("copyLink"),
      icon: "link" as const,
      color: C.brand,
      onPress: async () => {
        await copyToClipboard(url);
        flash(t("linkCopied"));
      },
    },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" supportedOrientations={["landscape", "portrait"]} onRequestClose={onClose}>
      <Pressable style={[styles.scrim, ANIME && styles.animeScrim]} onPress={onClose}>
        <Pressable style={[styles.sheet, ANIME && styles.animeSheet]} onPress={() => {}} testID="share-sheet">
          {ANIME ? (
            <>
              <AnimeWindowFrame />
              <AnimeTitle text={title} />
            </>
          ) : (
            <>
              <View style={styles.handle} />
              <Text style={styles.title}>{title}</Text>
            </>
          )}
          <Text style={[styles.preview, ANIME && { color: A.ivoryDim }]} numberOfLines={3}>
            {message}
          </Text>
          <View style={[styles.row, ANIME && { marginTop: SP.md }]}>
            {channels.map((ch) => (
              <Pressable
                key={ch.id}
                testID={`share-${ch.id}`}
                onPress={ch.onPress}
                style={({ pressed }) => [styles.channel, pressed && { opacity: 0.7 }]}
              >
                {ANIME && ch.id === "copy" ? (
                  <View style={[styles.channelIcon, styles.animeCopy]}>
                    <Image source={BTN_ICON_GREEN} style={styles.animeCopyBg} resizeMode="stretch" fadeDuration={0} />
                    <Image source={ICONS.link} style={styles.animeCopyIcon} resizeMode="contain" fadeDuration={0} />
                  </View>
                ) : (
                <View style={[styles.channelIcon, { backgroundColor: ch.color }, ANIME && styles.animeRing]}>
                  <Ionicons name={ch.icon} size={26} color="#FFFFFF" />
                </View>
                )}
                <Text style={[styles.channelLabel, ANIME && { color: A.ivory }]} numberOfLines={1}>
                  {ch.label}
                </Text>
              </Pressable>
            ))}
          </View>
          {feedback && (
            <Text style={[styles.feedback, ANIME && styles.animeFeedback]} testID="share-feedback">
              {feedback}
            </Text>
          )}
          {ANIME ? (
            <IconTextButton
              testID="share-native-button"
              icon={ICONS.more}
              label={t("moreOptions")}
              onPress={() => shareNative(message)}
              style={{ marginTop: SP.md, alignSelf: "center", minWidth: 220 }}
            />
          ) : (
          <ChunkyButton
            testID="share-native-button"
            label={t("moreOptions")}
            variant="ghost"
            onPress={() => shareNative(message)}
            style={{ marginTop: SP.md }}
          />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // ---- new design (brand logos keep their own look) ----
  animeScrim: { justifyContent: "center", alignItems: "center" },
  animeSheet: {
    backgroundColor: "transparent",
    borderWidth: 0,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    width: "100%",
    maxWidth: 560,
    paddingHorizontal: 34,
    paddingTop: 22,
    paddingBottom: 26,
  },
  animeRing: { borderWidth: 2, borderColor: A.gold },
  animeCopy: { backgroundColor: "transparent" },
  animeCopyBg: { position: "absolute", top: 0, left: 0, width: 56, height: 56 },
  animeCopyIcon: { width: 32, height: 32 },
  animeFeedback: { color: A.goldLight, marginTop: SP.sm },
  scrim: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: C.card,
    borderTopLeftRadius: R.lg,
    borderTopRightRadius: R.lg,
    padding: SP.xl,
    paddingBottom: SP.xxl,
    borderWidth: 1,
    borderColor: C.border,
  },
  handle: {
    alignSelf: "center",
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: C.bg3,
    marginBottom: SP.md,
  },
  title: {
    fontFamily: F.display,
    fontSize: 19,
    color: C.ink,
    textAlign: "center",
  },
  preview: {
    fontFamily: F.text,
    fontSize: 12.5,
    color: C.ink3,
    textAlign: "center",
    marginTop: SP.sm,
    lineHeight: 18,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: SP.xl,
  },
  channel: { alignItems: "center", width: 76 },
  channelIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  channelLabel: {
    fontFamily: F.bold,
    fontSize: 11.5,
    color: C.ink2,
    marginTop: 6,
  },
  feedback: {
    fontFamily: F.bold,
    fontSize: 13,
    color: C.brand,
    textAlign: "center",
    marginTop: SP.lg,
  },
});
