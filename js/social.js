/* ============================================================
   TRACK C — Social.  Owner: Bhone
   Files owned: js/social.js, css/social.css

   Presence, not messaging. You can see who's working and join
   them; there is deliberately no chat — an unmoderated channel
   inside a student wellness app is a safeguarding problem we're
   not equipped to solve in a prototype.

   Friends and invites are seeded. The focus data underneath them
   is real, captured by the camera on the Focus tab.
   ============================================================ */

import { store } from './store.js';
import { startWith } from './focus.js';

const DURATIONS = [15, 25, 50];

let root = null;
let inviting = null;   // friend id whose duration picker is open

export function mount(el) {
  root = el;
  render();
  store.subscribe(render);
}

/* ---------- matching ----------
   Replaces the personality quiz. Compares how long this person
   actually studies against how long you actually study — both
   numbers come from real session history, so it survives the
   "isn't this just astrology?" question.
------------------------------------------------------------- */

function myTypicalLength() {
  const planned = store.state.sessions.map(s => s.plannedMin).filter(Boolean);
  if (!planned.length) return 25;
  return Math.round(planned.reduce((a, b) => a + b, 0) / planned.length);
}

function matchNote(friend) {
  const mine = myTypicalLength();
  if (Math.abs(friend.avgSession - mine) > 10) return '';
  return `${friend.avgSession}-minute blocks, usually ${friend.whenStudies} — close to your ${mine}.`;
}

/* ---------- actions ---------- */

function toFocus(minutes, partner) {
  // app.js is frozen, so switch tabs the same way a user would.
  document.querySelector('.tab[data-screen="focus"]')?.click();
  startWith({ minutes, partner });
}

function onAccept(inviteId) {
  const invite = store.acceptInvite(inviteId);
  if (!invite) return;
  const from = store.friend(invite.fromId);
  window.announce?.(`Joining ${from?.name}'s session.`);
  toFocus(invite.minutes, from?.name);
}

function onJoin(friendId) {
  const f = store.friend(friendId);
  if (!f) return;
  window.announce?.(`Joining ${f.name}'s session.`);
  toFocus(f.avgSession, f.name);
}

/* ---------- render ---------- */

function esc(s) {
  return String(s).replace(/[&<>"]/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function render() {
  if (!root) return;

  root.innerHTML = `
    ${inviteCard()}
    ${studyingNowCard()}
    ${peopleCard()}
  `;

  for (const btn of root.querySelectorAll('[data-accept]')) {
    btn.addEventListener('click', () => onAccept(btn.dataset.accept));
  }
  for (const btn of root.querySelectorAll('[data-decline]')) {
    btn.addEventListener('click', () => store.declineInvite(btn.dataset.decline));
  }
  for (const btn of root.querySelectorAll('[data-join]')) {
    btn.addEventListener('click', () => onJoin(btn.dataset.join));
  }
  for (const btn of root.querySelectorAll('[data-invite]')) {
    btn.addEventListener('click', () => {
      inviting = inviting === btn.dataset.invite ? null : btn.dataset.invite;
      render();
    });
  }
  for (const btn of root.querySelectorAll('[data-send]')) {
    btn.addEventListener('click', () => {
      store.inviteFriend(btn.dataset.send, Number(btn.dataset.mins));
      inviting = null;
      window.announce?.('Invite sent.');
      render();
    });
  }
}

function inviteCard() {
  const invites = store.invites;
  if (!invites.length) return '';

  return invites.map(inv => {
    const from = store.friend(inv.fromId);
    if (!from) return '';
    return `
      <div class="card sc-invite">
        <div class="sc-invite-head">
          <span class="sc-avatar">${from.avatar}</span>
          <div>
            <p class="sc-invite-text"><strong>${esc(from.name)}</strong> invited you to a ${inv.minutes}-minute session.</p>
            <p class="muted sc-invite-sub">${esc(from.module)}</p>
          </div>
        </div>
        <div class="sc-actions">
          <button class="btn" data-accept="${inv.id}">Join ${esc(from.name)}</button>
          <button class="btn btn-ghost" data-decline="${inv.id}">Not now</button>
        </div>
      </div>`;
  }).join('');
}

function studyingNowCard() {
  const live = store.friends.filter(f => f.status === 'in-session');
  if (!live.length) return '';

  return `
    <div class="card">
      <h2 class="h2">Studying right now</h2>
      <ul class="sc-list">
        ${live.map(f => `
          <li class="sc-row">
            <span class="sc-avatar">${f.avatar}</span>
            <div class="sc-who">
              <span class="sc-name">${esc(f.name)} <span class="sc-dot" aria-hidden="true"></span></span>
              <span class="muted sc-meta">${esc(f.module)} · ${f.startedMinAgo} min in</span>
              ${matchNote(f) ? `<span class="sc-match">${esc(matchNote(f))}</span>` : ''}
            </div>
            <button class="btn btn-ghost sc-cta" data-join="${f.id}">Join</button>
          </li>`).join('')}
      </ul>
    </div>`;
}

function peopleCard() {
  const rest = store.friends.filter(f => f.status !== 'in-session');
  if (!rest.length) return '';

  return `
    <div class="card">
      <h2 class="h2">Your people</h2>
      <ul class="sc-list">
        ${rest.map(f => `
          <li class="sc-row ${f.status === 'offline' ? 'is-off' : ''}">
            <span class="sc-avatar">${f.avatar}</span>
            <div class="sc-who">
              <span class="sc-name">${esc(f.name)}</span>
              <span class="muted sc-meta">${esc(f.module)} · ${f.status === 'offline' ? 'offline' : 'around'}</span>
              ${matchNote(f) ? `<span class="sc-match">${esc(matchNote(f))}</span>` : ''}
            </div>
            ${f.invitedMinutes
              ? `<span class="muted sc-pending">invited · ${f.invitedMinutes} min</span>`
              : `<button class="btn btn-ghost sc-cta" data-invite="${f.id}"
                    ${f.status === 'offline' ? 'disabled' : ''}>Invite</button>`}
          </li>
          ${inviting === f.id ? `
            <li class="sc-picker">
              <span class="muted">Session length</span>
              ${DURATIONS.map(m => `
                <button class="btn btn-ghost sc-dur" data-send="${f.id}" data-mins="${m}">${m} min</button>`).join('')}
            </li>` : ''}
        `).join('')}
      </ul>
      <p class="muted sc-note">No messaging by design — you can see that someone's working, and that's the point.</p>
    </div>`;
}
