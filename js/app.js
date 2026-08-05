/* ============================================================
   Shell — tab routing and screen-reader announcements.
   Feature logic belongs in the per-screen modules, not here.

   Both the sidebar and the bottom bar carry class="tab", so any
   screen can navigate with:
     document.querySelector('.tab[data-screen="focus"]').click()
   ============================================================ */

import { store }   from './store.js';
import * as db      from './db.js';
import * as home    from './home.js';
import * as focus   from './focus.js';
import * as reframe from './reframe.js';
import * as social  from './social.js';
import * as profile from './profile.js';

const SCREENS = {
  home:    { mod: home,    root: document.getElementById('home-root')    },
  focus:   { mod: focus,   root: document.getElementById('focus-root')   },
  reframe: { mod: reframe, root: document.getElementById('reframe-root') },
  social:  { mod: social,  root: document.getElementById('social-root')  },
  profile: { mod: profile, root: document.getElementById('profile-root') },
};

/** Any track may call this to announce something to screen readers. */
export function announce(message) {
  const region = document.getElementById('live-region');
  region.textContent = '';
  // Re-set on the next frame so repeated identical messages still fire.
  requestAnimationFrame(() => { region.textContent = message; });
}
window.announce = announce;

function show(name) {
  for (const [key, { root }] of Object.entries(SCREENS)) {
    if (root) root.hidden = key !== name;
  }
  for (const tab of document.querySelectorAll('.tab')) {
    tab.setAttribute('aria-selected', String(tab.dataset.screen === name));
  }
  for (const tab of document.querySelectorAll('.bottom-tab')) {
    tab.classList.toggle('is-active', tab.dataset.screen === name);
  }
  location.hash = name;
}

function boot() {
  const who = document.getElementById('who');
  if (who) who.textContent = store.user.name;

  for (const [name, { mod, root }] of Object.entries(SCREENS)) {
    // One screen throwing must not take the rest of the app with it —
    // before this guard, a stale selector in home.js stopped boot() dead
    // and the database never got a chance to connect.
    try {
      mod?.mount?.(root);
    } catch (err) {
      console.error(`[app] ${name} failed to mount:`, err);
    }
  }

  for (const tab of document.querySelectorAll('.tab')) {
    tab.addEventListener('click', () => show(tab.dataset.screen));
  }
  for (const tab of document.querySelectorAll('.bottom-tab')) {
    tab.addEventListener('click', () => show(tab.dataset.screen));
  }
  document.getElementById('notifications')?.addEventListener('click', () => announce('No new notifications.'));

  const initial = location.hash.slice(1);
  show(SCREENS[initial]?.root ? initial : 'home');

  // Database is optional and connects in the background — the app is
  // already interactive by the time this resolves, and stays usable if
  // it never does.
  db.init().then(async connected => {
    if (!connected) return;
    store.setSink(db);
    store.hydrate(await db.loadAll());
  });
}

boot();
