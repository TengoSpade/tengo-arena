# Arena smoke and the vis-003 kit (WP-M2F)

QA tooling for the M2 arena viewer, from [05-technical-m2 §A11](../../docs/design/_drafts/05-technical-m2.md): a zero-dependency Node driver that builds the `smoke` bundle, launches headless Edge (or Chrome) over the DevTools protocol and drives the game, plus the kit that checks vis-003 ("fights are readable").

It is not part of `npm run check` (it needs a browser). Run it before each M2 merge from WP-M2E on, and in QA.

## Run it

```sh
npm run smoke:arena                        # build, serve, drive: cross-runtime hash, fixture round, seeded career
npm run smoke:arena -- --no-build          # reuse the last build in reports/smoke/build
npm run smoke:arena -- --only cross        # one journey: cross, fixture, career, vis003
npm run smoke:arena -- --self-test         # test the DRIVER against a built-in mock arena (no game needed)
npm run smoke:arena -- --help              # every option
```

The package scripts (`smoke:arena`, `smoke:vis003`) are added by the architect; until then run `npx tsx scripts/smoke/run.ts` and `npx tsx scripts/smoke/vis003/cli.ts`. On Windows put Node on the path first (`$env:Path = "C:\Program Files\nodejs;" + $env:Path`).

What a run does, in order:

1. `vite build --mode smoke --outDir reports/smoke/build`, then `vite preview` of that folder on a free port. The `smoke` mode compiles in the test hook and the dev world's fixture round (tech-027); the production build has neither.
2. Launches Edge (else Chrome) headless with a throwaway profile and a DevTools port the browser picks. Override with `--browser <exe>` or `SMOKE_BROWSER`; `--gpu auto|hardware|software` chooses the WebGL source (`auto` takes the GPU if there is one).
3. **cross**: bundles core/sim for the browser and simulates six fixed rounds of `content/default` at record level `full` in Chromium and in Node. Round checksums and event hashes must be identical (05 §10 "golden hash in Node and Chromium"). Needs no viewer, so it runs today.
4. **fixture**: the dev world's fixed round through `window.__arena.viewer` (`loadFixtureRound`, `seek`, `play`, `pause`, `setSpeed`, `frame`, `stats`, `logHash`): first-open time, WebGL context, non-blank canvas, ten ringed tokens, 11 screenshots (1280x720 and 1920x1080, both themes, reduced motion, four colour-vision deficiencies), fps and frame time at 1x and 4x, heap over 20 round loads, the log hash stable across loads.
5. **career**: a seeded new career through the real UI (typed seed, first club of the lowest tier, preseason, kick-off, Play match), then **Watch** and the arena: the same render checks, the viewed round's hash against core/game's headless one (`vis-009`), the **frame-time trace across a cursor save** at 4x (an auto-pause stop, the save, the resume; test-first item 5), then the match played on at 4x through the between-round screens to its report.
6. **vis003** (only with `--only vis003`): captures the observer packets, below.
7. Writes `reports/smoke/<run id>/report.json` and `report.md` (and `reports/smoke/latest.*`); screenshots under `shots/`, the cursor-save trace as `cursor-save-trace.json`. `reports/` is git-ignored.

Exit codes: `0` pass, `1` a check failed, `2` the driver could not start (no browser, build failed), `3` blocked.

## Blocked is not failed

The driver was written against the contract before the viewer and the arena UI existed. A step that needs a piece another package delivers does not guess: it stops its journey, records **what is missing and which package delivers it**, lets the other journeys run, and the verdict is `BLOCKED` (exit 3) unless something actually failed. Typical blocks:

| Code | Meaning | Delivered by |
| --- | --- | --- |
| `smoke.hook-missing` | `window.__arena` or `window.__arena.viewer` is not in the build | WP-M2E (hook), WP-M2D (viewer) |
| `smoke.hook-incomplete` | the hook lacks `frame`, `seek`, `play`, `pause`, `setSpeed`, `stats`, `logHash` or `loadFixtureRound` | WP-M2E |
| `smoke.watch-missing` | Play match offers no Watch (the build simulates at once, the M1.1 flow) | WP-M2E |
| `smoke.viewer-no-frame` | the arena opened but the viewer drew no frame of ten units | WP-M2D |
| `smoke.core-stub` | `liveRoundPlayback` / `roundPlayback` still throw NotImplementedError, so there is no headless hash to compare | WP-M2B |
| `smoke.state-missing` | the hook has no `state()`; the vis-003 key and the hash comparison need the game state | WP-M2E |

## Reading the report

