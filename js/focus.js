/* ============================================================
   TRACK B — Cognitive.  Owner: Bhone
   Files owned: js/focus.js, js/vision.js, css/focus.css

   Flow:
     setup -> running (camera watching) -> break (camera off) -> done

   Every distraction writes to store.logDistraction(), which is what
   gives the Reframe screen real numbers to cite.

   GOTCHA: getUserMedia needs a secure context. Opening index.html
   as file:// fails silently. Always serve over localhost.
   ============================================================ */

import { store } from './store.js';
import { detect, loadModel, isReady } from './vision.js';

const LEVELS = [
  { id: 'light',  label: 'Light',  focus: 15, brk: 3,  hint: 'Easing in' },
  { id: 'normal', label: 'Normal', focus: 25, brk: 5,  hint: 'Standard block' },
  { id: 'deep',   label: 'Deep',   focus: 50, brk: 10, hint: 'Long haul' },
];

const POLL_MS = 1500;  // detection cadence — every frame melts the CPU

// Hysteresis. Raw predictions flicker, so entering a state takes more
// evidence than leaving it. Asymmetric on purpose: walking away takes a
// few seconds to confirm, but coming back should feel instant.
const THRESHOLDS = {
  phone:  { on: 3, off: 2 },   // ~4.5s of phone in frame, ~3s clear to resolve
  absent: { on: 6, off: 2 },   // ~9s of no person — a flicker is not leaving
};

/* ---------- state ---------- */

let root = null;
let phase = 'setup';            // setup | running | break | done
let level = LEVELS[1];
let session = null;

let remainingMs = 0;
let focusedMs   = 0;
let summary     = null;

let tickTimer = null;
let pollTimer = null;
let stream    = null;
let camError  = false;
let partner   = null;           // { name, avatar, module } when Track C starts a joint session
let micOn     = true;           // decorative — there is no audio channel, see runningView

// Each detector latches: `active` only flips after enough consecutive
// evidence, so one bad frame can neither trigger nor clear a state.
const det = {
  phone:  { active: false, on: 0, off: 0 },
  absent: { active: false, on: 0, off: 0 },
};

// Both kinds of distraction stop the clock — focused minutes should mean
// minutes actually spent working, not minutes sat near the desk.
const isPaused = () => det.phone.active || det.absent.active;

function pauseReason() {
  if (det.absent.active) return "you're away";
  if (det.phone.active)  return 'phone in hand';
  return '';
}

// Created once and re-parented on each render — rebuilding it via innerHTML
// would tear down the MediaStream and kill the camera mid-session.
const videoEl = document.createElement('video');
videoEl.muted = true;
videoEl.playsInline = true;
videoEl.autoplay = true;
videoEl.className = 'fc-video';
videoEl.setAttribute('aria-label', 'Camera preview');

/* ---------- lifecycle ---------- */

export function mount(el) {
  root = el;
  render();

  // Warm the model as soon as the tab exists, so Start is instant.
  loadModel().then(render).catch(err => {
    console.warn('[focus] model load failed:', err);
    render();
  });
}

/**
 * Start a session on someone else's behalf — used by the social screen
 * when you accept an invite or join a friend who's already working.
 * The only entry point Track C touches; everything else here is private.
 */
export function startWith({ minutes, partner: who = null } = {}) {
  if (phase === 'running') return;
  const focus = Math.max(1, minutes || level.focus);
  partner = typeof who === 'string' ? { name: who } : who;
  level = { id: 'custom', label: partner ? `With ${partner.name}` : 'Custom',
            focus, brk: Math.max(3, Math.round(focus / 5)), hint: '' };
  micOn = true;
  startSession();
}

function fmt(ms) {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function resetDetectors() {
  for (const d of Object.values(det)) { d.active = false; d.on = 0; d.off = 0; }
}

async function startSession() {
  session = store.startSession(level.focus);
  remainingMs = level.focus * 60_000;
  focusedMs = 0;
  camError = false;
  resetDetectors();

  phase = 'running';
  render();

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480 }, audio: false,
    });
    videoEl.srcObject = stream;
    await videoEl.play();
  } catch (err) {
    console.warn('[focus] camera unavailable:', err);
    camError = true;
  }

  tickTimer = setInterval(tick, 1000);
  pollTimer = setInterval(poll, POLL_MS);
  render();
}

