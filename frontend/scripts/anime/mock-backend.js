#!/usr/bin/env node
// LOCAL-ONLY mock backend for visual review of the anime redesign.
// It lets the web build of the app boot on the home screen WITHOUT touching
// the real backend, real accounts or production data. Nothing here ships:
// it is a dev script, never imported by the app.
//
//   node scripts/anime/mock-backend.js            (port 8787)
//   MOCK_CURRENT_GAME=0 node scripts/anime/mock-backend.js   (no "Partie en cours")
//
// All values below are FAKE demo data. See docs/ANIME_TESTING.md.
const http = require("http");

const PORT = Number(process.env.MOCK_PORT || 8787);
const WITH_GAME = process.env.MOCK_CURRENT_GAME !== "0";

const user = {
  user_id: "mock_user_1",
  email: "demo@example.test",
  username: "demo_joueur",
  avatar_id: process.env.MOCK_AVATAR || "av3",
  elo: 1063,
  elo_duo: 1000,
  games_played: 12,
  wins: 7,
  losses: 5,
  stats: {},
  elo_history: [],
  auth_provider: "mock",
};

const sync = () => ({
  online: 3,
  waiting: 0,
  h: "mock",
  data: {
    friend_requests: [],
    invites: [],
    duo_invites: [],
    current_game: WITH_GAME
      ? {
          game_id: "mock_game_1",
          match_type: "short",
          phase: "playing",
          hand_number: 1,
          match_scores: [0, 0],
          target: 500,
          my_team: 0,
        }
      : null,
  },
});

const log = [];

http
  .createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      return res.end();
    }
    const json = (code, body) => {
      res.writeHead(code, { "Content-Type": "application/json" });
      res.end(JSON.stringify(body));
    };
    log.push(`${req.method} ${url.pathname}`);
    if (url.pathname === "/__log") return json(200, log);
    if (url.pathname === "/api/auth/me") return json(200, user);
    if (url.pathname === "/api/auth/login" || url.pathname === "/api/auth/register") {
      return json(200, { token: "mock-token", user });
    }
    if (url.pathname === "/api/sync") return json(200, sync());
    if (req.method === "GET") return json(404, { detail: "mock_not_found" });
    return json(200, {});
  })
  .listen(PORT, "127.0.0.1", () => {
    console.log(`[anime mock backend] http://127.0.0.1:${PORT} (current game: ${WITH_GAME})`);
  });
