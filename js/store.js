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

function load() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); }
  catch { return null; }
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
  },

  /** Track A: record a completed reframe. */
  addReframe({ input, distortion, response }) {
    state.reframes.unshift({ input, distortion, response, ts: Date.now() });
    emit();
  },

  /** Track C: save quiz result. */
  setStudyStyle(style) {
    state.user.studyStyle = style;
    emit();
  },

  /* ---- pub/sub ---- */

  /** Re-render on any change. Returns an unsubscribe function. */
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  /** Demo escape hatch — wipe back to the seeded persona. */
  reset() {
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  },
};

// Handy during the demo: type `store.reset()` in the console.
window.store = store;
