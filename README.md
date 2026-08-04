# Soul Shrine

Mental wellness app — HKIIT × TPIIT competition prototype.

Three pillars that feed one loop: the camera notices you got distracted → that
becomes data → when you spiral, the AI reframes your thought using **your own
focus data and past wins**, not generic encouragement.

---

## Run it

`getUserMedia` and ES modules both need a secure context — opening
`index.html` as a `file://` URL fails silently. Always serve over localhost:

```bash
python -m http.server 8000
```

Then open <http://localhost:8000>.

---

## File ownership — the rule that prevents merge conflicts

**Only edit the files you own.** Every merge conflict this project can have
comes from breaking this table.

| File | Owner | Status |
|---|---|---|
| `index.html` | — | **FROZEN** |
| `css/base.css` | — | **FROZEN** |
| `js/app.js` | — | **FROZEN** |
| `js/reframe.js`, `css/reframe.css` | Track A — Psychological | |
| `js/focus.js`, `js/vision.js`, `css/focus.css` | Track B — Cognitive | |
| `js/social.js`, `css/social.css` | Track C — Social | |
| `js/store.js`, `js/seed.js` | Track C (A + B read only) | |

Frozen files are complete. If you genuinely need a change to one, say so in the
group chat and let **one person** make it in **one commit** — never edit a
frozen file on your own branch.

**CSS:** prefix your classes — `.rf-` (A), `.fc-` (B), `.sc-` (C).

**Need a CDN library?** Don't add a `<script>` tag to the frozen `index.html`.
Inject it from your own JS — see `loadModel()` in `js/vision.js` for the pattern.

---

## How the screens connect

`index.html` has three empty mount points. Each track renders its own markup
into its own div from its own JS file. Nobody writes HTML into a shared file.

```
#focus-root    ← js/focus.js    mount(root)
#reframe-root  ← js/reframe.js  mount(root)
#social-root   ← js/social.js   mount(root)
```

`js/store.js` is the shared brain and the only cross-track surface:

```js
store.todayStats        // { focusedMin, plannedMin, distractionCount,
                        //   lateHalfShare, weekAvgFocusedMin }
store.user              // { name, modules, wins, struggles, studyStyle }
store.startSession(min) // → session object
store.logDistraction(id, 'phone' | 'absent', atMs)
store.endSession(id, focusedMin)
store.addReframe({ input, distortion, response })
store.setStudyStyle(style)
store.subscribe(fn)     // re-render on change; returns unsubscribe
store.reset()           // wipe back to the seeded persona (demo escape hatch)
```

`announce('...')` is global — call it on anything a screen reader should hear
(camera warnings especially).

---

## Git

```bash
git checkout -b track/psych    # A
git checkout -b track/focus    # B
git checkout -b track/social   # C
```

Merge to `main` at the two checkpoints — not continuously, not once at the end.

---

## Schedule

| Time | What |
|---|---|
| 0:20 | Skeleton pushed, everyone branched |
| 0:50 | A has a live API call. B has the webcam rendering. **Blockers surface here.** |
| 2:15 | **Merge #1** — everything mounts together, even if half-built |
| 3:15 | **Merge #2 — feature freeze.** Bugfixes only. |
| 3:30 | **Record the backup demo video.** Non-negotiable. |
| 4:30 | Code frozen. Everyone on slides + script. |
| 6:00 | Two full rehearsals with a timer. |

---

## Evidence base (cite these — they're worth bonus marks)

- **Cognitive:** Gloria Mark (UC Irvine) — ~23 minutes to return to a task after
  an interruption.
- **Psychological:** Beck — cognitive restructuring, the CBT mechanism the
  reframe feature implements.
- **Social:** Walton & Cohen (2011, *Science*) — brief social-belonging
  interventions improved academic and health outcomes.

Verify the exact figures before they go on a slide.
