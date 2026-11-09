import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";

import { api, wsUrl } from "@/src/api";
import { useAuth } from "@/src/context/AuthContext";

export interface FriendRequestNotif {
  friendship_id: string;
  user_id: string;
  username: string;
  avatar_id: string;
  elo: number;
}

export interface InviteNotif {
  invite_id: string;
  room_code: string;
  match_type: string;
  from_user: { username: string; avatar_id: string };
}

export interface DuoInviteNotif {
  invite_id: string;
  match_type: string;
  mode: string;
  from_user: { user_id: string; username: string; avatar_id: string };
}

export interface CurrentGameInfo {
  game_id: string;
  match_type: string;
  phase: string;
  hand_number: number;
  match_scores: [number, number];
  target: number;
  my_team: number;
}

interface NotifValue {
  friendRequests: FriendRequestNotif[];
  invites: InviteNotif[];
  duoInvites: DuoInviteNotif[];
  online: number;
  waiting: number;
  currentGame: CurrentGameInfo | null;
  /** bumps whenever the server pushes a matchmaking event (found/update) */
  mmSignal: number;
  refresh: () => Promise<void>;
  setSlowMode: (slow: boolean) => void;
}

const NotificationsContext = createContext<NotifValue>({
  friendRequests: [],
  invites: [],
  duoInvites: [],
  online: 0,
  waiting: 0,
  currentGame: null,
  mmSignal: 0,
  refresh: async () => {},
  setSlowMode: () => {},
});

const FAST_MS = 7000; // HTTP fallback cadence (social freshness ~7 s)
const SLOW_MS = 20000; // fallback cadence during an online game
const PING_MS = 25000; // WS heartbeat (doubles as presence, window 90 s)

/**
 * Phase 2 realtime channel: one lightweight WebSocket per logged-in player
 * (WS /api/ws/sync). The server pushes friend requests, invites, current
 * game and "opponent found" instantly — zero HTTP polling while the channel
 * is healthy. If the socket drops, the HTTP /sync poll (Phase 1) takes over
 * until the channel reconnects. Background = everything off.
 */
export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user, token } = useAuth();
  const userId = user?.user_id ?? null;
  const [friendRequests, setFriendRequests] = useState<FriendRequestNotif[]>([]);
  const [invites, setInvites] = useState<InviteNotif[]>([]);
  const [duoInvites, setDuoInvites] = useState<DuoInviteNotif[]>([]);
  const [online, setOnline] = useState(0);
  const [waiting, setWaiting] = useState(0);
  const [currentGame, setCurrentGame] = useState<CurrentGameInfo | null>(null);
  const [mmSignal, setMmSignal] = useState(0);

  const hashRef = useRef("");
  const slowRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollingRef = useRef(false);
  const aliveRef = useRef(false);
  const tokenRef = useRef<string | null>(null);
  tokenRef.current = token ?? null;

  const wsRef = useRef<WebSocket | null>(null);
  const wsOkRef = useRef(false);
  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applySync = useCallback((res: any) => {
    setOnline(res.online ?? 0);
    setWaiting(res.waiting ?? 0);
    if (res.data) {
      setFriendRequests(res.data.friend_requests ?? []);
      setInvites(res.data.invites ?? []);
      setDuoInvites(res.data.duo_invites ?? []);
      setCurrentGame(res.data.current_game ?? null);
    }
    hashRef.current = res.h ?? "";
  }, []);

  const poll = useCallback(async () => {
    if (pollingRef.current) return;
    pollingRef.current = true;
    try {
      const res = await api.get(`/sync?h=${hashRef.current}`);
      applySync(res);
    } catch {}
    pollingRef.current = false;
  }, [applySync]);

  // HTTP fallback loop — only runs while the realtime channel is down
  const schedule = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      if (!aliveRef.current || AppState.currentState !== "active") return;
      if (wsOkRef.current) return; // realtime channel handles it
      await poll();
      schedule();
    }, slowRef.current ? SLOW_MS : FAST_MS);
  }, [poll]);

  const closeWs = useCallback(() => {
    wsOkRef.current = false;
    if (pingRef.current) clearInterval(pingRef.current);
    pingRef.current = null;
    if (reconnectRef.current) clearTimeout(reconnectRef.current);
    reconnectRef.current = null;
    const ws = wsRef.current;
    wsRef.current = null;
    if (ws) {
      ws.onclose = null;
      ws.onmessage = null;
      ws.onopen = null;
      ws.onerror = null;
      try {
        ws.close();
      } catch {}
    }
  }, []);

  const connectWs = useCallback(() => {
    if (!aliveRef.current || wsRef.current || !tokenRef.current) return;
    if (AppState.currentState !== "active") return;
    let ws: WebSocket;
    try {
      ws = new WebSocket(
        wsUrl(`/api/ws/sync?token=${encodeURIComponent(tokenRef.current)}`),
      );
    } catch {
      schedule();
      return;
    }
    wsRef.current = ws;
    ws.onopen = () => {
      wsOkRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current); // stop HTTP polls
      pingRef.current = setInterval(() => {
        try {
          ws.send(JSON.stringify({ action: "ping" }));
        } catch {}
      }, PING_MS);
    };
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data as string);
        if (msg.type === "sync") applySync(msg);
        else if (msg.type === "mm_found" || msg.type === "mm_update"
                 || msg.type === "mm_confirm") {
          setMmSignal(Date.now());
        }
      } catch {}
    };
    ws.onerror = () => {};
    ws.onclose = () => {
      const wasOk = wsOkRef.current;
      wsOkRef.current = false;
      if (pingRef.current) clearInterval(pingRef.current);
      pingRef.current = null;
      wsRef.current = null;
      if (!aliveRef.current || AppState.currentState !== "active") return;
      poll(); // immediate catch-up, then HTTP fallback until reconnected
      schedule();
      reconnectRef.current = setTimeout(connectWs, wasOk ? 3000 : 20000);
    };
  }, [applySync, poll, schedule]);

  useEffect(() => {
    if (!userId) {
      setFriendRequests([]);
      setInvites([]);
      setDuoInvites([]);
      setCurrentGame(null);
      hashRef.current = "";
      return;
    }
    aliveRef.current = true;
    poll().then(() => {
      schedule();
      connectWs();
    });
    // background = zero network; instant catch-up + reconnect on resume
    const sub = AppState.addEventListener("change", (s) => {
      if (!aliveRef.current) return;
      if (s === "active") {
        poll().then(() => {
          schedule();
          connectWs();
        });
      } else {
        closeWs();
        if (timerRef.current) clearTimeout(timerRef.current);
      }
    });
    return () => {
      aliveRef.current = false;
      closeWs();
      if (timerRef.current) clearTimeout(timerRef.current);
      sub.remove();
    };
  }, [userId, poll, schedule, connectWs, closeWs]);

  // force a full payload on demand (after accepting/dismissing an invite...)
  const refresh = useCallback(async () => {
    if (!userId) return;
    hashRef.current = "";
    await poll();
  }, [userId, poll]);

  const setSlowMode = useCallback(
    (slow: boolean) => {
      if (slowRef.current === slow) return;
      slowRef.current = slow;
      if (aliveRef.current && !wsOkRef.current && timerRef.current) schedule();
    },
    [schedule],
  );

  const value = useMemo(
    () => ({
      friendRequests,
      invites,
      duoInvites,
      online,
      waiting,
      currentGame,
      mmSignal,
      refresh,
      setSlowMode,
    }),
    [friendRequests, invites, duoInvites, online, waiting, currentGame,
     mmSignal, refresh, setSlowMode],
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

export const useNotifications = () => useContext(NotificationsContext);
