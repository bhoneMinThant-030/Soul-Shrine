import { store } from './store.js';
import { openWith } from './reframe.js';

// The two advice cards are shortcuts into the same reframing engine, but
// each seeds a different starting thought — otherwise they're one button
// wearing two hats.
const ADVICE = {
  exam: "I'm going to freeze in the exam and forget everything I revised",
};

let root = null;

export function mount(el) {
  root = el;
  render();
  store.subscribe(render);
}

function go(screen) {
  document.querySelector(`.tab[data-screen="${screen}"]`)?.click();
}

function render() {
  if (!root) return;
  const user = store.user;
  const stats = store.todayStats;
  const name = user.name || 'there';
  const firstName = name.split(/\s+/)[0];

  root.innerHTML = `
    <div class="home-greeting">
      <h1>Morning, ${esc(firstName)}</h1>
      <p>Let's find your focus today.</p>
    </div>

    <button class="focus-hero" id="home-focus" aria-label="Start a 25 minute deep focus session">
      <span class="focus-hero-copy">
        <strong>Deep Focus<br>Session</strong>
        <span>Eliminate distractions and dive in.</span>
        <small>◷ &nbsp;25 Min</small>
      </span>
      <span class="play-disc" aria-hidden="true">▶</span>
    </button>

    <section class="advice-section" aria-labelledby="advice-title">
      <div class="section-heading">
        <h2 id="advice-title">AI Advice for You</h2>
        <button class="see-all" id="home-advice">See All</button>
      </div>
      <button class="advice-card advice-card-blue" data-advice="exam">
        <span class="advice-copy">
          <strong>Exam Stress</strong>
          <span>Name the thought that's spiralling, and see it against your own record.</span>
        </span>
        <i class="mini-play" aria-hidden="true">▶</i>
      </button>
    </section>

    <p class="home-proof">${stats.focusedMin ? `${stats.focusedMin} focused minutes logged today.` : 'A small block today can make tomorrow feel lighter.'}</p>
  `;

  root.querySelector('#home-focus').addEventListener('click', () => go('focus'));
  root.querySelector('#home-advice').addEventListener('click', () => go('reframe'));
  root.querySelectorAll('[data-advice]').forEach(card =>
    card.addEventListener('click', () => {
      go('reframe');
      openWith(ADVICE[card.dataset.advice] || '');
    }));
  root.querySelector('#home-mood').addEventListener('click', () => {
    window.announce?.('Mood logging will be available from your profile.');
  });
}

function esc(value) {
  return String(value).replace(/[&<>\"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
}
