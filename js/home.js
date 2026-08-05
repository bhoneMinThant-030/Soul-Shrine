import { store } from './store.js';
import { openWith } from './reframe.js';

// The advice card is a shortcut into the reframing engine with a starting
// thought already in the box — otherwise it's a button that opens a blank page.
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

const DAILY_GOAL_MIN = 60;

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Morning';
  if (h < 18) return 'Afternoon';
  return 'Evening';
}

/**
 * Consecutive days ending today (or yesterday, if today hasn't started yet)
 * with at least one session. Derived from real history — the card used to
 * read user.streakDays, which nothing ever set, so it always showed 0.
 */
function streakDays() {
  const days = new Set((store.state.sessions || []).map(s => s.date));
  if (!days.size) return 0;

  const iso = d => d.toISOString().slice(0, 10);
  const cursor = new Date();

  // A streak shouldn't break just because you haven't studied yet today.
  if (!days.has(iso(cursor))) cursor.setDate(cursor.getDate() - 1);

  let count = 0;
  while (days.has(iso(cursor))) {
    count += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return count;
}

function render() {
  if (!root) return;

  const user = store.user;
  const stats = store.todayStats;
  const firstName = (user.name || 'there').split(/\s+/)[0];

  const live = (store.friends || []).filter(f => f.status === 'in-session').slice(0, 2);
  const lastReframe = (store.state.reframes || [])[0];
  const streak = streakDays();
  const goalPct = Math.min(100, Math.round((stats.focusedMin / DAILY_GOAL_MIN) * 100));

  root.innerHTML = `
    <div class="home-greeting">
      <h1>${greeting()}, ${esc(firstName)}</h1>
      <p>${stats.focusedMin
            ? `${stats.focusedMin} focused minutes so far today.`
            : "Let's find your focus today."}</p>
    </div>

    <button class="focus-hero" id="home-focus" aria-label="Start a 25 minute deep focus session">
      <span class="focus-hero-copy">
        <strong>Deep Focus<br>Session</strong>
        <span>The camera watches for your phone so you don't have to.</span>
        <small>◷ &nbsp;25 Min</small>
      </span>
      <span class="play-disc" aria-hidden="true">▶</span>
    </button>

    <div class="home-goal">
      <div class="home-goal-head">
        <span>Today's goal</span>
        <span class="home-goal-count"><strong>${stats.focusedMin}</strong> / ${DAILY_GOAL_MIN} min</span>
      </div>
      <div class="home-goal-track" role="progressbar" aria-valuemin="0"
           aria-valuemax="${DAILY_GOAL_MIN}" aria-valuenow="${stats.focusedMin}"
           aria-label="Focused minutes today">
        <div class="home-goal-fill" style="width: ${goalPct}%"></div>
      </div>
    </div>

    <div class="home-stats">
      <div class="home-stat">
        <strong>${stats.weekAvgFocusedMin}</strong><span>min avg session</span>
      </div>
      <div class="home-stat">
        <strong>${stats.distractionCount}</strong><span>distraction${stats.distractionCount === 1 ? '' : 's'} today</span>
      </div>
      <div class="home-stat ${streak ? 'is-live' : ''}">
        <strong>${streak}</strong><span>day streak</span>
      </div>
    </div>

    ${live.length ? `
      <section class="home-section">
        <div class="section-heading">
          <h2>Studying now</h2>
          <button class="see-all" data-go="social">See all</button>
        </div>
        <ul class="home-live">
          ${live.map(f => `
            <li>
              <span class="home-live-avatar">${f.avatar}</span>
              <span class="home-live-who">
                <strong>${esc(f.name)}</strong>
                <small>${esc(f.module)} · ${f.startedMinAgo} min in</small>
              </span>
              <span class="home-live-dot" aria-hidden="true"></span>
            </li>`).join('')}
        </ul>
      </section>` : ''}

    <section class="home-section">
      <div class="section-heading">
        <h2>Feeling stuck?</h2>
        <button class="see-all" data-go="reframe">Open advice</button>
      </div>

      <button class="advice-card advice-card-blue" data-advice="exam">
        <span class="advice-copy">
          <strong>Exam Stress</strong>
          <span>Name the thought that's spiralling, and see it against your own record.</span>
        </span>
        <i class="mini-play" aria-hidden="true">▶</i>
      </button>

      ${lastReframe ? `
        <button class="home-last" data-go="reframe">
          <small>Last time you wrote</small>
          <span>“${esc(lastReframe.input)}”</span>
          <em>${esc(lastReframe.distortion || '')}</em>
        </button>` : ''}
    </section>
  `;

  // Optional-chained: removing a card from the markup above should change
  // the page, not throw and take the rest of the app down with it.
  root.querySelector('#home-focus')?.addEventListener('click', () => go('focus'));

  root.querySelectorAll('[data-go]').forEach(el =>
    el.addEventListener('click', () => go(el.dataset.go)));

  root.querySelectorAll('[data-advice]').forEach(card =>
    card.addEventListener('click', () => {
      go('reframe');
      openWith(ADVICE[card.dataset.advice] || '');
    }));
}

function esc(value) {
  return String(value).replace(/[&<>"]/g, char =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
}