function stopCamera() {
  if (stream) stream.getTracks().forEach(t => t.stop());
  stream = null;
  videoEl.srcObject = null;
}

function clearTimers() {
  clearInterval(tickTimer); tickTimer = null;
  clearInterval(pollTimer); pollTimer = null;
}

function tick() {
  if (!isPaused()) {
    remainingMs -= 1000;
    focusedMs += 1000;
  }
  if (remainingMs <= 0) return endFocus();
  paintTimer();
}

async function poll() {
  if (!stream) return;

  let seen;
  try {
    seen = await detect(videoEl);
  } catch (err) {
    console.warn('[focus] detect failed:', err);
    return;
  }

  // If it can see your phone, you are plainly still at the desk — that
  // alone counts as presence and stops a close-up frame from reading
  // as "left the room".
  const present = seen.personPresent || seen.phone;

  const before = isPaused();
  evaluate('phone',  seen.phone);
  evaluate('absent', !present);

  if (isPaused() !== before) paintTimer();
  paintWarning();
}

function evaluate(type, present) {
  const d = det[type];
  const t = THRESHOLDS[type];

  if (present) { d.on += 1; d.off = 0; } else { d.off += 1; d.on = 0; }

  if (!d.active && d.on >= t.on) {
    d.active = true;
    // Logged once per episode — the latch is what prevents a burst of
    // duplicate entries from a single phone pickup.
    store.logDistraction(session.id, type, Date.now() - session.startedAt);
    window.announce?.(warningText(type));
  } else if (d.active && d.off >= t.off) {
    d.active = false;
  }
}

function warningText(type) {
  return type === 'phone'
    ? `Phone's out — timer paused, ${Math.ceil(remainingMs / 60_000)} min still to go.`
    : "You've stepped away. Timer paused.";
}

function endFocus() {
  clearTimers();
  stopCamera();
  resetDetectors();

  const focusedMin = Math.round(focusedMs / 60_000);
  store.endSession(session.id, focusedMin);

  const logged = store.state.sessions.find(s => s.id === session.id);
  const distractions = logged?.distractions || [];
  const half = level.focus * 30_000;

  summary = {
    focusedMin,
    plannedMin: level.focus,
    count: distractions.length,
    late: distractions.filter(d => d.atMs > half).length,
    avg: store.todayStats.weekAvgFocusedMin,
  };

  phase = 'break';
  remainingMs = level.brk * 60_000;
  tickTimer = setInterval(breakTick, 1000);
  render();
}

function breakTick() {
  remainingMs -= 1000;
  if (remainingMs <= 0) return endBreak();
  paintTimer();
}

function endBreak() {
  clearTimers();
  phase = 'done';
  render();
}

function reset() {
  clearTimers();
  stopCamera();
  resetDetectors();
  phase = 'setup';
  session = null;
  summary = null;
  partner = null;
  render();
}

/* ---------- render ----------
   render() rebuilds the screen on phase changes only. During a session
   the per-second updates go through paintTimer()/paintWarning(), which
   touch single nodes — a full innerHTML rewrite would detach the video.
------------------------------------------------------------------- */

function paintTimer() {
  const t = root?.querySelector('#fc-time');
  if (t) t.textContent = fmt(remainingMs);

  const p = root?.querySelector('#fc-paused');
  if (p) {
    p.hidden = !isPaused();
    if (isPaused()) p.textContent = `paused — ${pauseReason()}`;
  }

  // Mirror the pause onto your own tile so the state is visible where
  // you're looking, not just on the clock.
  root?.querySelector('#fc-you')?.classList.toggle('is-paused', isPaused());
}

