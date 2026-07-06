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
- Solo "Jouer contre l'IA": POST /api/solo → instant game vs 3 bots, UNRANKED (no ELO/stats impact, match stored with ranked:false), "Entraînement" badge on home card
- Change pack (2026-06): bid values as full 2x4 grid (90-160 always visible); configurable turn timer (online 30s, solo untimed, private rooms toggle at creation — default OFF, turn_timer in POST /api/rooms, state.turn_timeout); CLOCKWISE play direction on screen (me→left→top→right); out-of-turn capot floating button with suit picker; "Contré"/"Sur-contré" wording (no ×2/×4); last-trick viewer modal available anytime during play; suit color visibility fixed (red ♥♦ in bubbles, light-red on dark chips)
- Animations upgrade (2026-06): DealAnimation overlay — 32 card backs fly from a center deck to each seat in deal order at every new hand (bidding UI hidden while dealing, hand fan staggered to match); trick collection rebuilt — cards gather into a center stack then fly together toward the winner with a floating "+N points" gold pill (TrickArea progress-driven, 1s)
- Animations VERIFIED E2E (2026-06, fork session): full solo game played via Playwright — deal overlay renders, bidding works after deal, card play works, trick-collection gather+fly+points pill captured mid-flight. HandFan stagger re-timed (delay 420 + i*230ms) so the hand fills card-by-card in sync with the ~2.4s deal overlay.
- Improvement pack (2026-06, fork session): (1) contract holder visible — gold ribbon bubble on taker's seat during play + username in header contract chip; (2) hand-end screen — per-player "Continuer" button (WS action ready), next hand when all humans ready or 120s (10s if match over); (3) pause system — pause_request/accept/decline/resume WS actions, humans-only accept list, 3 min max auto-resume, requester-only manual resume, timers frozen (remaining restored); (4) turn countdown pill on the active player's seat visible to everyone (timed games); (5) announced capot broken by a defender trick ends the hand instantly (500 defense); (6) rejoin — quitting keeps the seat (bot substitutes), GET /api/games/current + home "Partie en cours — Reprendre" banner, WS reconnect clears left flag; (7) bidding bug fixed — stale selected value below the new minimum (after partner raise) cleared automatically; (8) in-game score history — tap header score → hand-by-hand modal (hand_history in state). Backend 7/7 new tests + 36/36 old suite; frontend flows verified by testing agent.
- Improvement pack 2 (2026-06, fork session): (1) reliable reconnection — verified E2E (quit → home banner → rejoin reclaims seat), abandon window 10 min; (2) network-drop auto-pause — abrupt disconnect (4s grace) pauses game with reason shown to others ("X a perdu la connexion", wifi overlay), auto-resume on reconnect, bot substitutes after 2 min offline; (3) notifications — GET /api/notifications, bell icon + badge on home opening a panel (friend requests accept/decline + invites join/dismiss), tab bar badges (Accueil=invites, Amis=friend requests); (4) creator ends game for everyone (private + solo): host leave → game_cancelled + cancelled overlay "Le créateur a mis fin à la partie", host warning in quit dialog, no ELO; (5) room seats — fixed seats[4] model, tap free seat to move (host gets sit/invite-here modal), host invites can reserve a specific seat honored on join, bots fill empty seats preserving positions. Tested: testing agent 6/6 backend + UI smoke, plus 2-browser E2E (rejoin banner, host cancel overlay).
- Complete design overhaul (2026-06, fork session): "Midnight Tunisian Café × E-sport" dark gaming theme — deep espresso surfaces (#120F0D/#1C1714), electric mint (#00E57A) glowing CTAs, lantern copper (#FF7B00), terracotta (#C23B22), gold (#FFB800). Fonts: Space Grotesk (display/metrics) + Plus Jakarta Sans (body) loaded via expo-font local TTFs. Guidelines in /app/design_guidelines.json (mobile_design_agent). Token names kept in src/theme.ts (dark remap), glow() helper, dark card backs (espresso + copper border + mint inner), pulsing mint glow hero card on home, dark bidding panel, gold contract chips/badges, dark modals/sheets. Full frontend regression GREEN (iteration_7), WCAG AA contrast verified.
- Private rooms with 6-char codes, room invites, friends (search/request/accept/decline)
- Leaderboard (top 50 + my rank), stats (games/wins/winrate/contracts/belotes/capots/streak/points + ELO history chart)
- Screens: auth, tabs (home/leaderboard/friends/profile), matchmaking, room lobby, game table (animated trick area, hand fan, bidding panel, hand-end + match-end modals, quit confirm, reconnecting badge)
- i18n FR/AR complete, testIDs everywhere
- Test accounts in /app/memory/test_credentials.md (tester1/tester2@belote.tn / Belote123!)

## Backlog (prioritized)
- P0: none outstanding
- P1: Ads activation hooks (AdMob placeholders + toggle — needs native build); in-game emoji/quick-chat reactions; sound effects; spectator/rejoin polish (games are in-memory — lost on backend restart)
- P2: Paid avatar shop (catalogue is ready to extend); seasonal leaderboards; match history detail screen; RTL full mirroring for Arabic; Elo-based matchmaking buckets; push notifications for invites (only on user request)

## Known Notes
- Games live in memory: backend restart cancels running games (accepted MVP tradeoff)
- Google OAuth can't be E2E tested in preview; flow follows Emergent playbook exactly
- Ingress blocks non-browser User-Agents (403) — test scripts must send a UA header