`report.md` opens with the verdict and the setup (build commit, browser, **WebGL renderer**, host), then every check as a row: result, what was expected, what was measured, and the contract reference (A10, A11, vis-009...). Notes on non-passing checks follow, then the steps with their times, the screenshots, the console, the artifacts. `report.json` has the same plus the raw numbers under `measurements` (interval summaries, the trace analysis with its marks, heap samples, hashes).

- **PASS / FAIL / WARN / SKIP.** SKIP = the check could not be made (its reason is in the notes). WARN = a performance target missed **on software WebGL** (SwiftShader, `llvmpipe`): the targets of A10 are for the reference machine with a GPU, so on software rendering a miss warns instead of failing. `--strict-perf` makes it fail; the report header says plainly when the renderer is software.
- **Frame rate** (A10): over steady play only (the stops and the restart are left out), median at least 58 fps, p95 interval at most 20 ms, no interval over 33 ms (one skipped vsync is 33.3 ms and still 30 fps; the limit has 0.5 ms of timer jitter on it). Fewer than 60 steady frames fails whatever the machine: the clock did not run long enough.
- **Our CPU per frame** is `viewer.stats().frameMsP95` (at most 4 ms).
- **Cursor-save trace.** `phases` splits the frames into `playing` (before the stop), `stopped` (the stop, the save) and `resumed`; `worst` says how long the longest frame was, in which phase, and how many ms from the stop. The marks are `play`, `stopped` (the last frame the clock advanced), `saved`, `resume`, `end`. `stopKind` is `auto` (a real auto-pause stop) or `manual` (none came within 20 s, so the driver paused by hand, which saves the cursor the same way). The page's own `requestAnimationFrame` recorder keeps running while the viewer is stopped, so a save hitch shows as a long frame even though the viewer draws nothing then. The full series is in `cursor-save-trace.json`.
- **Heap.** A forced GC before each sample, one sample per round load; growth is measured from the sample after 3 warm-up loads (at most 50 MB) and a steady slope over 0.25 MB per load warns. GPU texture memory (32 MB) is not measurable from the page and is not checked.
- **Hashes.** `hash.chromium-eq-node` (cross-runtime), `hash.viewed-eq-headless` (the viewer's `logHash()` against `liveRoundPlayback` in Node on the page's own state), `hash.recomputed` (`FightLog.hash` equals `hashEventStream`), `hash.fixture-stable`. A difference is a determinism defect, never a flaky check.
- **Tokens.** For each standing unit of `frame()` the driver finds the ring colour near its projected position in the screenshot: the colours are the page's `--c-side-us` and `--c-side-them` (plus anything the hook's `colors()` returns and `--ring-colors`), the projection is the hook's `project(x, y)` / `viewTransform()` if it has one, else a letterbox of the canvas inside the camera's default padding (56 / 16 / 72 / 16). One colour per side, two sides differ.
- **Console errors.** Errors, uncaught exceptions and failed requests of every page; the favicon request is ignored, `--allow-console <regex>` ignores more.

The hook is assumed to match the contract (05-technical-m2 §A7): `frame()` returns an `ArenaFrameState`; `tick`, `playing`, `endTick`, `project`, `viewTransform`, `colors` and `state()` (the `GameState`, as the dev hook has it) are used when present and never required, except `state()` for the hash and vis-003 checks. If the real hook differs, the single place to adapt is `scripts/smoke/lib/viewer.ts` (hook calls), `lib/selectors.ts` (UI controls) and `page/probe.js` (what is read in the page).

## The self-test

`--self-test` runs the whole driver against `scripts/smoke/mock/index.html`, a small stand-in arena: a WebGL canvas (rectangles by scissor, no shaders), a playback clock, auto-pause stops with a 12 ms "save", a fighter strip with role glyphs, a callout and a feed. Its round is a real `full` log simulated in Node. It tests the **driver** (CDP, recording, trace analysis, pixel checks, hashes, the vis-003 capture), not the game; use it after changing the driver. It reports `mock` as the build source.

## The vis-003 kit

vis-003 (01 §6): observers watch 5 fights at 1x and each can name both sides' tank and healer and the cause of each down in at least 90% of prompts. Only human observers are evidence for it (A11); the automated proxy and the agent pre-check gate the merge.

| Part | What | Where |
| --- | --- | --- |
| Observer protocol | how the owner watches 5 fights and what to say to observers | [`vis003/PROTOCOL.md`](vis003/PROTOCOL.md) |
| Score sheet | blank sheet for any fights; a ready one for a run's 5 fights with its key | [`vis003/SCORE-SHEET.md`](vis003/SCORE-SHEET.md), `owner-sheet.md`, `owner-answer-key.md` |
| Capture | plays the seeded career at 1x, takes screenshots at the planned moments, writes the packets, keys and evidence | `npm run smoke:arena -- --only vis003 [--seed s] [--fights 5] [--every 4]` |
| Automated proxy | from the DOM evidence at every capture and the fight log: is each tank and healer identifiable (role glyphs agree with the classes) and is every down's victim, killer and ability named on screen within the callout's life | runs at the end of the capture; `npm run smoke:vis003 -- precheck` re-runs it |
| Agent observer | an agent looks at the screenshot sequence of a fight and answers the prompts; scored against the key | below |