function paintWarning() {
  const slot = root?.querySelector('#fc-warn');
  if (!slot) return;

  if (camError) {
    slot.innerHTML = `<div class="fc-alert fc-alert-nocam" role="status">Camera unavailable — timer still running, distraction tracking off.</div>`;
    return;
  }

  const type = det.absent.active ? 'absent' : det.phone.active ? 'phone' : null;
  slot.innerHTML = type
    ? `<div class="fc-alert fc-alert-${type}" role="status">${warningText(type)}</div>`
    : '';
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function render() {
  if (!root) return;

  if (phase === 'setup')   root.innerHTML = setupView();
  if (phase === 'running') root.innerHTML = runningView();
  if (phase === 'break')   root.innerHTML = breakView();
  if (phase === 'done')    root.innerHTML = doneView();

  if (phase === 'running') {
    root.querySelector('#fc-cam')?.appendChild(videoEl);
    paintWarning();
    paintTimer();
    root.querySelector('#fc-stop')?.addEventListener('click', endFocus);
    root.querySelector('#fc-leave')?.addEventListener('click', endFocus);
    root.querySelector('#fc-mic')?.addEventListener('click', () => {
      micOn = !micOn;
      render();   // cheap: the video element is re-parented, not rebuilt
    });
  }

  if (phase === 'setup') {
    for (const btn of root.querySelectorAll('[data-level]')) {
      btn.addEventListener('click', () => {
        level = LEVELS.find(l => l.id === btn.dataset.level);
        render();
      });
    }
    root.querySelector('#fc-mins')?.addEventListener('change', e => {
      const v = parseInt(e.target.value, 10);
      if (v > 0) level = { ...level, id: 'custom', label: 'Custom', focus: v,
                           brk: Math.max(3, Math.round(v / 5)) };
      render();
    });
    root.querySelector('#fc-start')?.addEventListener('click', startSession);
  }

  root.querySelector('#fc-skip')?.addEventListener('click', endBreak);
  root.querySelector('#fc-again')?.addEventListener('click', reset);
}

function setupView() {
  const s = store.todayStats;
  return `
    <div class="card">
      <h2 class="h2">Focus session</h2>
      <p class="muted fc-sub">Pick a length, or type your own. The camera watches for your phone and for you leaving — nothing leaves this device.</p>

      <div class="fc-levels" role="group" aria-label="Session length">
        ${LEVELS.map(l => `
          <button class="fc-level ${l.id === level.id ? 'is-on' : ''}" data-level="${l.id}">
            <span class="fc-level-n">${l.focus}</span>
            <span class="fc-level-l">${l.label}</span>
            <span class="fc-level-h muted">${l.focus} / ${l.brk} min · ${l.hint}</span>
          </button>`).join('')}
      </div>

      <div class="fc-custom">
        <label for="fc-mins" class="muted">Or set your own</label>
        <input class="input fc-mins" id="fc-mins" type="number" min="1" max="180"
               value="${level.focus}" aria-label="Focus minutes">
        <span class="muted">min</span>
      </div>

      <div class="fc-actions">
        <button class="btn" id="fc-start">Start ${level.focus}-minute session</button>
        <span class="muted fc-model">${isReady() ? 'Camera model ready' : 'Loading camera model…'}</span>
      </div>
    </div>

    <div class="card">
      <h2 class="h2">Where you're at</h2>
      <p class="fc-stats">
        <strong>${s.weekAvgFocusedMin} min</strong> average focus per session over the past fortnight.
        ${s.distractionCount ? `<strong>${s.distractionCount}</strong> distractions logged today.` : 'No distractions logged today yet.'}
      </p>
    </div>`;
}

const ICON_MIC = `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3z"/><path d="M17 11a1 1 0 1 1 2 0 7 7 0 0 1-6 6.93V20h2a1 1 0 1 1 0 2H9a1 1 0 1 1 0-2h2v-2.07A7 7 0 0 1 5 11a1 1 0 1 1 2 0 5 5 0 0 0 10 0z"/></svg>`;

const ICON_MIC_OFF = `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3z"/><path d="M17 11a1 1 0 1 1 2 0 7 7 0 0 1-6 6.93V20h2a1 1 0 1 1 0 2H9a1 1 0 1 1 0-2h2v-2.07A7 7 0 0 1 5 11a1 1 0 1 1 2 0 5 5 0 0 0 10 0z"/><path d="M3.7 2.3a1 1 0 0 0-1.4 1.4l18 18a1 1 0 0 0 1.4-1.4z"/></svg>`;

const ICON_LEAVE = `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M12 9c-1.6 0-3.15.25-4.6.7v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85a.9.9 0 0 1-1.27-.02L.29 13.4a.9.9 0 0 1 .02-1.29C3.34 9.25 7.46 7.6 12 7.6s8.66 1.65 11.69 4.51a.9.9 0 0 1 .02 1.29l-2.62 2.13a.9.9 0 0 1-1.27.02 11.6 11.6 0 0 0-2.66-1.85.999.999 0 0 1-.56-.9V9.7A15.6 15.6 0 0 0 12 9z"/></svg>`;

function runningView() {
  const clock = `
    <div class="fc-clock">
      <span id="fc-time">${fmt(remainingMs)}</span>
      <span class="fc-paused muted" id="fc-paused" hidden></span>
    </div>
    <div id="fc-warn" aria-live="assertive"></div>`;

  if (!partner) {
    return `
      <div class="card fc-live">
        ${clock}
        <div class="fc-cam" id="fc-cam"></div>
        <div class="fc-actions">
          <button class="btn btn-ghost" id="fc-stop">End session early</button>
          <span class="muted">${esc(level.label)} · ${level.focus} min</span>
        </div>
      </div>`;
  }

  // Partnered: their tile is presence only. There is no audio or video
  // channel — the mic button below is deliberately decorative, and the
  // camera has no off switch because it is the sensor, not a webcam call.
  return `
    <div class="card fc-live">
      ${clock}

      <div class="fc-call">
        <div class="fc-tile fc-tile-you" id="fc-you">
          <div class="fc-cam" id="fc-cam"></div>
          <span class="fc-tile-tag">You</span>
        </div>

        <div class="fc-tile fc-tile-them">
          <span class="fc-tile-avatar">${partner.avatar || '🙂'}</span>
          <span class="fc-tile-name">${esc(partner.name)}</span>
          ${partner.module ? `<span class="fc-tile-meta">${esc(partner.module)}</span>` : ''}
          <span class="fc-tile-status"><i class="fc-pulse" aria-hidden="true"></i>focusing</span>
        </div>
      </div>

      <div class="fc-controls">
        <button class="fc-ctrl ${micOn ? '' : 'is-off'}" id="fc-mic"
                aria-pressed="${!micOn}" aria-label="${micOn ? 'Mute microphone' : 'Unmute microphone'}"
                title="Decorative — this prototype has no audio channel">
          ${micOn ? ICON_MIC : ICON_MIC_OFF}
        </button>
        <button class="fc-ctrl fc-ctrl-leave" id="fc-leave" aria-label="Leave session">
          ${ICON_LEAVE}
        </button>
      </div>

      <p class="muted fc-callnote">${esc(level.label)} · ${level.focus} min · presence only, no audio</p>
    </div>`;
}

function breakView() {
  const trend = summary.avg
    ? (summary.focusedMin >= summary.avg
        ? `Up from your ${summary.avg} min average.`
        : `Your average is ${summary.avg} min.`)
    : '';

  return `
    <div class="card">
      <h2 class="h2">Break</h2>
      <p class="muted">Camera's off. Stand up, look at something further than your screen.</p>
      <div class="fc-clock fc-clock-sm"><span id="fc-time">${fmt(remainingMs)}</span></div>
      <div class="fc-actions"><button class="btn btn-ghost" id="fc-skip">Skip break</button></div>
    </div>

    <div class="card">
      <h2 class="h2">That session</h2>
      <ul class="fc-summary">
        <li><strong>${summary.focusedMin}</strong> of ${summary.plannedMin} minutes focused</li>
        <li><strong>${summary.count}</strong> distraction${summary.count === 1 ? '' : 's'}</li>
        ${summary.count ? `<li><strong>${summary.late}</strong> in the last third — that's fatigue, not ability</li>` : ''}
      </ul>
      <p class="muted fc-trend">${trend}</p>
    </div>`;
}

function doneView() {
  return `
    <div class="card">
      <h2 class="h2">Break's over</h2>
      <p class="muted">Ready for another block?</p>
      <div class="fc-actions"><button class="btn" id="fc-again">Start another</button></div>
    </div>`;
}
