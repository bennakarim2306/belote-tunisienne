import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState, Platform } from "react-native";

import { api, setApiToken } from "@/src/api";
import { registerForPush } from "@/src/push";
import { storage } from "@/src/utils/storage";

export interface User {
  user_id: string;
  email: string;
  username: string;
  name?: string;
  avatar_id: string;
  elo: number;
  elo_duo?: number;
  games_played: number;
  wins: number;
  losses: number;
  stats?: Record<string, number>;
  elo_history?: { elo: number; ts: string }[];
  auth_provider?: string;
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, username: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setUser: (u: User) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = "auth_token";

function extractSessionId(url: string): string | null {
  const hashMatch = url.match(/[#&?]session_id=([^&#]+)/);
  return hashMatch ? decodeURIComponent(hashMatch[1]) : null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const processedRef = useRef(false);

  const applySession = useCallback(async (tok: string, u: User) => {
    setApiToken(tok);
    setToken(tok);
    setUserState(u);
    await storage.secureSet(TOKEN_KEY, tok);
  }, []);

  const processSessionId = useCallback(
    async (sessionId: string) => {
      const res = await api.post("/auth/google/session", { session_id: sessionId });
      await applySession(res.token, res.user);
    },
    [applySession],
  );

  // Initial session bootstrap
  useEffect(() => {
    (async () => {
      try {
        // Web: session_id in URL fragment takes priority
        if (Platform.OS === "web" && typeof window !== "undefined") {
          const sid = extractSessionId(window.location.hash || "") ||
            extractSessionId(window.location.search || "");
          if (sid && !processedRef.current) {
            processedRef.current = true;
            try {
              await processSessionId(sid);
            } finally {
              window.history.replaceState(null, "", window.location.pathname);
            }
            return;
          }
        }
        // Mobile cold start via deep link
        if (Platform.OS !== "web") {
          const initialUrl = await Linking.getInitialURL();
          const sid = initialUrl ? extractSessionId(initialUrl) : null;
          if (sid && !processedRef.current) {
            processedRef.current = true;
            await processSessionId(sid);
            return;
          }
        }
        const stored = await storage.secureGet(TOKEN_KEY, "");
        if (stored) {
          setApiToken(stored);
          try {
            const me = await api.get("/auth/me");
            setToken(stored);
            setUserState(me);
          } catch {
            setApiToken(null);
            await storage.secureRemove(TOKEN_KEY);
          }
        }
      } catch {
        // stay logged out
      } finally {
        setLoading(false);
      }
    })();
  }, [processSessionId]);

  // Presence heartbeat — lets friends see us as "online" (green dot)
  useEffect(() => {
    if (!token) return;
    const ping = () => {
      api.post("/presence/ping", {}).catch(() => {});
    };
    ping();
    const iv = setInterval(ping, 30000);
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") ping();
    });
    return () => {
      clearInterval(iv);
      sub.remove();
    };
  }, [token]);

  // Push registration — on login (dialog allowed, after ads consent settles)
  // and on app resume (silent: only refreshes the token if already granted)
  useEffect(() => {
    const uid = user?.user_id;
    if (!uid || !token) return;
    registerForPush(uid);
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") registerForPush(uid, { onlyIfGranted: true });
    });
    return () => sub.remove();
  }, [user?.user_id, token]);

  // Hot deep links (mobile)
  useEffect(() => {
    if (Platform.OS === "web") return;
    const sub = Linking.addEventListener("url", async ({ url }) => {
      const sid = extractSessionId(url);
      if (sid && !processedRef.current) {
        processedRef.current = true;
        try {
          await processSessionId(sid);
        } catch {}
      }
    });
    return () => sub.remove();
  }, [processSessionId]);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await api.post("/auth/login", { email, password });
      await applySession(res.token, res.user);
    },
    [applySession],
  );

  const register = useCallback(
    async (email: string, password: string, username: string) => {
      const res = await api.post("/auth/register", { email, password, username });
      await applySession(res.token, res.user);
    },
    [applySession],
  );

  const loginWithGoogle = useCallback(async () => {
    // per Emergent Auth playbook: root redirect on mobile (exp:// in Expo Go)
    const redirectUrl =
      Platform.OS === "web"
        ? `${window.location.origin}/`
        : Linking.createURL("");
    const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
    if (Platform.OS === "web") {
      window.location.href = authUrl;
      return;
    }
    processedRef.current = false;
    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
    if (result.type === "success" && result.url) {
      const sid = extractSessionId(result.url);
      if (sid) {
        processedRef.current = true;
        await processSessionId(sid);
      }
    }
  }, [processSessionId]);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch {}
    setApiToken(null);
    setToken(null);
    setUserState(null);
    await storage.secureRemove(TOKEN_KEY);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const me = await api.get("/auth/me");
      setUserState(me);
    } catch {}
  }, []);

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      login,
      register,
      loginWithGoogle,
      logout,
      refreshUser,
      setUser: setUserState,
    }),
    [user, token, loading, login, register, loginWithGoogle, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}
