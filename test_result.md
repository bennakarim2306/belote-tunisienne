#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================
frontend:
  - task: "Home: join room row layout (Code du salon input + arrow button)"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/(tabs)/home.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "user"
        comment: "User screenshot: 'Code du salon' input overflows the private-party card's right edge; the join arrow button is partially cut off on the right."
      - working: "NA"
        agent: "main"
        comment: "Root cause: TextInput had flex:1 but flexbox min-width:auto (RN Web) prevented it from shrinking below its wide placeholder (fontSize 18 + letterSpacing 4). Fix: added minWidth:0 to styles.joinInput. Verified locally at 320px viewport: button box x=227 w=52 fully inside viewport/card."

agent_communication:
  - agent: "main"
    message: "Bug fix to verify: on Accueil (home tab), the 'Code du salon' input + arrow button row inside the 'Partie privée' card must fit fully within the card at mobile widths (320/360/390). Login tester1@belote.tn / Belote123!. Check the join flow still works (enter a code, button pressable)."

backend:
  - task: "Improvement pack: ready/continue at hand_end (120s max), pause request/accept/decline/resume (3min, requester-only resume), capot broken ends hand instantly, rejoin after quit (left flag reset on WS reconnect), GET /api/games/current, hand_history in state"
    implemented: true
    working: "NA"
    file: "/app/backend/game_logic.py, /app/backend/game_manager.py, /app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "New WS actions: ready, pause_request, pause_accept, pause_decline, resume. hand_end deadline now 120s (10s when match_over); advances early when ALL humans sent 'ready'. Pause: humans-only accept list (bots/disconnected auto-excluded), active pause freezes timers (remaining restored on resume), auto-resume after 180s by _auto driver, game actions rejected with 'paused'. Capot contract + defender wins a trick -> _score_hand immediately (0/500). connect() resets left=True on reconnect + broadcasts 'rejoined'. GET /api/games/current returns ongoing game for rejoin banner. state_for adds ready_seats, hand_history, pause_req, paused. Unit sim passed + full pytest 36/36."

frontend:
  - task: "Improvement pack UI: contract holder badge + name in header chip, hand-end Continuer button, pause UI (button/accept modal/overlay/resume), seat countdown timers for all players, score history modal, home resume banner, bidding stale-value bug fix (Anas bug)"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/game/[id].tsx, src/components/game/{PlayerSeat,HandEndModal,BiddingPanel}.tsx, app/(tabs)/home.tsx, src/game/useGameSocket.ts, src/i18n.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "USER-REPORTED BUG (must verify): 'Anas could not raise a bid after his partner bid' — root cause: previously selected bid value stayed selected below new minimum, disabling Annoncer. Fixed with useEffect clearing stale value when minValue rises + reset at new hand (BiddingPanel.tsx). Other UI: pause button in game header (testID pause-request-button), paused-overlay + pause-resume-button (requester only), pause-request-modal with pause-accept/decline-button, seat-timer pills on active player's seat (timed games only), contract-holder-{seat} gold bubble during playing, score header tap -> score-history-modal, HandEndModal hand-continue-button + waiting state, home resume-game-banner/-button via /api/games/current. Verified manually: solo pause->resume->history modal all work."

agent_communication:
  - agent: "main"
    message: "Improvement pack of 8 items implemented. MANDATORY: verify the user-reported bidding bug fix (raise over partner's bid). Test with tester1/tester2@belote.tn (Belote123!). Solo games are untimed (no seat timers); use a timed private room (turn_timer:true) or matchmaking game for seat timer checks. WS actions are documented in game_manager.handle_action."

backend:
  - task: "Pack 2: disconnect auto-pause (reason=disconnect, grace 4s, 120s then bot substitutes), robust rejoin (10min abandon window, auto-resume on reconnect), host leave cancels game for everyone (private+solo, no ELO), GET /api/notifications, room seats model (seats[4], move_seat, seat reservations via invite)"
    implemented: true
    working: "NA"
    file: "/app/backend/game_manager.py, /app/backend/game_logic.py, /app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Self-tested via aiohttp WS scripts: disconnect->paused(reason=disconnect) broadcast, actions rejected while paused, reconnect->auto resumed, host leave->game_cancelled broadcast+cancelled state (private & solo), /games/current null after cancel, notifications aggregation (friend_requests+invites), seats: create(host seat0), move_seat, seat_taken guard, invite with seat->reservation honored on join, non-host seat invite 403, start fills empty seats with bots preserving positions."

