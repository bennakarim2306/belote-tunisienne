import { Ionicons } from "@expo/vector-icons";
import * as AppleAuthentication from "expo-apple-authentication";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BG_ENTRY, BTN_DARK, CHAT_CHIP, LOGO, MODAL_FRAME } from "@/src/anime/assets";
import HSlice from "@/src/anime/components/HSlice";
import NineSlice from "@/src/anime/components/NineSlice";
import { ScreenBackground, Segments } from "@/src/anime/components/ScreenParts";
import { useAnime } from "@/src/anime/design";
import { GameButton } from "@/src/anime/game/AnimeUI";
import { A } from "@/src/anime/tokens";
import { ApiError } from "@/src/api";
import ChunkyButton from "@/src/components/ChunkyButton";
import { useAuth } from "@/src/context/AuthContext";
import { useI18n } from "@/src/i18n";
import { C, F, PATTERN_BG, R, SP } from "@/src/theme";

export default function AuthScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { login, register, loginWithGoogle, loginWithApple, user } = useAuth();
  const { t, lang, setLang } = useI18n();
  const ANIME = useAnime();
  const narrow = useWindowDimensions().width < 720;

  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS === "ios") {
      AppleAuthentication.isAvailableAsync()
        .then(setAppleAvailable)
        .catch(() => {});
    }
  }, []);

  // Google login lands here with a session processed by AuthContext (either
  // via openAuthSessionAsync result or a deep link) — leave once authenticated
  useEffect(() => {
    if (user) router.replace("/(tabs)/home");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const mapError = (e: unknown): string => {
    if (e instanceof ApiError) {
      if (e.detail === "invalid_credentials") return t("authInvalid");
      if (e.detail === "email_taken") return t("emailTaken");
      if (e.detail === "username_taken") return t("usernameTaken");
    }
    return t("error_generic");
  };

  const submit = async () => {
    setError(null);
    if (!email.trim() || !password || (mode === "register" && !username.trim())) {
      setError(t("fillFields"));
      return;
    }
    if (mode === "register" && password.length < 6) {
      setError(t("passwordShort"));
      return;
    }
    setBusy(true);
    try {
      if (mode === "login") {
        await login(email.trim(), password);
      } else {
        await register(email.trim(), password, username.trim());
      }
      router.replace("/(tabs)/home");
    } catch (e) {
      setError(mapError(e));
    } finally {
      setBusy(false);
    }
  };

  const apple = async () => {
    setError(null);
    try {
      await loginWithApple();
    } catch (e) {
      // user closed the native Apple sheet: not an error
      if ((e as { code?: string })?.code !== "ERR_REQUEST_CANCELED") {
        setError(t("error_generic"));
      }
    }
  };

  const google = async () => {
    setError(null);
    setGoogleBusy(true);
    try {
      await loginWithGoogle();
    } catch {
      setError(t("error_generic"));
    } finally {
      setGoogleBusy(false);
    }
  };

  if (ANIME) {
    // visual layer only — same sign-in, register, Google / Apple, texts and testIDs
    const field = (testID: string, value: string, onChange: (v: string) => void, placeholder: string, extra: object) => (
      <View style={an.field}>
        <HSlice slices={CHAT_CHIP} />
        <TextInput
          testID={testID}
          style={an.input}
          placeholder={placeholder}
          placeholderTextColor={A.ivoryDim}
          value={value}
          onChangeText={onChange}
          disableFullscreenUI
          {...extra}
        />
      </View>
    );
    return (
      <View style={styles.bg}>
        <ScreenBackground source={BG_ENTRY} shade={0.18} />
        <KeyboardAwareScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + SP.md, paddingBottom: insets.bottom + SP.md }]}
          bottomOffset={24}
          showsVerticalScrollIndicator={false}
        >
          <View style={an.columns}>
            <View style={[an.door, narrow && { flex: 0.12 }]} />
            <View style={an.left}>
              <Image source={LOGO.source} style={an.logo} resizeMode="contain" fadeDuration={0} />
              <Text style={an.titleAr}>{t("appNameAr")}</Text>
              <Text style={an.tagline}>{t("tagline")}</Text>
              <View style={an.langs}>
                <Segments
                  value={lang}
                  onChange={(l) => setLang(l as "fr" | "ar" | "en")}
                  height={32}
                  compact
                  items={(["fr", "ar", "en"] as const).map((l) => ({
                    key: l,
                    label: l === "fr" ? "FR" : l === "ar" ? "عربي" : "EN",
                    testID: `lang-${l}-chip`,
                  }))}
                />
              </View>
            </View>
            <View style={an.right}>
              <View style={an.card}>
                <NineSlice slices={MODAL_FRAME} corner={24} />
                <View style={an.tabs}>
                  <Segments
                    value={mode}
                    onChange={setMode}
                    height={36}
                    items={[
                      { key: "login", label: t("login"), testID: "auth-login-tab" },
                      { key: "register", label: t("register"), testID: "auth-register-tab" },
                    ]}
                  />
                </View>
                {mode === "register" &&
                  field("auth-username-input", username, setUsername, t("username"), { autoCapitalize: "none", maxLength: 20 })}
                {field("auth-email-input", email, setEmail, t("email"), { autoCapitalize: "none", keyboardType: "email-address", autoComplete: "email" })}
                {field("auth-password-input", password, setPassword, t("password"), { secureTextEntry: true })}
                {error && (
                  <Text testID="auth-error-text" style={an.error}>
                    {error}
                  </Text>
                )}
                <GameButton
                  testID="auth-submit-button"
                  label={mode === "login" ? t("loginBtn") : t("registerBtn")}
                  onPress={submit}
                  loading={busy}
                  style={an.submit}
                />
                <View style={styles.orRow}>
                  <View style={[styles.orLine, { backgroundColor: A.goldFaint }]} />
                  <Text style={[styles.orText, { color: A.ivoryDim }]}>{t("or")}</Text>
                  <View style={[styles.orLine, { backgroundColor: A.goldFaint }]} />
                </View>
                {appleAvailable && (
                  <AppleAuthentication.AppleAuthenticationButton
                    testID="auth-apple-button"
                    buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                    buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
                    cornerRadius={21}
                    style={styles.appleBtn}
                    onPress={apple}
                  />
                )}
                <Pressable
                  testID="auth-google-button"
                  onPress={google}
                  disabled={googleBusy}
                  style={({ pressed }) => [an.google, pressed && { opacity: 0.85 }]}
                >
                  <HSlice slices={BTN_DARK} />
                  {googleBusy ? (
                    <ActivityIndicator color={A.goldLight} />
                  ) : (
                    <>
                      <View style={an.gBadge}>
                        <Ionicons name="logo-google" size={16} color="#4285F4" />
                      </View>
                      <Text style={an.googleText}>{t("googleBtn")}</Text>
                    </>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        </KeyboardAwareScrollView>
      </View>
    );
  }

  return (
    <ImageBackground source={{ uri: PATTERN_BG }} style={styles.bg} imageStyle={{ opacity: 0.35 }}>
      <LinearGradient
        colors={["rgba(18,15,13,0.55)", "rgba(18,15,13,0.92)", C.bg]}
        style={StyleSheet.absoluteFill}
      />
      <KeyboardAwareScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + SP.md, paddingBottom: insets.bottom + SP.lg },
        ]}
        bottomOffset={24}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.columns}>
          <View style={styles.colLeft}>
            <View style={styles.langRow}>
              {(["fr", "ar", "en"] as const).map((l) => (
                <Pressable
                  key={l}
                  testID={`lang-${l}-chip`}
                  onPress={() => setLang(l)}
                  style={[styles.langChip, lang === l && styles.langChipActive]}
                >
                  <Text style={[styles.langText, lang === l && styles.langTextActive]}>
                    {l === "fr" ? "FR" : l === "ar" ? "عربي" : "EN"}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.header}>
              <Text style={styles.suits}>♠ ♥ ♦ ♣</Text>
              <Text style={styles.title}>{t("appName")}</Text>
              <Text style={styles.titleAr}>{t("appNameAr")}</Text>
              <Text style={styles.tagline}>{t("tagline")}</Text>
            </View>
          </View>

          <View style={styles.colRight}>
        <View style={styles.card}>
          <View style={styles.segment}>
            <Pressable
              testID="auth-login-tab"
              onPress={() => setMode("login")}
              style={[styles.segmentBtn, mode === "login" && styles.segmentActive]}
            >
              <Text style={[styles.segmentText, mode === "login" && styles.segmentTextActive]}>
                {t("login")}
              </Text>
            </Pressable>
            <Pressable
              testID="auth-register-tab"
              onPress={() => setMode("register")}
              style={[styles.segmentBtn, mode === "register" && styles.segmentActive]}
            >
              <Text style={[styles.segmentText, mode === "register" && styles.segmentTextActive]}>
                {t("register")}
              </Text>
            </Pressable>
          </View>

          {mode === "register" && (
            <TextInput
              testID="auth-username-input"
              style={styles.input}
              placeholder={t("username")}
              placeholderTextColor={C.ink3}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              maxLength={20}
              disableFullscreenUI
            />
          )}
          <TextInput
            testID="auth-email-input"
            style={styles.input}
            placeholder={t("email")}
            placeholderTextColor={C.ink3}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            disableFullscreenUI
          />
          <TextInput
            testID="auth-password-input"
            style={styles.input}
            placeholder={t("password")}
            placeholderTextColor={C.ink3}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            disableFullscreenUI
          />

          {error && (
            <Text testID="auth-error-text" style={styles.error}>
              {error}
            </Text>
          )}

          <ChunkyButton
            testID="auth-submit-button"
            label={mode === "login" ? t("loginBtn") : t("registerBtn")}
            onPress={submit}
            loading={busy}
            small
            style={{ marginTop: SP.sm }}
          />

          <View style={styles.orRow}>
            <View style={styles.orLine} />
            <Text style={styles.orText}>{t("or")}</Text>
            <View style={styles.orLine} />
          </View>

          {appleAvailable && (
            <AppleAuthentication.AppleAuthenticationButton
              testID="auth-apple-button"
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
              cornerRadius={21}
              style={styles.appleBtn}
              onPress={apple}
            />
          )}

          <Pressable
            testID="auth-google-button"
            onPress={google}
            disabled={googleBusy}
            style={({ pressed }) => [styles.googleBtn, pressed && { opacity: 0.8 }]}
          >
            {googleBusy ? (
              <ActivityIndicator color={C.ink} />
            ) : (
              <>
                <Ionicons name="logo-google" size={20} color={C.brand} />
                <Text style={styles.googleText}>{t("googleBtn")}</Text>
              </>
            )}
          </Pressable>
        </View>
          </View>
        </View>
      </KeyboardAwareScrollView>
    </ImageBackground>
  );
}

