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

import { api } from "@/src/api";
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
  refresh: async () => {},
  setSlowMode: () => {},
});

const FAST_MS = 7000; // normal cadence (social freshness ~7 s)
const SLOW_MS = 20000; // during an online game (WS covers the gameplay)

/**
 * Single batched poll: GET /sync replaces the separate presence ping/pulse,
 * notifications and current-game polls. The server answers "nothing new"
 * (tiny response) when the social payload hasn't changed, and the poll stops
 * entirely while the app is in the background.
 */
export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.user_id ?? null;
  const [friendRequests, setFriendRequests] = useState<FriendRequestNotif[]>([]);
  const [invites, setInvites] = useState<InviteNotif[]>([]);
  const [duoInvites, setDuoInvites] = useState<DuoInviteNotif[]>([]);
  const [online, setOnline] = useState(0);
  const [waiting, setWaiting] = useState(0);
  const [currentGame, setCurrentGame] = useState<CurrentGameInfo | null>(null);

  const hashRef = useRef("");
  const slowRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollingRef = useRef(false);
  const aliveRef = useRef(false);

  const poll = useCallback(async () => {
    if (pollingRef.current) return;
    pollingRef.current = true;
    try {
      const res = await api.get(`/sync?h=${hashRef.current}`);
      setOnline(res.online ?? 0);
      setWaiting(res.waiting ?? 0);
      if (res.data) {
        setFriendRequests(res.data.friend_requests ?? []);
        setInvites(res.data.invites ?? []);
        setDuoInvites(res.data.duo_invites ?? []);
        setCurrentGame(res.data.current_game ?? null);
      }
      hashRef.current = res.h ?? "";
    } catch {}
    pollingRef.current = false;
  }, []);

  const schedule = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      if (!aliveRef.current || AppState.currentState !== "active") return;
      await poll();
      schedule();
    }, slowRef.current ? SLOW_MS : FAST_MS);
  }, [poll]);

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
    poll().then(schedule);
    // background = zero network; instant catch-up poll on resume
    const sub = AppState.addEventListener("change", (s) => {
      if (!aliveRef.current) return;
      if (s === "active") {
        poll().then(schedule);
      } else if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    });
    return () => {
      aliveRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      sub.remove();
    };
  }, [userId, poll, schedule]);

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
      if (aliveRef.current && timerRef.current) schedule();
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
      refresh,
      setSlowMode,
    }),
    [friendRequests, invites, duoInvites, online, waiting, currentGame, refresh,
     setSlowMode],
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

export const useNotifications = () => useContext(NotificationsContext);
