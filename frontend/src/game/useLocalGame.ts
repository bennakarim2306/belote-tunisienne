// Offline Solo vs AI: drives the local TypeScript engine (engine.ts + ai.ts)
// and exposes the exact same API as useGameSocket so the game UI is agnostic
// of whether it plays online (WebSocket) or fully offline (local state).
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useRef, useState } from "react";

import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/api";
import { botBiddingAction, botPlay, shouldSurcontre } from "./ai";
import { BeloteEngine, type EnginePlayerInfo } from "./engine";
import type { GameEvent, GameState } from "./useGameSocket";

const STORAGE_KEY = "local_solo_game";

const BOT_NAMES = [
  "Ammar", "Salah", "Hédi", "Mabrouk", "Fatma", "Zohra",
  "Baya", "Moncef", "Habib", "Naïma", "Mongi", "Aziza",
];
const AVATAR_IDS = Array.from({ length: 12 }, (_, i) => `av${i + 1}`);

export const isLocalGameId = (id?: string | null): boolean =>
  !!id && id.startsWith("local_");

export const newLocalGameId = (matchType: "short" | "long"): string =>
  `local_${matchType}_${Date.now().toString(36)}`;

export interface LocalGameSummary {
  game_id: string;
  match_scores: [number, number];
  my_team: number;
  target: number;
}

/** Saved offline game for the home "resume" pill (only for the same user). */
export async function getSavedLocalGame(userId: string): Promise<LocalGameSummary | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    if (saved.uid !== userId || !saved.doc || saved.doc.phase === "finished") return null;
    return {
      game_id: saved.id,
      match_scores: saved.doc.match_scores ?? [0, 0],
      my_team: 0,
      target: saved.doc.target ?? 1000,
    };
  } catch {
    return null;
  }
}

function makeBots(takenName: string): EnginePlayerInfo[] {
  const pool = BOT_NAMES.filter((n) => n !== takenName);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 3).map((name, i) => ({
    user_id: `bot_local_${i}`,
    username: name,
    avatar_id: AVATAR_IDS[Math.floor(Math.random() * AVATAR_IDS.length)],
    is_bot: true,
    elo: 1000,
  }));
}

function botMove(g: BeloteEngine, seat: number): GameEvent[] {
  if (g.phase === "bidding") {
    const act = botBiddingAction(g.hands[seat], g.current_bid, seat, g.bids);
    if (act.type === "bid") {
      try {
        return g.applyBid(seat, act.value!, act.suit!);
      } catch {
        return g.applyPass(seat);
      }
    }
    if (act.type === "contre") {
      try {
        return g.applyContre(seat);
      } catch {
        return g.applyPass(seat);
      }
    }
    return g.applyPass(seat);
  }
  return g.applyPlay(
    seat,
    botPlay(g.hands[seat], g.trick, g.trump!, seat, g.play_history,
      g.current_bid ? g.current_bid.seat % 2 : null, g.bids),
  );
}

const PLAY_ACTIONS = ["bid", "pass", "capot", "contre", "surcontre", "decline_surcontre", "play"];

