# PRD — Belote Tunisienne

## Original Problem Statement
Build a mobile app: a card game called "Belote Tunisienne". Performant, attractive card animations. Players sit around a table with funny avatars (custom avatars to be sold later). Oriental design, simple & easy to understand. Prepare possibility to activate commercials. Account creation with Google and email+password. Ranking + ELO system. Play modes: online with random users, or private party (friend invites only in private party — contact adding enabled). Statistics overview.
Rules reference: /manuel_belote_tunisienne.md (uploaded artifact) — Tunisian belote: 32 cards, contracts 90-160, contre 320 / sur-contre 640 (out-of-turn), capot annoncé 500 / non annoncé 250 (uncontrable), règle du cassé (contract-5), rounding to 10 (1-4 down / 5-9 up), Belote-Rebelote +20, dix de der +10, strict coupe/monter à l'atout.

## User Choices
- Full real-time online multiplayer (WebSockets): matchmaking + private rooms, bots fill empty seats (~10s)
- Auth: Emergent-managed Google Auth + JWT email/password
- Ads: SKIPPED for now (prepare later)
- Languages: French + Arabic (toggle)
- Match types: short = 1000 pts, long = 2000 pts

## Architecture
- Backend: FastAPI + MongoDB (motor). Files: server.py (routes/auth/ws), game_logic.py (pure rules engine), bot_ai.py (heuristics), game_manager.py (live games hub, bots, turn timers 30s, matchmaking loop, in-memory rooms)
- Realtime: WebSocket /api/ws/game/{id}?token=... — server-authoritative personalized state + event batches
- Frontend: Expo Router (SDK 54), reanimated animations, custom i18n (FR/AR), design tokens in src/theme.ts (terracotta/sand/emerald oriental palette, Fredoka + Nunito local fonts)
- Avatars: 12 funny dicebear "big-smile" avatars (src/avatars.ts) — catalogue extensible for future paid avatars
- ELO: team-average Elo, K=32, history stored (last 50), floor 100

## User Personas
- Tunisian belote players wanting quick online games vs strangers/bots
- Friend groups organizing private tables with invitations
- Competitive players tracking ELO/rank/stats

## Implemented (2026-06)
- Full rules engine (verified with simulation + 22 pytest tests): bidding, out-of-turn contre/sur-contre/capot, cassé, rounding, belote-rebelote auto-announce, dix de der, capots, redeal on 4 passes
- Bots: bidding heuristics, contre/surcontre decisions, legal play heuristics; fill matchmaking + private rooms; auto-play for AFK humans (30s timer)
- Auth: JWT register/login + Emergent Google (web hash + mobile deep link flows), sessions in Mongo (7d, TTL index)
- Matchmaking (ELO-based, humans only): queue per match type; 4 players matched when pairwise ELO spread fits windows (±100, +50 every 5s); balanced teams (strongest+weakest vs middles); stale-poll purge (12s); live status with found players (avatars, count, elo_range). No bot fill online — bots only fill private rooms. "Play vs AI" mode planned later.
- Private rooms with 6-char codes, room invites, friends (search/request/accept/decline)
- Leaderboard (top 50 + my rank), stats (games/wins/winrate/contracts/belotes/capots/streak/points + ELO history chart)
- Screens: auth, tabs (home/leaderboard/friends/profile), matchmaking, room lobby, game table (animated trick area, hand fan, bidding panel, hand-end + match-end modals, quit confirm, reconnecting badge)
- i18n FR/AR complete, testIDs everywhere
- Test accounts in /app/memory/test_credentials.md (tester1/tester2@belote.tn / Belote123!)

## Backlog (prioritized)
- P0: none outstanding
- P1: "Jouer contre l'IA" mode (explicitly requested for later — solo game vs 3 bots, reuse create_game bot fill); Ads activation hooks (AdMob placeholders + toggle — needs native build); in-game emoji/quick-chat reactions; sound effects; spectator/rejoin polish (games are in-memory — lost on backend restart)
- P2: Paid avatar shop (catalogue is ready to extend); seasonal leaderboards; match history detail screen; RTL full mirroring for Arabic; Elo-based matchmaking buckets; push notifications for invites (only on user request)

## Known Notes
- Games live in memory: backend restart cancels running games (accepted MVP tradeoff)
- Google OAuth can't be E2E tested in preview; flow follows Emergent playbook exactly
- Ingress blocks non-browser User-Agents (403) — test scripts must send a UA header
