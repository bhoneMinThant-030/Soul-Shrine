/* ============================================================
   THE CONTRACT — all three tracks read from this.
   Owner after step 0: Track C.
   Anyone may READ. Only Track C changes the shape of `state`.

   If you need a new field, ask C to add it rather than editing
   this file yourself — this is the one file that can conflict.
   ============================================================ */

import { SEED } from './seed.js';

const STORAGE_KEY = 'soulshrine.v1';

const state = load() ?? structuredClone(SEED);
const listeners = new Set();

// Optional persistence backend, injected by app.js. Kept as a hook rather
// than an import so store.js has no dependency on the database — the app
// runs identically with nothing plugged in.
let sink = null;

function load() {
  let saved;
  try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY)); }
  catch { return null; }
  if (!saved) return null;

  // Anyone who used the app before a new field existed has a saved blob
  // without it. Backfill from SEED rather than crashing on undefined.
  for (const [key, value] of Object.entries(SEED)) {
    if (saved[key] === undefined) saved[key] = structuredClone(value);
  }
  return saved;
}

function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch { /* private mode — demo still works in memory */ }
}

function emit() {
  persist();
  for (const fn of listeners) fn(state);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export const store = {
  /* ---- read ---- */

  get state() { return state; },
  get user()  { return state.user; },

  /** Sessions recorded today. */
  get todaySessions() {
    return state.sessions.filter(s => s.date === today());
  },

  /**
   * The numbers Track A injects into the Claude prompt so the
   * reframe is grounded in real behaviour instead of vibes.
   * @returns {{focusedMin:number, plannedMin:number, distractionCount:number,
   *            lateHalfShare:number, weekAvgFocusedMin:number}}
   */
  get todayStats() {
    const ts = store.todaySessions;
    const focusedMin  = ts.reduce((n, s) => n + (s.focusedMin  || 0), 0);
    const plannedMin  = ts.reduce((n, s) => n + (s.plannedMin  || 0), 0);
    const distractions = ts.flatMap(s => s.distractions || []);

    // Share of distractions that happened in the back half of a session.
    // Fatigue signal — this is the line that makes the demo land.
    let late = 0;
    for (const s of ts) {
      const half = (s.plannedMin || 0) * 30_000; // ms at the midpoint
      for (const d of (s.distractions || [])) {
        if (d.atMs != null && d.atMs > half) late++;
      }
    }

    const past = state.sessions.filter(s => s.date !== today());
    const days = new Set(past.map(s => s.date)).size || 1;
    const weekAvgFocusedMin = Math.round(
      past.reduce((n, s) => n + (s.focusedMin || 0), 0) / days
    );

    return {
      focusedMin,
      plannedMin,
      distractionCount: distractions.length,
      lateHalfShare: distractions.length ? late / distractions.length : 0,
      weekAvgFocusedMin,
    };
  },

  /* ---- write ---- */

  /** Track B: start a session. Returns the session object to mutate. */
  startSession(plannedMin) {
    const s = { id: crypto.randomUUID(), date: today(), plannedMin,
                focusedMin: 0, distractions: [], startedAt: Date.now() };
    state.sessions.push(s);
    emit();
    return s;
  },

  /** Track B: log a distraction. type = 'phone' | 'absent' | 'away' */
  logDistraction(sessionId, type, atMs) {
    const s = state.sessions.find(x => x.id === sessionId);
    if (!s) return;
    s.distractions.push({ type, atMs: atMs ?? (Date.now() - s.startedAt) });
    emit();
  },

  /** Track B: close out a session. */
  endSession(sessionId, focusedMin) {
    const s = state.sessions.find(x => x.id === sessionId);
    if (!s) return;
    s.focusedMin = focusedMin;
    emit();
    sink?.saveSession?.(s);
  },

  /** Track A: record a completed reframe. */
  addReframe({ input, distortion, response }) {
    const entry = { input, distortion, response, ts: Date.now() };
    state.reframes.unshift(entry);
    emit();
    sink?.saveReframe?.(entry);
  },

  /** Track C: save quiz result. */
  setStudyStyle(style) {
    state.user.studyStyle = style;
    emit();
  },

  /* ---- social ---- */

  get friends() { return state.friends || []; },
  get invites() { return state.invites || []; },

  friend(id) { return store.friends.find(f => f.id === id); },

  /** Remove an invite and hand it back so the caller can act on it. */
  acceptInvite(id) {
    const i = state.invites.findIndex(x => x.id === id);
    if (i === -1) return null;
    const [invite] = state.invites.splice(i, 1);
    emit();
    return invite;
  },

  declineInvite(id) {
    state.invites = state.invites.filter(x => x.id !== id);
    emit();
  },

  /** Outgoing invite — marks the friend as pending until they "reply". */
  inviteFriend(friendId, minutes) {
    const f = store.friend(friendId);
    if (!f) return;
    f.invitedMinutes = minutes;
    emit();
  },

  /* ---- pub/sub ---- */

  /** Re-render on any change. Returns an unsubscribe function. */
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  /* ---- persistence backend ---- */

  /** app.js plugs the database in here once it has connected. */
  setSink(backend) { sink = backend; },

  /**
   * Merge server history in without losing anything held locally.
   * Sessions dedupe on id; reframes on timestamp + text, since the
   * server assigns its own ids.
   */
  hydrate(remote) {
    if (!remote) return;

    if (remote.sessions?.length) {
      const seen = new Set(state.sessions.map(s => s.id));
      for (const s of remote.sessions) if (!seen.has(s.id)) state.sessions.push(s);
      state.sessions.sort((a, b) => a.date.localeCompare(b.date));
    }

    if (remote.reframes?.length) {
      const seen = new Set(state.reframes.map(r => `${r.ts}|${r.input}`));
      for (const r of remote.reframes) {
        if (!seen.has(`${r.ts}|${r.input}`)) state.reframes.push(r);
      }
      state.reframes.sort((a, b) => b.ts - a.ts);
    }

    emit();
  },

  /** Demo escape hatch — wipe back to the seeded persona. */
  reset() {
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  },
};

// Handy during the demo: type `store.reset()` in the console.
window.store = store;
