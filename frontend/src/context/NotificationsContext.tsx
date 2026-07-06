import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

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

interface NotifValue {
  friendRequests: FriendRequestNotif[];
  invites: InviteNotif[];
  duoInvites: DuoInviteNotif[];
  refresh: () => Promise<void>;
}

const NotificationsContext = createContext<NotifValue>({
  friendRequests: [],
  invites: [],
  duoInvites: [],
  refresh: async () => {},
});

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.user_id ?? null;
  const [friendRequests, setFriendRequests] = useState<FriendRequestNotif[]>([]);
  const [invites, setInvites] = useState<InviteNotif[]>([]);
  const [duoInvites, setDuoInvites] = useState<DuoInviteNotif[]>([]);

  const refresh = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await api.get("/notifications");
      setFriendRequests(res.friend_requests ?? []);
      setInvites(res.invites ?? []);
      setDuoInvites(res.duo_invites ?? []);
    } catch {}
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setFriendRequests([]);
      setInvites([]);
      setDuoInvites([]);
      return;
    }
    refresh();
    const iv = setInterval(refresh, 8000);
    return () => clearInterval(iv);
  }, [userId, refresh]);

  const value = useMemo(
    () => ({ friendRequests, invites, duoInvites, refresh }),
    [friendRequests, invites, duoInvites, refresh],
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

export const useNotifications = () => useContext(NotificationsContext);