`--only vis003` writes `reports/smoke/<run>/vis003/`:

```
packets/fight-N/frames/f01-t0010.png ...   the screenshots of one fight, in order (the observer's whole world)
packets/fight-N/prompts.json               the prompts (no answers)
packets/fight-N/observer-brief.md          what to tell an agent observer: rules, prompts, the JSON to reply with
keys/fight-N.key.json                      the answer key from the fight log (tanks, healers, every down and its cause)
evidence/fight-N.json                      what the screen said at each capture (text, live regions, role glyphs)
owner-sheet.md / owner-answer-key.md       the owner's sheet for these fights, and the key to tick it with
answers-template.json, manifest.json, evidence-score.json
```

### Running the agent pre-check

1. Capture: `npm run smoke:arena -- --only vis003` (about as long as five fights at 1x, 4 to 8 minutes).
2. One observer agent per fight, **fresh, with no repository context** (it must see nothing but the pictures; a vision-capable Sonnet is enough). Give it only this, with the paths filled in, and the same observer name for every fight so the five answers are scored as one observer:

   > You are observer `agent-A`. Read `<run>/vis003/packets/fight-N/observer-brief.md` and look at the PNG files in `<run>/vis003/packets/fight-N/frames/` in order. Open nothing else. Reply with the JSON object the brief asks for, using the observer name `agent-A`.

3. Save each reply as a file (a code fence or a line of prose around the JSON is fine), then score: `npm run smoke:vis003 -- score --run latest --answers a1.json --answers a2.json ...` (add `--strict-ability` to require the ability too, `--min 85` to change the bar). Run a second set of agents under another name to get a second observer.
4. The score report (`score-<time>.md` and `.json` in the `vis003` folder) lists every wrong or unanswered prompt with the reason; `smoke:vis003 -- precheck` prints the proxy. The pre-check gates the merge when every observer reaches 90% and the proxy is 100%.

Matching is plain and explained in each result: an answer names a fighter by name, first name or class. A tank or healer prompt is right when every fighter of that side the answer names holds the role (a hybrid holds both); "none" is right when the side has none. A down prompt is right when the answer names the fighter that struck the last blow (the ability only with `--strict-ability`); an answer that lists more than three enemies is wrong; "unclear" and blanks are wrong.

### What the proxy can and cannot say

The proxy reads the DOM (text, live regions, `[data-role]` elements and the text of their row), so it can confirm that the strip shows the right glyph for every fighter and that a callout or feed entry names victim, killer and ability. It cannot see the canvas: whether the ring, glyph and bars on a token are legible is what the agent observer and the humans are for. Ring colours on every token are checked separately by the smoke's token census.

## Files

```
run.ts                    the driver (npm run smoke:arena)
lib/                      cdp (WebSocket client), browser (find, launch, clean up), page (a driven page), serve (build, preview, static),
                          viewer (the hook), checks and stats (pure check logic), report (types, verdict, markdown), png, options, selectors, headless
journeys/                 cross-hash, fixture, career, arena-steps (shared), vis003-capture, mock (self-test)
cross/                    the cross-runtime cases and the browser entry
page/probe.js             injected into every page: the rAF recorder, finders, evidence (plain JavaScript on purpose)
mock/index.html           the self-test arena
vis003/                   key, prompts, plan, score, answers, evidence, packet, cli; PROTOCOL.md, SCORE-SHEET.md
fixtures/                 a trace recorded from the mock arena, for the trace-analysis tests
```

## Gotchas

- **Edge exits with code 0 and keeps running** when `__COMPAT_LAYER` is set (some hosts set it, e.g. `DetectorsAppHealth` under Claude Code on Windows): `msedge.exe` re-launches itself detached, so the launcher is gone and a naive `taskkill` of its tree leaks the real browser. The driver drops the variable and, on close, also kills every Edge or Chrome whose command line names its throwaway profile folder (and only that). If a run was killed hard and browsers are left, look for `arena-smoke-profile-` in their command lines.
- A seeded career must reach "Play match" without a "Decide first" stop; the driver makes no decisions. If a seed's club starts blocked, pick another with `--seed`.
- Ticks are 50 ms; 20 ticks are one second.
