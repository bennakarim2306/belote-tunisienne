import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { api, ApiError } from "@/src/api";
import { useI18n } from "@/src/i18n";
import { C, F, R, SP } from "@/src/theme";

const MOODS = [
  { id: "sad", emoji: "😞" },
  { id: "neutral", emoji: "😐" },
  { id: "love", emoji: "😍" },
] as const;

export default function FeedbackModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { t, lang } = useI18n();
  const [mood, setMood] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const close = () => {
    onClose();
    setTimeout(() => {
      setMood(null);
      setMessage("");
      setSent(false);
      setError("");
      setSending(false);
    }, 300);
  };

  const send = async () => {
    if (!mood || sending) return;
    setSending(true);
    setError("");
    try {
      await api.post("/feedback", {
        mood,
        message: message.trim(),
        lang,
        platform: Platform.OS,
        app_version: Constants.expoConfig?.version ?? "",
      });
      setSent(true);
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 429
          ? t("feedbackTooSoon")
          : t("feedbackError"),
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" supportedOrientations={["landscape", "portrait"]} onRequestClose={close}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.scrim}
      >
        <View style={styles.card} testID="feedback-modal">
          {sent ? (
            <>
              <Ionicons name="checkmark-circle" size={44} color={C.green} />
              <Text style={styles.title} testID="feedback-thanks">
                {t("feedbackThanks")}
              </Text>
              <Text style={styles.body}>{t("feedbackThanksBody")}</Text>
              <Pressable
                testID="feedback-close-button"
                onPress={close}
                style={[styles.btn, styles.btnSolo]}
              >
                <Text style={[styles.btnText, { color: C.ink }]}>{t("close")}</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.title}>{t("feedbackTitle")}</Text>
              <Text style={styles.body}>{t("feedbackMoodQ")}</Text>
              <View style={styles.moodRow}>
                {MOODS.map((m) => (
                  <Pressable
                    key={m.id}
                    testID={`mood-${m.id}`}
                    onPress={() => setMood(m.id)}
                    style={[styles.mood, mood === m.id && styles.moodActive]}
                  >
                    <Text style={styles.moodEmoji}>{m.emoji}</Text>
                  </Pressable>
                ))}
              </View>
              <TextInput
                testID="feedback-message-input"
                style={styles.input}
                placeholder={t("feedbackPlaceholder")}
                placeholderTextColor={C.ink3}
                value={message}
                onChangeText={setMessage}
                multiline
                maxLength={2000}
              />
              {!!error && (
                <Text style={styles.error} testID="feedback-error">
                  {error}
                </Text>
              )}
              <View style={styles.row}>
                <Pressable
                  testID="feedback-cancel-button"
                  onPress={close}
                  style={[styles.btn, { backgroundColor: C.bg3 }]}
                >
                  <Text style={[styles.btnText, { color: C.ink }]}>{t("cancel")}</Text>
                </Pressable>
                <Pressable
                  testID="feedback-send-button"
                  disabled={!mood || sending}
                  onPress={send}
                  style={[
                    styles.btn,
                    { backgroundColor: C.gold, opacity: !mood || sending ? 0.45 : 1 },
                  ]}
                >
                  <Text style={[styles.btnText, { color: "#2a2117" }]}>
                    {sending ? "…" : t("feedbackSend")}
                  </Text>
                </Pressable>
              </View>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    alignItems: "center",
    justifyContent: "center",
    padding: SP.lg,
  },
  card: {
    backgroundColor: C.card,
    borderRadius: R.lg,
    borderWidth: 1.5,
    borderColor: "rgba(233,196,106,0.4)",
    padding: SP.xl,
    alignItems: "center",
    maxWidth: 440,
    width: "100%",
  },
  title: { fontFamily: F.serif, fontSize: 19, color: C.ink, marginTop: SP.xs },
  body: {
    fontFamily: F.text,
    fontSize: 13.5,
    color: C.ink2,
    textAlign: "center",
    marginTop: SP.xs,
  },
  moodRow: { flexDirection: "row", gap: SP.md, marginTop: SP.md },
  mood: {
    width: 64,
    height: 56,
    borderRadius: R.md,
    backgroundColor: C.bg3,
    borderWidth: 2,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  moodActive: { borderColor: C.gold, backgroundColor: "rgba(233,196,106,0.14)" },
  moodEmoji: { fontSize: 28 },
  input: {
    alignSelf: "stretch",
    minHeight: 72,
    maxHeight: 130,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.bg3,
    color: C.ink,
    fontFamily: F.text,
    fontSize: 14,
    padding: SP.md,
    marginTop: SP.md,
    textAlignVertical: "top",
  },
  error: {
    fontFamily: F.text,
    fontSize: 12.5,
    color: C.error,
    textAlign: "center",
    marginTop: SP.sm,
  },
  row: { flexDirection: "row", gap: SP.sm, marginTop: SP.lg, alignSelf: "stretch" },
  btn: {
    flex: 1,
    height: 44,
    borderRadius: R.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SP.sm,
  },
  btnSolo: {
    flex: 0,
    alignSelf: "stretch",
    backgroundColor: C.bg3,
    marginTop: SP.lg,
  },
  btnText: { fontFamily: F.display, fontSize: 13 },
});
