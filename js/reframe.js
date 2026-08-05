/* ============================================================
   TRACK A — Psychological.  Owner: Bhone
   Files owned: js/reframe.js, css/reframe.css

   Flow:
     textarea -> crisis check (local, deterministic)
                   |- match -> helplines, NO api call
                   `- clear -> prompt built from store.user + store.todayStats
                               -> Gemini -> { distortion, note, evidence[], reframe }
                               -> card -> store.addReframe() -> history

   The API key is never committed. It's pasted once into the
   settings row and kept in localStorage.
   ============================================================ */

import { store } from './store.js';

const KEY_STORE = 'soulshrine.apikey';
const MODEL = 'gemini-3.6-flash';

/* ---------- crisis path -------------------------------------
   Runs locally, BEFORE any network call. Safety routing must not
   depend on the model or on the network being up. If a judge asks
   "what if someone types something serious" — the model never
   sees it.
   VERIFY THESE NUMBERS before they go on a slide.
------------------------------------------------------------- */

const CRISIS_PATTERNS = [
  /\bkill (myself|me)\b/i,
  /\bend (my life|it all)\b/i,
  /\bsuicid/i,
  /\bself[- ]?harm\b/i,
  /\bhurt myself\b/i,
  /\bdon'?t want to (live|be here|exist)\b/i,
  /\bbetter off (dead|without me)\b/i,
  /\bno reason to (live|go on)\b/i,
];

const HELPLINES = [
  { region: 'Singapore', name: 'Samaritans of Singapore (SOS)', contact: '1767' },
  { region: 'Singapore', name: 'mindline.sg', contact: 'mindline.sg' },
  { region: 'Hong Kong', name: 'The Samaritans', contact: '2896 0000' },
  { region: 'Hong Kong', name: 'Suicide Prevention Services', contact: '2382 0000' },
];

const looksLikeCrisis = text => CRISIS_PATTERNS.some(re => re.test(text));

/* ---------- prompt ------------------------------------------
   Everything specific in the response comes from here. The model
   is told never to invent an achievement — a hallucinated win is
   the single worst thing this feature could produce.
------------------------------------------------------------- */

// Gemini's responseSchema is an OpenAPI subset: uppercase type names,
// no `additionalProperties`. propertyOrdering keeps the JSON stable.
const SCHEMA = {
  type: 'OBJECT',
  properties: {
    distortion:      { type: 'STRING' },
    distortion_note: { type: 'STRING' },
    evidence:        { type: 'ARRAY', items: { type: 'STRING' } },
    reframe:         { type: 'STRING' },
  },
  required: ['distortion', 'distortion_note', 'evidence', 'reframe'],
  propertyOrdering: ['distortion', 'distortion_note', 'evidence', 'reframe'],
};

function buildSystem() {
  const u = store.user;
  const s = store.todayStats;

  return `You are the reframing engine inside Soul Shrine, a student mental-wellness app.
You practise cognitive restructuring (Beck's CBT): name the thinking pattern, then
challenge it with the user's own record.

THE USER
Name: ${u.name}
Year ${u.year} at ${u.school}, GPA ${u.gpa}
Current modules: ${u.modules.join(', ')}

THEIR RECORD (the only achievements you may cite — never invent one):
${u.wins.map(w => `- ${w}`).join('\n')}

WHAT THEY STRUGGLE WITH:
${u.struggles.map(w => `- ${w}`).join('\n')}

THEIR FOCUS DATA FROM THIS APP:
- Focused ${s.focusedMin} of ${s.plannedMin} planned minutes today
- ${s.distractionCount} distractions logged today
- ${Math.round(s.lateHalfShare * 100)}% of those happened in the back half of a session (fatigue, not ability)
- Averaging ${s.weekAvgFocusedMin} focused minutes per session over the past fortnight

YOUR JOB
1. distortion — name the cognitive distortion in 1-4 words. Use the standard list:
   Catastrophising, Overgeneralisation, All-or-nothing thinking, Mind reading,
   Fortune telling, Discounting the positive, Emotional reasoning, Personalisation.
   If two apply, join with " + ".
2. distortion_note — one sentence, plain English, on what that pattern is doing here.
3. evidence — 2 to 4 short bullets drawn ONLY from their record and focus data above.
   Quote the specifics: the grade, the module name, the number. If nothing in the
   record is genuinely relevant, return fewer bullets rather than inventing one.
4. reframe — 2 to 4 sentences, second person, warm but not saccharine. Connect the
   evidence to the specific worry. Do not open with "It's understandable that".
   Do not promise outcomes. No emoji. No exclamation marks.

Never diagnose. Never say "as an AI". Never suggest they are being irrational.`;
}

/* ---------- api ---------------------------------------------- */

