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
