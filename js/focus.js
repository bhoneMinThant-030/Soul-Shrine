/* ============================================================
   TRACK B — Cognitive.  Owner: <name>
   Files you own: js/focus.js, js/vision.js, css/focus.css
   Do not edit any other file.

   Build:
     - focus timer with breaks; user sets minutes OR picks a focus
       level and the app suggests a split
     - store.startSession() / store.endSession() around the timer
     - every distraction -> store.logDistraction(id, type, atMs)
       ('phone' | 'absent'). THIS is what makes Track A's demo land.
     - call announce() on each warning so screen readers get it too

   GOTCHA — read before you start:
   getUserMedia needs a secure context. Opening index.html as a
   file:// URL fails silently. Always serve over localhost:
       python -m http.server 8000
   ============================================================ */

import { store } from './store.js';

export function mount(root) {
  root.innerHTML = `
    <div class="card">
      <h2 class="h2">Focus session</h2>
      <p class="placeholder">Track B mounts here.</p>
    </div>
  `;

  store.subscribe(() => render(root));
}

function render(root) {
  // TODO
}