// ---- new design ----
const an = StyleSheet.create({
  columns: { flexDirection: "row", alignItems: "center", gap: SP.lg, width: "100%", maxWidth: 980, alignSelf: "center" },
  door: { flex: 0.42 },
  left: { flex: 1, alignItems: "center" },
  logo: { width: "100%", maxWidth: 260, height: 260 / LOGO.aspect },
  titleAr: { fontFamily: F.bold, fontSize: 20, color: A.goldLight, marginTop: 2 },
  tagline: { fontFamily: F.text, fontSize: 13.5, color: A.ivory, textAlign: "center", marginTop: SP.xs, textShadowColor: "rgba(0,0,0,0.7)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  langs: { marginTop: SP.md },
  right: { flex: 1.15, maxWidth: 400 },
  card: { paddingHorizontal: 30, paddingVertical: 22 },
  tabs: { alignItems: "center", marginBottom: SP.sm },
  field: { height: 42, justifyContent: "center", paddingHorizontal: 22, marginBottom: 7 },
  // positioned so the text paints above the painted field (web)
  input: { position: "relative", zIndex: 1, fontFamily: F.text, fontSize: 14.5, color: A.ivory, paddingVertical: 0, height: 42 },
  error: { fontFamily: F.bold, fontSize: 12.5, color: "#FF8A80", textAlign: "center", marginBottom: 4 },
  submit: { alignSelf: "stretch", marginTop: 2 },
  google: { height: 42, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SP.sm, paddingHorizontal: 30 },
  gBadge: { width: 24, height: 24, borderRadius: 12, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  googleText: { fontFamily: F.display, fontSize: 13.5, color: A.ivory },
});

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: C.bg },
  scroll: { flexGrow: 1, paddingHorizontal: SP.xl, justifyContent: "center" },
  columns: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP.xxl,
    maxWidth: 880,
    width: "100%",
    alignSelf: "center",
  },
  colLeft: { flex: 1, alignItems: "center" },
  colRight: { flex: 1.1, maxWidth: 400 },
  langRow: { flexDirection: "row", justifyContent: "center", gap: SP.sm },
  langChip: {
    paddingHorizontal: SP.lg,
    height: 36,
    borderRadius: R.pill,
    backgroundColor: C.bg2,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.border,
    flexShrink: 0,
  },
  langChipActive: { backgroundColor: C.brand, borderColor: C.brand },
  langText: { fontFamily: F.bold, fontSize: 13, color: C.ink2 },
  langTextActive: { color: C.onBrand },
  header: { alignItems: "center", marginTop: SP.lg },
  suits: { fontSize: 24, color: C.brand, letterSpacing: 6, marginBottom: SP.sm },
  title: { fontFamily: F.display, fontSize: 34, color: C.ink, textAlign: "center" },
  titleAr: { fontFamily: F.bold, fontSize: 20, color: C.brand, marginTop: 2 },
  tagline: {
    fontFamily: F.text,
    fontSize: 14,
    color: C.ink2,
    marginTop: SP.sm,
    textAlign: "center",
  },
  card: {
    backgroundColor: C.card,
    borderRadius: R.lg,
    padding: SP.lg,
    borderWidth: 1,
    borderColor: C.border,
  },
  segment: {
    flexDirection: "row",
    backgroundColor: C.bg2,
    borderRadius: R.pill,
    padding: 3,
    marginBottom: SP.md,
  },
  segmentBtn: {
    flex: 1,
    height: 34,
    borderRadius: R.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentActive: { backgroundColor: C.brand },
  segmentText: { fontFamily: F.display, fontSize: 13.5, color: C.ink2 },
  segmentTextActive: { color: C.onBrand },
  input: {
    height: 42,
    borderRadius: R.md,
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: SP.md,
    paddingVertical: 0,
    fontFamily: F.text,
    fontSize: 14.5,
    color: C.ink,
    marginBottom: SP.sm,
  },
  error: {
    fontFamily: F.bold,
    color: C.error,
    fontSize: 13,
    textAlign: "center",
  },
  orRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP.md,
    marginVertical: SP.md,
  },
  orLine: { flex: 1, height: 1, backgroundColor: C.border },
  orText: { fontFamily: F.text, color: C.ink3, fontSize: 12.5 },
  appleBtn: { height: 42, marginBottom: SP.sm },
  googleBtn: {
    height: 42,
    borderRadius: R.pill,
    borderWidth: 1.5,
    borderColor: C.borderStrong,
    backgroundColor: C.card,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SP.sm,
  },
  googleText: { fontFamily: F.display, fontSize: 13.5, color: C.ink },
});
