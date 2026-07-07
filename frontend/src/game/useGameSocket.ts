import { useCallback, useEffect, useRef, useState } from "react";

import { wsUrl } from "@/src/api";
import { useAuth } from "@/src/context/AuthContext";

export interface GamePlayer {
  seat: number;
  user_id: string;
  username: string;
  avatar_id: string;
  is_bot: boolean;
  elo: number;
  card_count: number;
}

export interface TrickCard {
  seat: number;
  card: string;
}

export interface Contract {
  seat: number;
  team: number;
  value: number | null;
  suit: string;
  capot: boolean;
  contre: boolean;
  surcontre: boolean;
}

export interface HandResult {
  contract: Contract;
  success: boolean;
  raw_points: [number, number];
  belote_team: number | null;
  capot_team: number | null;
  hand_scores: [number, number];
  match_scores: [number, number];
  match_over: boolean;
  winner_team: number | null;
}

export interface BidEntry {
  seat: number;
  type: string;
  value?: number;
  suit?: string;
}

export interface HandHistoryEntry {
  hand_number: number;
  contract: Contract;
  success: boolean;
  hand_scores: [number, number];
  match_scores: [number, number];
}

export interface GameState {
  game_id: string;
  phase: "bidding" | "surcontre" | "playing" | "hand_end" | "finished";
  hand_number: number;
  dealer: number;
  turn: number | null;
  players: GamePlayer[];
  my_seat: number;
  hand: string[];
  legal: string[];
  trick: TrickCard[];
  last_trick: { winner_seat: number; cards: TrickCard[]; points: number } | null;
  trump: string | null;
  contract: Contract | null;
  bids: BidEntry[];
  match_scores: [number, number];
  target: number;
  match_type: string;
  trick_counts: [number, number];
  tricks_played: number;
  can_contre: boolean;
  can_surcontre: boolean;
  belote: { seat: number; played: number } | null;
  hand_result: HandResult | null;
  ready_seats: number[];
  hand_history: HandHistoryEntry[];
  pause_req: { seat: number; required: number[]; accepts: number[] } | null;
  paused: { seat: number; until: number; reason?: "request" | "disconnect" } | null;
  match_over: boolean;
  winner_team: number | null;
  cancelled: boolean;
  host_user_id: string | null;
  origin: "online" | "solo" | "private";
  turn_deadline: number;
  turn_timeout: number | null;
  elo_changes: Record<string, number> | null;
  coach_mode?: boolean;
  coach?: CoachHint;
}

export interface CoachHint {
  kind: "bid" | "play";
  reason: string;
  action?: "bid" | "contre" | "pass";
  value?: number;
  suit?: string;
  card?: string;
  n?: number;
  prev?: number;
  need?: number;
  need_belote?: number;
}

export interface GameEvent {
  e: string;
  seat?: number;
  card?: string;
  value?: number;
  kind?: string;
  msg?: string;
  suit?: string;
  word?: string;
  winner_seat?: number;
  winner_team?: number;
  trump?: string;
  requester?: number;
}

interface EventBatch {
  id: number;
  list: GameEvent[];
}

export function useGameSocket(gameId: string | undefined) {
  const { token } = useAuth();
  const [state, setState] = useState<GameState | null>(null);
  const [events, setEvents] = useState<EventBatch>({ id: 0, list: [] });
  const [connected, setConnected] = useState(false);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const closedRef = useRef(false);
  const attemptsRef = useRef(0);
  const eventIdRef = useRef(0);

  const connect = useCallback(() => {
    if (!gameId || !token || closedRef.current) return;
    const url = wsUrl(`/api/ws/game/${gameId}?token=${encodeURIComponent(token)}`);
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      attemptsRef.current = 0;
      setConnected(true);
    };
    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data as string);
        if (msg.type === "update") {
          setState(msg.state);
          if (msg.events?.length) {
            eventIdRef.current += 1;
            setEvents({ id: eventIdRef.current, list: msg.events });
          }
        } else if (msg.type === "error" && msg.message === "game_not_found") {
          setFatalError("game_not_found");
          closedRef.current = true;
          ws.close();
        }
      } catch {}
    };
    ws.onclose = () => {
      setConnected(false);
      wsRef.current = null;
      if (closedRef.current) return;
      attemptsRef.current += 1;
      if (attemptsRef.current > 10) {
        setFatalError("connection_lost");
        return;
      }
      setTimeout(connect, Math.min(1000 * attemptsRef.current, 5000));
    };
    ws.onerror = () => {
      try {
        ws.close();
      } catch {}
    };
  }, [gameId, token]);

  useEffect(() => {
    closedRef.current = false;
    attemptsRef.current = 0;
    connect();
    const ping = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ action: "ping" }));
      }
    }, 25000);
    return () => {
      closedRef.current = true;
      clearInterval(ping);
      try {
        wsRef.current?.close();
      } catch {}
    };
  }, [connect]);

  const send = useCallback((msg: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const leave = useCallback(() => {
    send({ action: "leave" });
    closedRef.current = true;
    try {
      wsRef.current?.close();
    } catch {}
  }, [send]);

  return { state, events, connected, fatalError, send, leave };
}
