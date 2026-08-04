/* ============================================================
   FROZEN FILE — shell, tab routing, screen-reader announcements.
   Do not add feature logic here. Put it in your own track file.
   ============================================================ */

import { store }   from './store.js';
import * as focus   from './focus.js';
import * as reframe from './reframe.js';
import * as social  from './social.js';

const SCREENS = {
  focus:   { mod: focus,   root: document.getElementById('focus-root')   },
  reframe: { mod: reframe, root: document.getElementById('reframe-root') },
  social:  { mod: social,  root: document.getElementById('social-root')  },
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
    root.hidden = key !== name;
  }
  for (const tab of document.querySelectorAll('.tab')) {
    tab.setAttribute('aria-selected', String(tab.dataset.screen === name));
  }
  location.hash = name;
}

function boot() {
  document.getElementById('who').textContent = `Hi, ${store.user.name}`;

  for (const { mod, root } of Object.values(SCREENS)) {
    // A track that hasn't landed yet just leaves its panel empty.
    mod.mount?.(root);
  }

  for (const tab of document.querySelectorAll('.tab')) {
    tab.addEventListener('click', () => show(tab.dataset.screen));
  }

  const initial = location.hash.slice(1);
  show(SCREENS[initial] ? initial : 'focus');
}

boot();
