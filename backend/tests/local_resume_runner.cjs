// Regression runner: an offline solo-vs-AI game MUST stay resumable after quit.
// Loads the REAL app code (frontend/src/game/useLocalGame.ts + engine + ai) in
// Node via sucrase, with stubs for react / AsyncStorage / auth / api, and checks:
//   1. starting a game persists it in AsyncStorage
//   2. the quit path ("leave") KEEPS the save  <-- the regression this guards
//   3. getSavedLocalGame() offers the game for resume (home header button)
//   4. remounting the same id restores the exact same game (same hand)
//   5. a finished game is NOT offered for resume
// Prints JSON {ok, checks} on stdout; exit code 0/1.
const fs = require("fs");
const Module = require("module");
const { transform } = require("/app/frontend/node_modules/sucrase");

require.extensions[".ts"] = (m, filename) => {
  const src = fs.readFileSync(filename, "utf8");
  const { code } = transform(src, {
    transforms: ["typescript", "imports"],
    disableESTransforms: true,
  });
  m._compile(code, filename);
};

// ---- in-memory AsyncStorage stub ----
const store = new Map();
const AsyncStorage = {
  getItem: async (k) => (store.has(k) ? store.get(k) : null),
  setItem: async (k, v) => { store.set(k, String(v)); },
  removeItem: async (k) => { store.delete(k); },
};

// ---- minimal React hooks runtime (enough for useLocalGame) ----
let hooks = [];
let idx = 0;
let pendingEffects = [];
const React = {
  useState(init) {
    const i = idx++;
    if (!(i in hooks)) hooks[i] = typeof init === "function" ? init() : init;
    const set = (v) => { hooks[i] = typeof v === "function" ? v(hooks[i]) : v; };
    return [hooks[i], set];
  },
  useRef(init) {
    const i = idx++;
    if (!(i in hooks)) hooks[i] = { current: init };
    return hooks[i];
  },
  useEffect(fn, deps) {
    const i = idx++;
    const prev = hooks[i];
    const changed =
      !prev || !deps || deps.length !== prev.deps.length ||
      deps.some((d, k) => !Object.is(d, prev.deps[k]));
    if (changed) {
      pendingEffects.push(() => {
        if (prev && prev.cleanup) prev.cleanup();
        const cleanup = fn() || null;
        hooks[i] = { deps, cleanup };
      });
    }
  },
};

const TEST_USER = { user_id: "u_test_resume", username: "Testeur", avatar_id: "av1", elo: 1000 };

// ---- module stubs + "@/" alias resolution ----
const stubs = {
  react: React,
  "@react-native-async-storage/async-storage": { __esModule: true, default: AsyncStorage },
  "@/src/context/AuthContext": { __esModule: true, useAuth: () => ({ user: TEST_USER }) },
  "@/src/api": { __esModule: true, api: { post: async () => ({}) } },
};
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (stubs[request]) return "stub:" + request;
  if (request.startsWith("@/")) {
    return origResolve.call(this, "/app/frontend/" + request.slice(2), ...rest);
  }
  return origResolve.call(this, request, ...rest);
};
for (const [id, exp] of Object.entries(stubs)) {
  Module._cache["stub:" + id] = {
    id: "stub:" + id, filename: "stub:" + id, loaded: true, exports: exp,
  };
}

const {
  useLocalGame,
  getSavedLocalGame,
  newLocalGameId,
} = require("/app/frontend/src/game/useLocalGame.ts");

function render(gameId) {
  idx = 0;
  const out = useLocalGame(gameId);
  const toRun = pendingEffects;
  pendingEffects = [];
  toRun.forEach((f) => f());
  return out;
}

function unmount() {
  hooks.forEach((h) => {
    if (h && typeof h === "object" && "deps" in h && h.cleanup) h.cleanup();
  });
  hooks = [];
  pendingEffects = [];
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const STORAGE_KEY = "local_solo_game";

(async () => {
  const checks = {};
  const gid = newLocalGameId("short");

  // mount the game screen hook (the async init effect loads/creates the engine)
  let api = render(gid);
  await sleep(120);
  api = render(gid); // re-render to read the committed state
  checks.started = !!api.state && api.state.phase !== "finished";
  checks.persisted_on_start = store.has(STORAGE_KEY);
  const handBefore = api.state ? JSON.stringify([...api.state.hand].sort()) : null;

  // QUIT: the X button in game/[id].tsx calls leave() for local games
  api.leave();
  await sleep(30);
  checks.save_kept_after_quit = store.has(STORAGE_KEY); // << the regression guard
  const resume = await getSavedLocalGame(TEST_USER.user_id);
  checks.resume_offered = !!resume && resume.game_id === gid;
  // the saved game must never be offered to another account
  checks.not_offered_to_other_user = (await getSavedLocalGame("someone_else")) === null;

  // navigate away (unmount) then tap "resume" (remount with the same id)
  unmount();
  api = render(gid);
  await sleep(120);
  api = render(gid);
  checks.restored_same_game =
    !!api.state &&
    api.state.phase !== "finished" &&
    JSON.stringify([...api.state.hand].sort()) === handBefore;
  api.leave();
  unmount();

  // finished games are cleaned up / never offered for resume
  const raw = store.get(STORAGE_KEY);
  if (raw) {
    const saved = JSON.parse(raw);
    saved.doc.phase = "finished";
    store.set(STORAGE_KEY, JSON.stringify(saved));
  }
  checks.finished_not_offered = (await getSavedLocalGame(TEST_USER.user_id)) === null;

  const ok = Object.values(checks).every(Boolean);
  console.log(JSON.stringify({ ok, checks }));
  process.exit(ok ? 0 : 1);
})().catch((e) => {
  console.log(JSON.stringify({ ok: false, error: String(e && e.stack || e) }));
  process.exit(1);
});
