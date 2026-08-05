/* ============================================================
   Profile — the record the reframing engine draws on.

   Everything here is read-only for now. It matters because it
   makes the AI's evidence legible: a judge can see exactly which
   facts the reframe is allowed to cite.
   ============================================================ */

import { store } from './store.js';
import { isConnected } from './db.js';

let root = null;

export function mount(el) {
  root = el;
  render();
  store.subscribe(render);
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function totals() {
  const sessions = store.state.sessions || [];
  const minutes = sessions.reduce((n, s) => n + (s.focusedMin || 0), 0);
  const distractions = sessions.reduce((n, s) => n + (s.distractions?.length || 0), 0);
  return {
    hours: (minutes / 60).toFixed(1),
    sessions: sessions.length,
    distractions,
    reframes: (store.state.reframes || []).length,
  };
}

function joinedLabel(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

function render() {
  if (!root) return;

  const u = store.user;
  const t = totals();

  root.innerHTML = `
    <div class="card pf-head">
      <span class="pf-avatar" aria-hidden="true">${u.avatar || '🙂'}</span>
      <div class="pf-id">
        <h2 class="pf-name">${esc(u.name)}</h2>
        <p class="muted pf-sub">${esc(u.course || '')}${u.year ? ` · Year ${u.year}` : ''}</p>
        <p class="muted pf-sub">${esc(u.school || '')}</p>
      </div>
      <span class="pf-streak" title="Consecutive days with a focus session">
        <strong>${u.streakDays ?? 0}</strong><span>day streak</span>
      </span>
    </div>

    <div class="pf-stats">
      <div class="card pf-stat"><strong>${t.hours}</strong><span>hours focused</span></div>
      <div class="card pf-stat"><strong>${t.sessions}</strong><span>sessions</span></div>
      <div class="card pf-stat"><strong>${t.reframes}</strong><span>reframes</span></div>
      <div class="card pf-stat"><strong>${u.gpa ?? '—'}</strong><span>GPA</span></div>
    </div>

    <div class="card">
      <h2 class="h2">Your record</h2>
      <p class="muted pf-note">These are the only facts the advice screen is allowed to cite. It will return fewer points rather than invent one.</p>
      <ul class="pf-wins">
        ${(u.wins || []).map(w => `<li>${esc(w)}</li>`).join('')}
      </ul>
    </div>

    <div class="card">
      <h2 class="h2">Modules</h2>
      <div class="pf-chips">
        ${(u.modules || []).map(m => `<span class="pf-chip">${esc(m)}</span>`).join('')}
      </div>
    </div>

    <div class="card">
      <h2 class="h2">What you're working on</h2>
      <ul class="pf-struggles">
        ${(u.struggles || []).map(s => `<li>${esc(s)}</li>`).join('')}
      </ul>
    </div>

    <div class="card pf-privacy">
      <h2 class="h2">Data &amp; privacy</h2>
      <ul class="pf-facts">
        <li><span class="pf-dot ${isConnected() ? 'is-on' : ''}"></span>
            Sessions ${isConnected() ? 'sync to your account' : 'are stored on this device'}</li>
        <li><span class="pf-dot is-on"></span>Camera frames never leave your browser</li>
        <li><span class="pf-dot is-on"></span>No messaging, so nothing to moderate</li>
      </ul>
      <p class="muted pf-note">Member since ${esc(joinedLabel(u.joined))}.</p>
    </div>
  `;
}
