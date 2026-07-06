import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ApiError } from "@/src/api";
import ChunkyButton from "@/src/components/ChunkyButton";
import { useAuth } from "@/src/context/AuthContext";
import { useI18n } from "@/src/i18n";
import { C, F, PATTERN_BG, R, SP } from "@/src/theme";

export default function AuthScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { login, register, loginWithGoogle } = useAuth();
  const { t, lang, setLang } = useI18n();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

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

  return (
    <ImageBackground source={{ uri: PATTERN_BG }} style={styles.bg} imageStyle={{ opacity: 0.35 }}>
      <LinearGradient
        colors={["rgba(18,15,13,0.55)", "rgba(18,15,13,0.92)", C.bg]}
        style={StyleSheet.absoluteFill}
      />
      <KeyboardAwareScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + SP.xl, paddingBottom: insets.bottom + SP.xl },
        ]}
        bottomOffset={24}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.langRow}>
          {(["fr", "ar"] as const).map((l) => (
            <Pressable
              key={l}
              testID={`lang-${l}-chip`}
              onPress={() => setLang(l)}
              style={[styles.langChip, lang === l && styles.langChipActive]}
            >
              <Text style={[styles.langText, lang === l && styles.langTextActive]}>
                {l === "fr" ? "FR" : "عربي"}
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
          />
          <TextInput
            testID="auth-password-input"
            style={styles.input}
            placeholder={t("password")}
            placeholderTextColor={C.ink3}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
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
            style={{ marginTop: SP.md }}
          />

          <View style={styles.orRow}>
            <View style={styles.orLine} />
            <Text style={styles.orText}>{t("or")}</Text>
            <View style={styles.orLine} />
          </View>

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
      </KeyboardAwareScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: C.bg },
  scroll: { flexGrow: 1, paddingHorizontal: SP.xl },
  langRow: { flexDirection: "row", justifyContent: "flex-end", gap: SP.sm },
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
  header: { alignItems: "center", marginTop: SP.xl, marginBottom: SP.xl },
  suits: { fontSize: 26, color: C.brand, letterSpacing: 6, marginBottom: SP.sm },
  title: { fontFamily: F.display, fontSize: 38, color: C.ink, textAlign: "center" },
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
    padding: SP.xl,
    borderWidth: 1,
    borderColor: C.border,
  },
  segment: {
    flexDirection: "row",
    backgroundColor: C.bg2,
    borderRadius: R.pill,
    padding: 4,
    marginBottom: SP.lg,
  },
  segmentBtn: {
    flex: 1,
    height: 40,
    borderRadius: R.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentActive: { backgroundColor: C.brand },
  segmentText: { fontFamily: F.display, fontSize: 15, color: C.ink2 },
  segmentTextActive: { color: C.onBrand },
  input: {
    height: 52,
    borderRadius: R.md,
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: SP.lg,
    fontFamily: F.text,
    fontSize: 16,
    color: C.ink,
    marginBottom: SP.md,
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
    marginVertical: SP.lg,
  },
  orLine: { flex: 1, height: 1, backgroundColor: C.border },
  orText: { fontFamily: F.text, color: C.ink3, fontSize: 13 },
  googleBtn: {
    height: 54,
    borderRadius: R.pill,
    borderWidth: 1.5,
    borderColor: C.borderStrong,
    backgroundColor: C.card,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SP.sm,
  },
  googleText: { fontFamily: F.display, fontSize: 15, color: C.ink },
});