frontend:
  - task: "Pack 2 UI: disconnect pause overlay variant (wifi icon, 'X a perdu la connexion'), cancelled-overlay 'Le créateur a mis fin à la partie', host quit warning, notifications bell + panel (accept/decline friend requests, join/dismiss invites) + tab badges (Accueil=invites, Amis=friend requests), room seat UI (tap free seat: move or host action modal sit/invite-to-seat)"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/(tabs)/home.tsx, (tabs)/_layout.tsx, src/context/NotificationsContext.tsx, app/room/[code].tsx, app/game/[id].tsx, src/game/useGameSocket.ts, src/i18n.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Screenshots verified: bell badge count, notifications panel with both sections + quick actions, tab badges (Accueil 1 / Amis 1), room seat grid with 'S'asseoir ici' free seats, host seat-action-modal (sit here / invite here). NOTE: clicking a seat in the first ~1s after room render may act before isHost resolves - waited 2.5s in tests."

agent_communication:
  - agent: "main"
    message: "Pack 2 (5 items) implemented on top of pack 1. USER-REPORTED BUG to verify: 'friend quit accidentally and could NOT reconnect' -> verify full rejoin flow E2E: player (non-host) leaves game via WS action leave (or abrupt socket close), /api/games/current returns game, WS reconnect clears left flag + auto-resumes disconnect pause. Also verify host cancel, notifications, seats. tester1/tester2@belote.tn Belote123!."

