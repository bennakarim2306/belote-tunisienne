import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { BG_SALON } from "@/src/anime/assets";
import { ScreenBackground, TurningCard } from "@/src/anime/components/ScreenParts";
import { useAnime } from "@/src/anime/design";
import { GameButton } from "@/src/anime/game/AnimeUI";
import Emblem from "@/src/anime/game/Emblem";
import { A } from "@/src/anime/tokens";
import { api } from "@/src/api";
import { useAuth } from "@/src/context/AuthContext";
import { useI18n } from "@/src/i18n";
import { C, F, SP } from "@/src/theme";

// Smart invite link /join/CODE: joins the room directly (code pre-filled).
// If the visitor isn't logged in yet, the code is stashed and the join
// resumes right after authentication (see home.tsx pending_room_code).
export default function JoinRoomScreen() {
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code: string }>();
  const { user, loading } = useAuth();
  const { t } = useI18n();
  const ANIME = useAnime();
  const [error, setError] = useState(false);
  const roomCode = (code ?? "").toUpperCase();

  useEffect(() => {
    if (loading) return;
    if (!roomCode) {
      router.replace("/");
      return;
    }
    if (!user) {
      AsyncStorage.setItem("pending_room_code", roomCode)
        .catch(() => {})
        .then(() => router.replace("/auth"));
      return;
    }
    (async () => {
      try {
        await api.post(`/rooms/${roomCode}/join`);
        router.replace({ pathname: "/room/[code]", params: { code: roomCode } });
      } catch {
        setError(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user, roomCode]);

  return (
    <View style={styles.container} testID="join-screen">
      {ANIME && <ScreenBackground source={BG_SALON} />}
      {error ? (
        <>
          {ANIME && <Emblem kind="roomClosed" size={130} />}
          <Text style={[styles.errorText, ANIME && styles.animeText]} testID="join-error">
            {t("roomGone")}
          </Text>
          <GameButton
            testID="join-back-home"
            label={t("backHome")}
            onPress={() => router.replace("/(tabs)/home")}
            style={ANIME ? undefined : { alignSelf: "stretch", marginHorizontal: SP.xl }}
          />
        </>
      ) : (
        <>
          <Text style={[styles.code, ANIME && { color: A.goldLight }]}>{roomCode}</Text>
          {ANIME ? <TurningCard height={96} /> : <ActivityIndicator color={C.brand} size="large" />}
          <Text style={[styles.joining, ANIME && { color: A.ivory }]}>{t("joiningRoom")}</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  animeText: { fontFamily: F.serif, color: A.goldLight },
  container: {
    flex: 1,
    backgroundColor: C.bg,
    alignItems: "center",
    justifyContent: "center",
    gap: SP.lg,
  },
  code: {
    fontFamily: F.extra,
    fontSize: 34,
    color: C.brand,
    letterSpacing: 6,
  },
  joining: { fontFamily: F.bold, fontSize: 15, color: C.ink2 },
  errorText: { fontFamily: F.display, fontSize: 18, color: C.ink },
});
