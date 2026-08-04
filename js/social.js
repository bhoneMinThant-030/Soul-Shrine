/* ============================================================
   TRACK C — Social + shared plumbing.  Owner: <name>
   Files you own: js/social.js, css/social.css, js/store.js, js/seed.js
   Do not edit any other file.

   Build:
     - "Study Personality" quiz -> store.setStudyStyle()
       Match on study-relevant behaviour, NOT MBTI: session length,
       quiet vs talkative, morning vs night, deadline-driven vs
       steady. Same fun quiz, same result card — but defensible if
       a judge knows the personality-typing literature.
     - study rooms listing SEED.people; joining is a UI state change
     - DO NOT build real-time multiplayer

   You also own, because this track is lighter:
     - keeping seed.js rich (Track A's demo quality depends on it)
     - the accessibility pass across ALL THREE screens at ~T+3:00
       (keyboard nav, focus rings, alt text, contrast, aria-live)
   ============================================================ */

import { store } from './store.js';

export function mount(root) {
  root.innerHTML = `
    <div class="card">
      <h2 class="h2">Study together</h2>
      <p class="placeholder">Track C mounts here.</p>
    </div>
  `;

  store.subscribe(() => render(root));
}

function render(root) {
  // TODO
}