/* Key resolution, in order:
     1. localStorage  (pasted into the box, survives reloads)
     2. .env          (served as a static file by the dev server)
   Both are local-only. .env is gitignored, so nothing lands in the repo.

   ⚠️  This works because the dev server serves the whole folder — which
   means /.env is downloadable by anything that can reach the server. On
   localhost that is only you. NEVER deploy this folder to a public host
   or to GitHub Pages: the key becomes a public download. If this ever
   needs to go online, move the call behind a server-side proxy first.   */

let apiKey = '';

function getKey() {
  return apiKey;
}

async function resolveKey() {
  // .env wins. It used to be the other way round, which meant one bad paste
  // into localStorage shadowed a perfectly good .env forever — and the
  // fallback card made that look like success.
  try {
    const res = await fetch('.env', { cache: 'no-store' });
    if (res.ok) {
      const match = (await res.text())
        .match(/^[ \t]*gemini_api_key[ \t]*=[ \t]*(.+?)[ \t]*$/im);
      if (match) {
        apiKey = match[1].replace(/^["']|["']$/g, '').trim();
        if (apiKey) return;
      }
    }
  } catch {
    /* no .env served — fall through to localStorage / the paste box */
  }

  apiKey = (localStorage.getItem(KEY_STORE) || '').trim();
}

async function callGemini(thought) {
  const key = getKey();
  if (!key) throw new Error('NO_KEY');

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        // Key goes in a header, never the URL — a key in a query string
        // ends up in browser history and any proxy log in between.
        'x-goog-api-key': key,
      },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: buildSystem() }] },
        contents: [{ role: 'user', parts: [{ text: thought }] }],
        generationConfig: {
          // Schema-constrained JSON — nothing on stage depends on
          // parsing free text out of a prose reply.
          responseMimeType: 'application/json',
          responseSchema: SCHEMA,
          // gemini-3.x takes thinkingLevel, not thinkingBudget (which 400s).
          // "low" drops thinking spend to zero — this is a single short
          // judgement, and it keeps the live demo fast.
          thinkingConfig: { thinkingLevel: 'low' },
          // Thinking tokens count against this cap, so leave headroom even
          // at low: at 1200 the JSON came back truncated mid-string.
          maxOutputTokens: 4000,
          temperature: 0.7,
        },
      }),
    });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`API ${res.status}: ${detail.slice(0, 200)}`);
  }

  const data = await res.json();

  // Safety filters can drop the prompt before a candidate is produced.
  if (data.promptFeedback?.blockReason) {
    throw new Error(`BLOCKED: ${data.promptFeedback.blockReason}`);
  }

  const candidate = data.candidates?.[0];
  if (!candidate) throw new Error('NO_CANDIDATE');
  if (candidate.finishReason && candidate.finishReason !== 'STOP') {
    throw new Error(`FINISH_${candidate.finishReason}`);
  }

  // Parts can carry non-text fields (thoughtSignature) — filter, or the
  // join splices "undefined" into the JSON and the parse throws.
  const text = (candidate.content?.parts || [])
    .filter(p => typeof p.text === 'string')
    .map(p => p.text)
    .join('');
  if (!text) throw new Error('EMPTY');

  return JSON.parse(text);
}

/* ---------- offline fallback --------------------------------
   Venue wifi dies. Captive portals exist. The demo does not die
   with them — this keeps the card identical and flags the mode.
------------------------------------------------------------- */

const FALLBACK = {
  distortion: 'Catastrophising + Discounting the positive',
  distortion_note:
    'One difficult module is being treated as a verdict on your ability, while everything you have already passed is left out of the reckoning.',
  evidence: [
    'Distinction in Web Application Development — the same skills, a different platform',
    'Distinction in Data Structures and in Computational Thinking',
    'Top 10 in two hackathons, both under time pressure',
    'Focused minutes per session up from 12 to 24 over the past fortnight',
  ],
  reframe:
    'Mobile App Dev is not a different kind of hard from Web App Dev — it is the same problem-solving on a new platform, and you have a distinction in that one. You have shipped working software under hackathon deadlines twice. What you are feeling is the week before an assessment, not a measurement of whether you can do this.',
};

/* ---------- ui ----------------------------------------------- */

let root = null;
let state = { view: 'idle', data: null, error: null, offline: false };

/**
 * Prefill the box from elsewhere in the app (the home dashboard's advice
 * cards). Doesn't submit — the user still edits and decides.
 */
export function openWith(text) {
  if (!root) return;
  state = { view: 'idle', data: null, error: null, offline: false };
  render();
  const el = root.querySelector('#rf-text');
  if (!el) return;
  el.value = text;
  el.focus();
  el.setSelectionRange(text.length, text.length);
}

export function mount(el) {
  root = el;
  render();
  resolveKey().then(render);   // re-render once .env has been checked
  store.subscribe(() => { if (state.view === 'idle') render(); });
}