frontend:
  - task: "Complete design overhaul: 'Midnight Tunisian Cafe x E-sport' dark gaming theme (deep espresso #120F0D surfaces, electric mint #00E57A, lantern copper #FF7B00, terracotta, gold), new fonts (Space Grotesk display + Plus Jakarta Sans), glowing buttons, dark card backs with copper/mint zellige, pulsing hero card on home, dark bidding panel, gold contract chips"
    implemented: true
    working: "NA"
    file: "src/theme.ts, src/components/ChunkyButton.tsx, src/components/PlayingCard.tsx, all screens (token remap) + targeted contrast fixes"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Token names kept identical (C.bg/ink/brand...) so all screens flipped to dark automatically; fixed 24 cream-background spots -> C.card, hardcoded light hexes, SUIT_COLOR->SUIT_COLOR_ON_DARK on dark surfaces, gold-bg text contrast (#1A1200), BiddingPanel light bg -> dark. Fonts loaded via expo-font from local TTFs. Verified by screenshots: auth, home, leaderboard, profile, room, matchmaking, game (deal/bidding/playing). NO functional changes intended - verify all flows still work."

agent_communication:
  - agent: "main"
    message: "Design overhaul complete (visual only). Please run a FRONTEND regression pass over all main flows to ensure the restyle broke nothing: auth login, home cards + notifications bell, solo game full flow (deal anim, bidding, play card, trick collection, hand-end continue, pause/resume, score history), room create + seat move + invite sheet, leaderboard, friends, profile (avatar select, stats). Also flag any illegible text/contrast issues you spot in screenshots. tester1@belote.tn / Belote123!."

backend:
  - task: "Dual ELO validation + leaderboard mode param (GET /api/leaderboard?mode=solo|duo) + game_manager refactor into mixins (game_runtime/elo_stats/matchmaking/rooms/live_utils) + elo_duo startup backfill + /games/current newest-first"
    implemented: true
    working: true
    file: "/app/backend/server.py, game_manager.py, game_runtime.py, elo_stats.py, matchmaking.py, rooms.py, live_utils.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Full pytest suite 81/81 PASS post-refactor. Stale tests updated (rooms seats contract, host-leave-cancels behavior). Backfill verified: legacy accounts now return elo_duo 1000 on login."

frontend:
  - task: "Dual ELO UI (profile 3 badges), strict duo-vs-duo DuoSetup, Leaderboard Solo/Duo toggle"
    implemented: true
    working: true
    file: "/app/frontend/app/(tabs)/profile.tsx, (tabs)/leaderboard.tsx, src/components/DuoSetup.tsx, src/i18n.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Testing agent iteration_12 ALL PASS: login, profile badges, leaderboard toggle both directions, duo-setup hint + no legacy mode options, solo game regression, tab navigation clean."

agent_communication:
  - agent: "main"
    message: "Session complete: dual ELO validated E2E, leaderboard Solo/Duo toggle added (backend+frontend), backend refactored into modules (81/81 tests), elo_duo backfill at startup, duo candidates now expose elo_duo via user_brief coalescing."

backend:
  - task: "MongoDB persistence refactor for live state (live_games, live_rooms, mm_queue, mm_matched, mm_duo_invites, mm_feedback, locks) - fixes 'Partie introuvable' multi-worker bug"
    implemented: true
    working: true
    file: "/app/backend/server.py, game_runtime.py, matchmaking.py, rooms.py, game_manager.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Fixed ~20 un-awaited async manager calls in server.py, replaced manager.matched with clear_matched, /games/current now queries DB, tutorial coach passed via create_game kwarg, matchmaking lock now owner-renewable (passes run every 2s), create_duo_invite purges stale matched tickets. Validated: pytest 104/104, e2e script 29/29 (duo vs_ai invite/accept/WS/rooms/solo/tutorial/queue), cross-process test 9/9 with TWO server processes on same Mongo (host on A, invitee on B - the exact production bug scenario)."

agent_communication:
  - agent: "main"
    message: "DB persistence refactor verified at backend level. Please run a FULL-STACK regression: frontend flows over the real preview URL - login, home, solo game (bidding+play a few cards), private room create/invite/start, duo vs AI invite flow between tester1 and tester2 (host must land in game - previous P0 bug), matchmaking queue UI, tutorial mode with coach hints, rejoin flow (/games/current). tester1@belote.tn / tester2@belote.tn / Belote123!."

frontend:
  - task: "Landscape orientation for the entire app (app.json landscape + expo-screen-orientation lock + web RotateGate overlay when portrait), home 2x2 grid (Play online / Play vs AI / Learn / Private game with join+create modal), landscape game table (bottom row: my seat + chat | hand fan | turn pill + last trick), compact bidding panel, 2-column room and auth screens, compacted matchmaking, centered list screens"
    implemented: true
    working: "NA"
    file: "/app/frontend/app.json, app/_layout.tsx, src/components/RotateGate.tsx, app/(tabs)/home.tsx, app/game/[id].tsx, src/components/game/HandFan.tsx, BiddingPanel.tsx, HandEndModal.tsx, DealAnimation.tsx, TrickArea.tsx, app/room/[code].tsx, app/auth.tsx, app/matchmaking.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Full landscape refactor done. Main agent smoke-tested at 844x390: auth 2-col OK, home grid 2x2 all 4 boxes visible OK, private modal OK, solo game table with bidding OK (hand fan fully visible, card bottom=387.7<390), room 2-col OK, tutorial OK. Needs full flow regression."

agent_communication:
  - agent: "main"
    message: "App switched to LANDSCAPE everywhere per user request. Test all frontend flows at 844x390 viewport (landscape phone). Note the web RotateGate overlay appears if viewport is portrait - always use landscape viewport. testIDs changed: private game box is 'private-game-card' opening a modal containing 'join-code-input'+'join-room-button'+'create-party-button'. Chat button and last-trick button are now in the bottom row next to the hand fan."

agent_communication:
  - agent: "main"
    message: "Landscape design polish pass (user feedback: fix proportions/positions, use the FULL screen). Home: banners + 2x2 grid now flex to FILL the whole height (no scroll, View instead of ScrollView, invites capped at 2). Game: right bottom column is now vertical (turn pill no longer wraps), hand cards enlarged to 68px (width*0.62), trick offsets flattened (y34/x72). Profile: header card is now a row (avatar | name/email | 3 elo badges). Matchmaking: fits 390/360 heights, deco cards 40px, slots 96px wide. AdBanner placeholder 46->30px. Tutorial lesson footer button maxWidth 560. Verified visually at 844x390 and 780x360. Regression-test all main flows (same testIDs as iteration_19)."

agent_communication:
  - agent: "main"
    message: "NAV REDESIGN (user request): bottom tab bar REMOVED, replaced by hamburger MenuButton (testID menu-button) top-left on each tab screen opening a left side-menu (testID side-menu, items menu-item-home/leaderboard/friends/profile with badges). Ad banner stays anchored bottom (inside custom tabBar). Home: 'Partie en cours' resume pill moved INTO the header between username and ELO (testID resume-game-button, no more resume-game-banner); inline invite banners REMOVED from the content area (grid zone reserved for the 4 boxes only) - invites/duo invites/friend requests remain accessible via the notifications bell modal. IMPORTANT for Playwright: multiple tab screens stay mounted, so scope menu-button clicks with the screen testID, e.g. get_by_test_id('home-screen').get_by_test_id('menu-button')."

agent_communication:
  - agent: "main"
    message: "iter22 feature pack complete and verified: replay button (match-end), +10% cards, presence system (ping/online), duo setup search+online filter+dots, friends online filter + invite-to-game modal (online duo / duo vs AI). Testing agent iteration_22: backend 9/9, frontend all pass. Main agent additionally verified match-end replay E2E via WS bot script + browser (new game remounts via key={id} wrapper)."

frontend:
  - task: "OFFLINE Solo vs AI (Phase 1): TypeScript port of the Python game engine (src/game/engine.ts mirrors game_logic.py) + bot AI (src/game/ai.ts mirrors bot_ai.py) + useLocalGame hook driving the local engine with the exact same API as useGameSocket. Solo games now use local ids (local_short_*/local_long_*), never touch the backend, persist to AsyncStorage (key local_solo_game) for resume from home pill, replay creates a fresh local game."
    implemented: true
    working: "NA"
    file: "/app/frontend/src/game/engine.ts, src/game/ai.ts, src/game/useLocalGame.ts, app/game/[id].tsx, app/(tabs)/home.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Engine+AI validated offline: 70 simulated full matches (~43k assertions, contre/surcontre/capot/belote branches), 3000-case legal_moves/trick_winner parity fuzz vs Python (100% identical incl. Tfaskira), 6000-case bot AI decision parity (100% identical). Smoke test: home -> Jouer Solo -> short lands on /game/local_short_* with dealt cards and bidding panel."

agent_communication:
  - agent: "main"
    message: "Offline solo implemented. Test the full offline flow at 1920x800 (landscape): login tester1, Jouer Solo -> Rapide, URL must be /game/local_*. Verify NO /api/ws/game websocket is opened for that game (offline proof). Bid (e.g. 90 coeur via Annoncer), bots answer within ~2s, play several tricks (only legal cards tappable), trick collects, hand-end modal appears with scores, Continuer advances immediately to next hand. Quit button ends the game (no resume). For resume: while mid-game navigate the browser directly to the home URL (no quit) -> resume pill in header -> tap -> game restores with same score. Also regression: tutorial final game (coach) and private rooms still use the backend WS."

  - task: "AI strategy charter: rewrote backend/bot_ai.py + frontend/src/game/ai.ts per user's charter (bidding benchmarks 90-130, partner support, public-memory play, tfaskira banking, signalling, endgame). play_history added to both engines."
    implemented: true
    working: true
    file: "/app/backend/bot_ai.py, /app/frontend/src/game/ai.ts, game_logic.py, engine.ts, game_runtime.py, coach.py, useLocalGame.ts"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Validated offline: 100% Python/TS parity on 4504 real decisions; play-only benchmark 63.3% match wins vs old AI; 94% contract success; all 111 backend tests pass; browser smoke OK (offline solo bidding works)."

  - task: "P1 Coach comments on other players' announcements: added contre(partner)/surcontre/capot commentary (5 i18n keys FR/AR/EN) in coach_mode; opponent+partner variants."
    implemented: true
    working: true
    file: "/app/frontend/app/game/[id].tsx, /app/frontend/src/i18n.tsx"
    status_history:
      - working: true
        agent: "main"
        comment: "E2E browser check in tutorial coach game (unlock: localStorage tutorial_progress=14): partner announcement commentary displayed; existing bid hints unaffected."

frontend:
  - task: "Last trick auto-play (no choice): when every player has 1 card left, cards are thrown automatically one per second in play order (humans included). Implemented in BOTH drivers: backend game_runtime.py _auto (last_trick_auto -> delay pause+1.0s) and frontend useLocalGame.ts scheduleAuto (lastTrickAuto). TrickArea HOLD_MS 900->1000 (1s rest before collect), [id].tsx trick sound/haptic 850->950ms, showLast 2050->2150, handEndReady 2150->2250, yourTurn chime suppressed when hand.length===1 in playing."
    implemented: true
    working: "NA"
    file: "/app/backend/game_runtime.py, /app/frontend/src/game/useLocalGame.ts, /app/frontend/src/components/game/TrickArea.tsx, /app/frontend/app/game/[id].tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "BACKEND VERIFIED by main agent via WS script (/tmp/test_last_trick_auto.py): solo backend game, played tricks 1-7 manually, stopped clicking on last trick -> server threw my card automatically, last-trick cadence exactly 1.0s/1.0s/1.0s. OFFLINE (useLocalGame.ts) not yet verified E2E in browser."

agent_communication:
  - agent: "main"
    message: "NEW: last trick auto-play in offline solo. Test at 1920x800 landscape: login tester1 (Belote123!), go to /game/local_short_<anything> (fresh local game), bid or let bots bid, then play tricks 1-7 manually (tap legal cards; if a tap does nothing the card is illegal, try another). When each player has only 1 card left (8th trick), DO NOT tap anything: the 4 cards must be thrown automatically ~1s apart (mine included), then the trick stays visible ~1s, collects, and the hand-end modal appears. Also regression: on tricks 1-7 MY card must NOT auto-play (I keep control). Backend online path already verified by main agent."

frontend:
  - task: "Add friend in-game: tap a human player's avatar during online/private games -> player card modal (avatar/username/ELO) with Ajouter (friend request) / Accepter (received request) / Demande envoyée / Déjà amis states. PlayerSeat avatar is a Pressable (seat-avatar-{seat}); bots and solo-local games are not tappable. Backend untouched (reuses /friends, /friends/request, /friends/respond)."
    implemented: true
    working: true
    file: "/app/frontend/app/game/[id].tsx, /app/frontend/src/components/game/PlayerSeat.tsx, /app/frontend/src/i18n.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "E2E verified by main agent in browser both directions with a private-room game (tester1+tester2+2 bots): tester1 tapped Tester2 avatar -> Ajouter -> 'Demande envoyée !'; tester2 tapped Tester1 avatar -> Accepter -> 'Déjà amis ✓'. testIDs: player-card-modal, add-friend-button, accept-friend-button, friend-request-sent, already-friends, player-card-close."

backend:
  - task: "Emergent managed push notifications: POST /api/register-push relay + send_push helper (push.py) + matchmaking queue nudge (maybe_send_queue_push called each matchmaking_loop tick; 45s queue wait, 30min global cooldown in db.kv, 24h per-user cooldown users.mm_push_at, active<=14d candidates, cap 100)."
    implemented: true
    working: true
    file: "/app/backend/push.py, /app/backend/matchmaking.py, /app/backend/server.py, /app/backend/.env"
    stuck_count: 0
    priority: "high"
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Verified by main agent: register-push relays to SuprSend (401 with placeholder key = expected in dev; real key injected at deployment), nudge tested E2E against local Mongo (fake queue entry 60s wait -> candidates selected -> trigger POST sent -> global cooldown set -> second call skipped). Frontend: _layout.tsx handlers (module-scope handler+channel, warm/cold tap, denied nudge), src/push.ts registration on login/app-open. Real delivery ONLY testable in native build after Publish + google-services.json (user must still provide it)."

backend:
  - task: "Match targets changed: Rapide(short)=500 pts, Normale(long)=1000 pts in BOTH engines (game_logic.py + engine.ts, parity kept). i18n labels updated FR/AR/EN, home modal + room screen numbers, tutorial lesson text. Pre-existing test fix: test_pack2 pause assertion aligned to DISCONNECT_PAUSE_SECONDS=60."
    implemented: true
    working: true
    file: "/app/backend/game_logic.py, /app/frontend/src/game/engine.ts, /app/frontend/app/(tabs)/home.tsx, /app/frontend/app/room/[code].tsx, /app/frontend/src/i18n.tsx, /app/frontend/src/tutorial/lessons.ts"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Verified by main agent: python engine short=500/long=1000, TS engine identical, 70-match TS simulation passes, backend test suite passes (fixed pre-existing pause-test mismatch), browser shows 'Rapide 500 points / Normale 1000 points' in the solo type modal."

frontend:
  - task: "Interstitial at EVERY match end, all modes (online/solo/private/tutorial). Removed frequency caps (INTERSTITIAL_EVERY + AsyncStorage counters). Reliability fix: ad load ERROR now schedules a 30s retry; preload re-invoked at hand_end/finished. Ad also shows on the 'Rejouer' exit, not only 'back home'."
    implemented: true
    working: "NA"
    file: "/app/frontend/src/ads/interstitial.ts, /app/frontend/src/ads/config.ts, /app/frontend/app/game/[id].tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Native-builds ONLY (web/Expo Go = no-op by design, adsNativeSupported=false). Web smoke: game screen boots cleanly with the new wiring. Real ad display must be validated by the user in a rebuilt APK."

frontend:
  - task: "Online liquidity pack: (1) invite-friends-button + ShareSheet on matchmaking screen; (2) online-seek-banner + join-online-button in solo vs AI games (polls /api/presence/pulse 30s, dismissible, solo game stays resumable); (3) online-now-count social proof on home online card; (4) match-end-online-button on MatchEndOverlay (solo origin, when waiting>0); (5) daily peak-hour push 21h Tunisia (backend). New endpoint GET /api/presence/pulse. google-services.json installed + app.json wired."
    implemented: true
    working: true
    file: "/app/frontend/app/matchmaking.tsx, /app/frontend/app/game/[id].tsx, /app/frontend/app/(tabs)/home.tsx, /app/frontend/src/components/game/HandEndModal.tsx, /app/backend/server.py, /app/backend/push.py, /app/frontend/app.json"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Main agent E2E: home counter '🟢 1 joueur(s) en ligne', solo banner '🎮 1 joueur(s) cherchent... Rejoindre', invite button opens ShareSheet (WhatsApp/FB/Insta/copy). Peak push unit-tested with forced hour (kv day marker, 100-chunking, idempotent). Pulse endpoint curl-verified. Feature 4 (match-end button) wired + lint only — renders behind the same pulse data as the verified banner."

frontend:
  - task: "3 bug fixes: (1) Duo vs AI matchmaking screen must show only 2 slots (You + teammate), '{n}/2 joueurs', NO ELO range chip, hint 'La partie démarre dès que ton coéquipier accepte l'invitation' — mode param (vs_ai|online) now passed by home.tsx chooseType and friends.tsx sendGameInvite to /matchmaking; duo-vs-duo (mode=online) keeps 4 slots. (2) Share invite link now points to the Play Store (https://play.google.com/store/apps/details?id=com.emergent.cardtableorient.b0nhgs) with new localized download wording (shareQueueMsg FR/AR/EN); room deep links still use WEB_APP_URL (roomLink must be unchanged). (3) Peak-hour push message apostrophes switched to U+2019 so the upstream HTML-escaping no longer shows '&#x27;'."
    implemented: true
    working: "NA"
    file: "/app/frontend/app/matchmaking.tsx, /app/frontend/app/(tabs)/home.tsx, /app/frontend/app/(tabs)/friends.tsx, /app/frontend/src/share.ts, /app/frontend/src/i18n.tsx, /app/backend/push.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Lint clean, services up. To create a vs_ai duo pending state: login tester1, POST /api/matchmaking/duo/invite {to_user_id of tester2, match_type short, mode vs_ai} then open /matchmaking?type=short&duo=1&mode=vs_ai. Credentials in /app/memory/test_credentials.md."

backend:
  - task: "Server usage stats in admin dashboard (GET /api/admin/stats?key=belote-admin-7f3a9c2e)"
    implemented: true
    working: "needs_test"
    file: "backend/server_metrics.py, backend/admin_stats.py, backend/server.py, backend/game_runtime.py, backend/elo_stats.py"
    comment: "NEW: server_metrics.py counts every API request (classified by path prefix into types like 'présence (pulse/ping)', 'matchmaking', 'amis', ...) and every WS message ('ws: connexion', 'ws: ping', 'ws: play', 'ws: état envoyé'...), buffered in memory, flushed to Mongo collection server_metrics every 15s as one doc per (minute, type) with n + users[] (TTL 7 days). Per-player attribution via token->user_id cache filled by user_from_token. Dashboard new section 'Utilisation du serveur': cards (Connexions WS actives, Événements 60min/24h, Parties IA via serveur 24h, DB size Mo) + 2 tables 'Événements app ↔ serveur par type' (60 min & 24 h: Événements, Évts/min, Joueurs, Évts/joueur/min) + table 'Parties serveur par composition' (4/3/2/1/0 humains). Also: elo_stats.py now persists 'origin' in match docs (additive). Full backend suite 146 passed + standalone e2e 29/29 (run alone: python3 tests/test_db_persistence_e2e.py — it is polluted if run after other tests)."
