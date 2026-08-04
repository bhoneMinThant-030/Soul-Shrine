/* ============================================================
   TRACK A — Psychological.  Owner: <your name>
   Files you own: js/reframe.js, css/reframe.css
   Do not edit any other file.

   Build:
     - textarea for the negative thought
     - call Claude -> { distortion, reframe }
     - name the cognitive distortion BEFORE reframing (CBT
       cognitive restructuring — this is the evidence-based bonus)
     - inject store.user.wins + store.todayStats into the prompt so
       the reframe cites real data, not generic encouragement
     - crisis path: if the input suggests self-harm, skip the
       reframe entirely and surface SG/HK helplines
     - history list of past reframes

   FIRST 30 MINUTES: get one successful API call working. Browser
   calls need `anthropic-dangerous-direct-browser-access: true`
   alongside x-api-key and anthropic-version. Find that out now,
   not at hour three.
   ============================================================ */

import { store } from './store.js';

export function mount(root) {
  root.innerHTML = `
    <div class="card">
      <h2 class="h2">Reframe</h2>
      <p class="placeholder">Track A mounts here.</p>
    </div>
  `;

  // Re-render whenever shared state changes.
  store.subscribe(() => render(root));
}

function render(root) {
  // TODO
}