function setState(patch) {
  state = { ...state, ...patch };
  render();
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function render() {
  const s = store.todayStats;
  const hasKey = !!getKey();

  root.innerHTML = `
    <div class="card rf-compose">
      <h2 class="h2">What's the thought?</h2>
      <p class="muted rf-sub">Write it exactly as it sounds in your head. Nothing here leaves your device except the sentence itself.</p>
      <textarea class="input rf-input" id="rf-text" rows="3"
        placeholder="e.g. I'm going to fail the module mobile app dev"
        aria-label="The negative thought you want to reframe"></textarea>
      <div class="rf-actions">
        <button class="btn" id="rf-go">Reframe this</button>
        <span class="rf-stat muted">${s.weekAvgFocusedMin} min avg focus · ${s.distractionCount} distractions today</span>
      </div>
      ${hasKey ? '' : `
        <div class="rf-keyrow">
          <input class="input rf-key" id="rf-key" type="password"
            placeholder="Paste your Gemini API key to enable live reframing"
            aria-label="Gemini API key">
          <button class="btn btn-ghost" id="rf-savekey">Save</button>
        </div>`}
    </div>

    <div id="rf-result" aria-live="polite">${renderResult()}</div>

    ${renderHistory()}
  `;

  root.querySelector('#rf-go').addEventListener('click', submit);
  root.querySelector('#rf-text').addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit();
  });

  const saveBtn = root.querySelector('#rf-savekey');
  if (saveBtn) saveBtn.addEventListener('click', () => {
    const v = root.querySelector('#rf-key').value.trim();
    if (v) { localStorage.setItem(KEY_STORE, v); apiKey = v; render(); }
  });
}

function renderResult() {
  if (state.view === 'idle') return '';

  if (state.view === 'loading') {
    return `
      <div class="card rf-card rf-loading">
        <span class="rf-dots"><i></i><i></i><i></i></span>
        <span class="muted">Reading this against your record…</span>
      </div>`;
  }

  if (state.view === 'crisis') {
    return `
      <div class="card rf-card rf-crisis" role="alert">
        <h3 class="h2">This one's bigger than a reframe.</h3>
        <p>What you wrote sounds heavy, and it deserves a person rather than an app.
           Please reach out — these lines are free, confidential, and open now.</p>
        <ul class="rf-lines">
          ${HELPLINES.map(h => `
            <li><span class="rf-region">${esc(h.region)}</span>
                <strong>${esc(h.name)}</strong>
                <span class="rf-contact">${esc(h.contact)}</span></li>`).join('')}
        </ul>
        <p class="muted rf-note">Nothing you wrote was sent anywhere.</p>
      </div>`;
  }

  if (state.view === 'error') {
    return `
      <div class="card rf-card">
        <p class="rf-err">${esc(state.error)}</p>
      </div>`;
  }

  const d = state.data;
  return `
    <div class="card rf-card">
      ${state.offline ? `<span class="rf-badge" title="${esc(state.error || '')}">offline mode</span>` : ''}
      <span class="rf-chip">${esc(d.distortion)}</span>
      <p class="rf-note-line">${esc(d.distortion_note)}</p>

      <h3 class="rf-h3">Here's what your own record says</h3>
      <ul class="rf-evidence">
        ${d.evidence.map(e => `<li>${esc(e)}</li>`).join('')}
      </ul>

      <p class="rf-reframe">${esc(d.reframe)}</p>

      ${state.offline && state.error ? `
        <p class="rf-diag">Live call failed — ${esc(state.error)}</p>` : ''}
    </div>`;
}

function renderHistory() {
  const items = store.state.reframes;
  if (!items.length) return '';

  return `
    <div class="card">
      <h2 class="h2">Earlier</h2>

      <div class="rf-history">
        ${items.map(r => `
          <details class="rf-history-item">
            <summary class="rf-history-summary">
              <span class="rf-hist-thought">
                “${esc(r.input)}”
              </span>

              <span class="rf-chip rf-chip-sm">
                ${esc(r.distortion)}
              </span>

              <span class="rf-history-arrow">⌄</span>
            </summary>

            <div class="rf-history-content">
              <p>${esc(r.response)}</p>
            </div>
          </details>
        `).join('')}
      </div>
    </div>
  `;
}

async function submit() {
  const el = root.querySelector('#rf-text');
  const thought = el.value.trim();
  if (!thought) return;

  if (looksLikeCrisis(thought)) {
    setState({ view: 'crisis', data: null, offline: false });
    window.announce?.('Support line information shown.');
    return;
  }

  setState({ view: 'loading', data: null, offline: false });

  try {
    const data = await callGemini(thought);
    store.addReframe({ input: thought, distortion: data.distortion, response: data.reframe });
    setState({ view: 'done', data, offline: false });
    window.announce?.(`Reframed. Pattern identified: ${data.distortion}.`);
  } catch (err) {
    console.warn('[reframe] falling back:', err);
    // Demo must never die on a network or key problem — but say so on the
    // card, otherwise a broken key is indistinguishable from success.
    store.addReframe({ input: thought, distortion: FALLBACK.distortion, response: FALLBACK.reframe });
    setState({ view: 'done', data: FALLBACK, offline: true, error: err.message });
    window.announce?.('Reframed in offline mode.');
  }
}