export function useLocalGame(gameId: string | undefined) {
  const { user } = useAuth();
  const [state, setState] = useState<GameState | null>(null);
  const [events, setEvents] = useState<{ id: number; list: GameEvent[] }>({ id: 0, list: [] });
  const engineRef = useRef<BeloteEngine | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const eventIdRef = useRef(0);
  const activeRef = useRef(false);
  const telemetryRef = useRef(false);

  const persist = (g: BeloteEngine) => {
    if (g.phase === "finished") {
      AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
      // report the finished offline match for admin statistics (best effort)
      if (!telemetryRef.current) {
        telemetryRef.current = true;
        api.post("/telemetry/offline-match", {
          match_type: g.match_type,
          won: g.winner_team === 0, // human is always seat 0 / team 0
          hands_played: g.hand_number,
        }).catch(() => {});
      }
      return;
    }
    AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ id: g.game_id, uid: user?.user_id, doc: g.toDoc() }),
    ).catch(() => {});
  };

  const commit = (evts: GameEvent[]) => {
    const g = engineRef.current;
    if (!g || !activeRef.current) return;
    setState(g.stateFor(0));
    if (evts.length) {
      eventIdRef.current += 1;
      setEvents({ id: eventIdRef.current, list: evts });
    }
    persist(g);
    scheduleAuto();
  };

  const advanceHandEnd = () => {
    const g = engineRef.current;
    if (!g || g.phase !== "hand_end") return;
    if (g.match_over) {
      g.phase = "finished";
      g.version += 1;
      commit([{ e: "match_end", winner_team: g.winner_team ?? undefined }]);
    } else {
      commit(g.nextHand());
    }
  };

  // mirrors the backend auto-driver (game_runtime._auto) for bots and timers
  const scheduleAuto = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const g = engineRef.current;
    if (!g || g.phase === "finished" || !activeRef.current) return;
    const nowS = Date.now() / 1000;
    const run = (delayS: number, fn: () => void) => {
      timerRef.current = setTimeout(fn, Math.max(50, delayS * 1000));
    };

    if (g.paused) {
      run(Math.max(0.5, g.paused.until - nowS), () => {
        const gg = engineRef.current;
        if (!gg?.paused) return;
        try {
          commit(gg.resume(null));
        } catch {}
      });
      return;
    }

    if (g.phase === "hand_end") {
      run(Math.max(0.5, g.turn_deadline - nowS), advanceHandEnd);
      return;
    }

    if (g.phase === "surcontre") {
      const holder = g.current_bid!.seat;
      if (g.players[holder].is_bot) {
        // bot contract holder decides quickly
        run(1.5 + Math.random(), () => {
          const gg = engineRef.current;
          if (!gg || gg.phase !== "surcontre") return;
          try {
            const evts = shouldSurcontre(gg.hands[holder], gg.current_bid!.suit)
              ? gg.applySurcontre(holder)
              : gg.applyDeclineSurcontre(holder);
            commit(evts);
          } catch {}
        });
      } else {
        // human contract holder: 5s reaction window, then the contre is
        // ignored automatically
        run(Math.max(0.5, g.turn_deadline - nowS), () => {
          const gg = engineRef.current;
          if (!gg || gg.phase !== "surcontre") return;
          try {
            commit(gg.applyDeclineSurcontre(holder));
          } catch {}
        });
      }
      return;
    }

    if (g.phase !== "bidding" && g.phase !== "playing") return;
    const actor = g.turn;
    if (actor === null) return;
    // last trick: nobody has a choice (1 card each) — throw automatically,
    // one card per second, in play order (humans included)
    const lastTrickAuto = g.phase === "playing" && g.hands[actor].length === 1;
    if (!lastTrickAuto && !g.players[actor].is_bot) return; // untimed human turn
    const pause = Math.max(0, g.pause_until - nowS);
    const delay = lastTrickAuto ? pause + 1 : pause + 1 + Math.random();
    run(delay, () => {
      const gg = engineRef.current;
      if (!gg || (gg.phase !== "bidding" && gg.phase !== "playing") || gg.turn !== actor) return;
      try {
        commit(botMove(gg, actor));
      } catch {}
    });
  };

  useEffect(() => {
    if (!gameId || !user) return;
    activeRef.current = true;
    setState(null);
    setEvents({ id: 0, list: [] });
    let cancelled = false;
    (async () => {
      let engine: BeloteEngine | null = null;
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const saved = JSON.parse(raw);
          if (saved.id === gameId && saved.uid === user.user_id && saved.doc?.phase !== "finished") {
            engine = BeloteEngine.fromDoc(saved.doc);
          }
        }
      } catch {}
      if (cancelled) return;
      if (!engine) {
        const matchType = gameId.split("_")[1] === "long" ? "long" : "short";
        const me: EnginePlayerInfo = {
          user_id: user.user_id,
          username: user.username,
          avatar_id: user.avatar_id,
          is_bot: false,
          elo: user.elo,
        };
        engine = new BeloteEngine(gameId, [me, ...makeBots(user.username)], matchType, null);
        engine.host_user_id = user.user_id;
        engine.origin = "solo";
      }
      engineRef.current = engine;
      commit([]);
    })();
    return () => {
      cancelled = true;
      activeRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, user?.user_id]);

  const send = (msg: Record<string, unknown>) => {
    const g = engineRef.current;
    if (!g) return;
    const action = String(msg.action ?? "");
    try {
      if (g.paused && PLAY_ACTIONS.includes(action)) return;
      switch (action) {
        case "bid":
          commit(g.applyBid(0, Number(msg.value ?? 0), String(msg.suit)));
          break;
        case "pass":
          commit(g.applyPass(0));
          break;
        case "capot":
          commit(g.applyCapot(0, String(msg.suit)));
          break;
        case "contre":
          commit(g.applyContre(0));
          break;
        case "surcontre":
          commit(g.applySurcontre(0));
          break;
        case "decline_surcontre":
          commit(g.applyDeclineSurcontre(0));
          break;
        case "play":
          commit(g.applyPlay(0, String(msg.card)));
          break;
        case "ready":
          commit(g.applyReady(0));
          // I'm the only human at the table: advance immediately
          if (g.phase === "hand_end") advanceHandEnd();
          break;
        case "chat":
          commit([{ e: "chat", seat: 0, kind: String(msg.kind), msg: String(msg.value) }]);
          break;
        case "pause_request":
          commit(g.requestPause(0, []));
          break;
        case "resume":
          commit(g.resume(0));
          break;
        case "leave":
          // pause the offline match: stop the loop but KEEP the saved game
          // so the player can resume it from the Home screen (resume pill)
          activeRef.current = false;
          if (timerRef.current) clearTimeout(timerRef.current);
          break;
        default:
          break;
      }
    } catch {
      // invalid action (out of turn, illegal move, ...): ignore, like the server
    }
  };

  const leave = () => send({ action: "leave" });

  return {
    state,
    events,
    connected: true,
    fatalError: null as string | null,
    send,
    leave,
  };
}
