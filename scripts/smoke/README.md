# Arena smoke and the vis-003 kit (WP-M2F)

QA tooling for the M2 arena viewer, from [05-technical-m2 §A11](../../docs/design/_drafts/05-technical-m2.md): a zero-dependency Node driver that builds the `smoke` bundle, launches headless Edge (or Chrome) over the DevTools protocol and drives the game, plus the kit that checks vis-003 ("fights are readable").

It is not part of `npm run check` (it needs a browser). Run it before each M2 merge from WP-M2E on, and in QA.

## Run it

```sh
npx tsx scripts/smoke/run.ts                      # build, serve, drive: cross-runtime hash, fixture round, seeded career
npx tsx scripts/smoke/run.ts --no-build           # reuse the last build in reports/smoke/build
npx tsx scripts/smoke/run.ts --only cross         # one journey: cross, fixture, career, vis003
npx tsx scripts/smoke/run.ts --self-test          # test the DRIVER against a built-in mock arena (no game needed)
npx tsx scripts/smoke/run.ts --help               # every option
npx tsx scripts/smoke/vis003/cli.ts <command>     # score, precheck, sheet, template (the vis-003 kit)
```

The package scripts **`smoke:arena`** (`tsx scripts/smoke/run.ts`) and **`smoke:vis003`** (`tsx scripts/smoke/vis003/cli.ts`) are **to be added** by the architect and do not exist yet; the commands above are the same thing. Once they exist, `npm run smoke:arena -- <options>` and `npm run smoke:vis003 -- <command>` do the same. On Windows put Node on the path first (`$env:Path = "C:\Program Files\nodejs;" + $env:Path`).

What a run does, in order:

1. `vite build --mode smoke --outDir reports/smoke/build`, then `vite preview` of that folder on a free port. The `smoke` mode compiles in the test hook and the dev world's fixture round (tech-027); the production build has neither.
2. Launches Edge (else Chrome) headless with a throwaway profile and a DevTools port the browser picks. Override with `--browser <exe>` or `SMOKE_BROWSER`; `--gpu auto|hardware|software` chooses the WebGL source (`auto` takes the GPU if there is one). Profile folders left by earlier runs killed hard (`arena-smoke-profile-*` in the temp folder, older than an hour) are removed first.
3. **cross**: bundles core/sim and the render model for the browser, and simulates six fixed rounds of `content/default` at record level `full` in Chromium and in Node, five passes each. Round checksums and event hashes must be identical across runtimes and across passes (05 §10 "golden hash in Node and Chromium"); the warm passes also time the round load. Needs no viewer, so the hash check runs today.
4. **fixture**: the dev world's fixed round through `window.__arena.viewer` (`loadFixtureRound`, `seek`, `play`, `pause`, `setSpeed`, `frame`, `stats`, `logHash`): first-open time, WebGL context, non-blank canvas, ten ringed tokens, 11 screenshots (1280x720 and 1920x1080, both themes, reduced motion, four colour-vision deficiencies), fps and frame time at 1x and 4x, heap over 20 round loads (each a mount and unmount), the log hash stable across loads.
5. **career**: a seeded new career through the real UI (typed seed, first club of the lowest tier, preseason, kick-off), then **Watch** (the primary Continue button reads "Watch"; "Play match" in an M1.1 build) and the arena: the same render checks, the viewed round's hash against core/game's headless one (`vis-009`), the **frame-time trace across a cursor save** at 4x (an auto-pause stop, the save, the resume; test-first item 5), then the match played on at 4x through the between-round screens to its report.
6. **vis003** (only with `--only vis003`): captures the observer packets, below.
7. Writes `reports/smoke/<run id>/report.json` and `report.md` (and `reports/smoke/latest.*`; a self-test writes `latest-selftest.*` instead); screenshots under `shots/`, the cursor-save trace as `cursor-save-trace.json`. `reports/` is git-ignored.

Exit codes: `0` pass, `1` a check failed, `2` the driver could not start (no browser, build failed), `3` blocked.

## Blocked is not failed, and a skipped check is not a pass

The driver was written against the contract before the viewer and the arena UI existed. A step that needs a piece another package delivers does not guess: it stops its journey, records **what is missing and which package delivers it**, lets the other journeys run, and the verdict is `BLOCKED` (exit 3) unless something actually failed. The same holds for a check that was wanted and could not be made: any skipped check that is not pending by design makes the verdict `BLOCKED`, never `PASS`. Typical blocks:

| Code | Meaning | Delivered by |
| --- | --- | --- |
| `smoke.hook-missing` | `window.__arena` or `window.__arena.viewer` is not in the build | WP-M2E (hook), WP-M2D (viewer) |
| `smoke.hook-incomplete` | the hook lacks `frame`, `seek`, `play`, `pause`, `setSpeed`, `stats` or `logHash` (and `loadFixtureRound` for the fixture journey) | WP-M2E |
| `smoke.watch-missing` | Play match offers no Watch (the build simulates at once, the M1.1 flow) | WP-M2E |
| `smoke.viewer-no-frame` | the arena opened but the viewer drew no frame of ten units | WP-M2D |
| `smoke.core-stub` | `liveRoundPlayback` / `roundPlayback` still throw NotImplementedError, so there is no headless hash to compare | WP-M2B |
| `smoke.state-missing` | there is no game state to replay headless: no `auto-round` save in the page's IndexedDB and no `state()` on the hook; the hash check and the vis-003 key need one | WP-M2E / WP-M2B |
| `career.blocked-by-game` | the career stopped on "Decide first" before the match; the driver makes no decisions (use another `--seed`) | the seed |
| round load not made | `indexFightLog` is not implemented, so the budget (sim plus indexFightLog) cannot be checked | WP-M2C |

## Reading the report

`report.md` opens with the verdict and the setup (build commit, browser, **WebGL renderer**, host; a banner when it is a self-test), then every check as a row: result, what was expected, what was measured, and the contract reference (A10, A11, vis-009...). A **Blocked** section lists the missing pieces and the checks not made. Notes on non-passing checks follow, then the steps with their times, the screenshots, the console, the artifacts. `report.json` has the same plus the raw numbers under `measurements` (interval summaries, the trace analysis with its marks, heap samples, hashes, round-load timings).

- **PASS / FAIL / WARN / SKIP.** SKIP = the check could not be made (its reason is in the notes; it blocks the verdict unless it is pending by design, as the agent-observer check is until the observers have answered). WARN = a frame-rate or frame-time target missed **on software WebGL** (SwiftShader, `llvmpipe`): the targets of A10 are for the reference machine with a GPU, so on software rendering a miss warns instead of failing. `--strict-perf` makes it fail; the report header says plainly when the renderer is software. The round-load and cross-runtime checks are CPU work and never warn.
- **Frame rate** (A10): over steady play only (the stops and the restart are left out; the clock counts as running when the tick moved over the last 12 frames, so a tick that is only updated at 10 Hz works too), median at least 58 fps, p95 interval at most 20 ms, no interval over 33 ms (one skipped vsync is 33.3 ms and still 30 fps; the limit has 0.5 ms of timer jitter on it). Fewer than 60 steady frames fails whatever the machine: the clock did not run long enough.
- **Our CPU per frame** is `viewer.stats().frameMsP95` (at most 4 ms).
- **Round load** (A10): the sim at `full` plus `indexFightLog` in Chromium over warm passes, median at most 15 ms and p99 at most 30 ms. The sim alone is only a lower bound and is never accepted for it.
- **Cursor-save trace.** `phases` splits the frames into `playing` (before the stop), `stopped` (the stop, the save) and `resumed`; `worst` says how long the longest frame was, in which phase, and how many ms from the stop. The marks are `play`, `stopped` (the last frame the clock advanced), `saved`, `resume`, `end`. `stopKind` is `auto` (a real auto-pause stop) or `manual` (none came within 20 s, so the driver paused by hand, which saves the cursor the same way). The page's own `requestAnimationFrame` recorder keeps running while the viewer is stopped, so a save hitch shows as a long frame even though the viewer draws nothing then. The full series is in `cursor-save-trace.json`. The save itself is then read back from the page's IndexedDB (`save.cursor-persisted`).
- **Heap.** A forced GC before each sample, one sample per round load; growth is measured from the sample after 3 warm-up loads (at most 50 MB) and a steady slope over 0.25 MB per load warns. GPU texture memory (32 MB) is not measurable from the page and is not checked.
- **Hashes.** `hash.chromium-eq-node` (cross-runtime), `hash.viewed-eq-headless` (the viewer's `logHash()` against `liveRoundPlayback` in Node, on the round autosave read from the page's IndexedDB; the hook's `state()` is the fallback), `hash.recomputed` (`FightLog.hash` equals `hashEventStream`), `hash.fixture-stable`. A difference is a determinism defect, never a flaky check.
- **Tokens.** For each standing unit of `frame()` the driver finds the ring colour near its projected position in the screenshot: the colours are the page's `--c-side-us` and `--c-side-them` (plus anything the hook's `colors()` returns and `--ring-colors`), the projection is the hook's `project(x, y)` / `viewTransform()` if it has one, else a letterbox of the canvas inside the camera's default padding (56 / 16 / 72 / 16). One colour per side, two sides differ.
- **Watch flow.** `career.watch-flow` passes only when the match's report is open: either directly, or through the result toast at Home. Home with neither fails.
- **Console errors.** Errors, uncaught exceptions and failed requests of every page; the favicon request is ignored, `--allow-console <regex>` ignores more.

The hook is assumed to match the contract (05-technical-m2 §A7): `frame()` returns the latest `ArenaFrameState` (or null when no viewer is mounted; it may be the HUD's frame, updated at 10 Hz) and `loadFixtureRound()` may return before the viewer has mounted (the driver waits for `ready()` and a frame, and leaves the replay route first so a second load really remounts). `tick`, `playing`, `endTick`, `ready`, `project`, `viewTransform`, `colors` and `state()` are used when present and never required. The game state comes from the page's IndexedDB `auto-round` save (only that slot: a different save never stands in for it). If the real hook differs, the single place to adapt is `scripts/smoke/lib/viewer.ts` (hook calls), `lib/selectors.ts` (UI controls) and `page/probe.js` (what is read in the page).

## The self-test

`--self-test` runs the whole driver against `scripts/smoke/mock/index.html`, a small stand-in arena: a WebGL canvas (rectangles by scissor, no shaders), a playback clock, auto-pause stops with a 12 ms "save", a fighter strip with role glyphs, a callout and a feed, and a hook shaped like the game's (a HUD-fed frame at 10 Hz, `ready()`, an asynchronous fixture load). Its round is a real `full` log simulated in Node. It tests the **driver** (CDP, recording, trace analysis, pixel checks, hashes, the vis-003 capture), not the game; use it after changing the driver. Its reports say so in a banner, record `mock` as the build source and go to `latest-selftest.*`; its vis-003 files carry `source: mock` and a banner and are never picked by `--run latest`.

## The vis-003 kit

vis-003 (01 §6): observers watch 5 fights at 1x and each can name both sides' tank and healer and the cause of each down in at least 90% of prompts. Only human observers are evidence for it (A11); the automated proxy and the agent pre-check gate the merge.

| Part | What | Where |
| --- | --- | --- |
| Observer protocol | how the owner watches 5 fights and what to say to observers | [`vis003/PROTOCOL.md`](vis003/PROTOCOL.md) |
| Score sheet | a blank sheet for any fights; for a run's fights, one observer sheet per fight, a tally and the key | [`vis003/SCORE-SHEET.md`](vis003/SCORE-SHEET.md), `sheets/fight-N.md`, `owner-tally.md`, `owner-answer-key.md` |
| Capture | plays the seeded career at 1x, takes numbered screenshots on a fixed schedule, writes the packets, keys and evidence | `npx tsx scripts/smoke/run.ts --only vis003 [--seed s] [--fights 5]` |
| Automated proxy | from the DOM evidence at every capture and the fight log: is each tank and healer identifiable (role glyphs agree with the classes) and is every down's victim, credited fighter and ability named on screen within the callout's life | runs at the end of the capture; `vis003/cli.ts precheck` re-runs it |
| Agent observer | an agent looks at the screenshot sequence of a fight and answers the prompts; scored against the key | below |

An observer is never told who went down, when, or how many downs there were: the prompts are four role questions and one "list every fighter that went down and who or what downed them", and the packet reveals nothing either. Its frames are numbered (`frame-01.png`, no tick in the name) and taken on a fixed schedule that does not depend on the downs (tick 10, then every 30 ticks, 1.5 s, which is under the 2 s life of a callout, then the last tick), so their count follows the fight's length only; a stop adds no frame. The captures that bracket each down (just before it, at its callout, later in the callout's life) exist only as text in the scorer's private `evidence/` file, with no picture, and feed the on-screen proxy. The capture asserts that the log the answer key came from is the log on screen (the viewer's hash equals the key's) before it captures a fight, so a stale save cannot key the wrong fight.

`--only vis003` writes `reports/smoke/<run>/vis003/`:

```
packets/fight-N/frames/frame-01.png ...    the screenshots of one fight, in order (the observer's whole world)
packets/fight-N/prompts.json               the prompts (no victims, no times)
packets/fight-N/observer-brief.md          what to tell an agent observer: rules, prompts, the JSON to reply with
sheets/fight-N.md                          the sheet a person fills in for one fight, handed over after that fight
keys/fight-N.key.json                      the answer key from the fight log (tanks, healers, every down and who is credited)
evidence/fight-N.json                      what the screen said at each capture, with the private down-bracketing captures (text, live regions, role glyphs)
owner-tally.md / owner-answer-key.md       the tally to fill in per observer, and the key to mark the sheets with
answers-template.json, manifest.json (with source: game or mock), evidence-score.json
```

### Running the agent pre-check

1. Capture: `npx tsx scripts/smoke/run.ts --only vis003` (about as long as five fights at 1x, 4 to 8 minutes).
2. One observer agent per fight, **fresh, with no repository context** (it must see nothing but the pictures; a vision-capable Sonnet is enough). Give it only this, with the paths filled in, and the same observer name for every fight so the five answers are scored as one observer:

   > You are observer `agent-A`. Read `<run>/vis003/packets/fight-N/observer-brief.md` and look at the PNG files in `<run>/vis003/packets/fight-N/frames/` in order. Open nothing else. Reply with the JSON object the brief asks for, using the observer name `agent-A`.

3. Save each reply as a file (a code fence or a line of prose around the JSON is fine), then score: `npx tsx scripts/smoke/vis003/cli.ts score --run latest --answers a1.json --answers a2.json ...` (add `--strict-ability` to require the ability too, `--min 85` to change the bar). Run a second set of agents under another name to get a second observer.
4. The score report (`score-<time>.md` and `.json` in the `vis003` folder) lists every wrong or unanswered prompt with the reason; `precheck` prints the proxy. The pre-check gates the merge when every observer reaches 90% and the proxy is 100%.

Matching is plain and explained in each result: an answer names a fighter by name, first name or class. A tank or healer prompt is right when every fighter of that side the answer names holds the role (a hybrid holds both); "none" is right when the side has none. A down is right when a listed entry names its victim and its cause names the **one fighter credited** with the down (the sim credits the fighter whose single largest hit of that tick took the victim down; assists are not credited), with the ability only under `--strict-ability`. Naming several enemies for one down is wrong, and so are "unclear", "unknown" and blanks, everywhere. A down the observer did not list is a missed prompt; a listed down that never happened is reported and not counted. The same rules are in PROTOCOL.md and SCORE-SHEET.md.

### What the proxy can and cannot say

The proxy reads the DOM (text, live regions, `[data-role]` elements and the text of their row), so it can confirm that the strip shows the right glyph for every fighter and that a callout or feed entry names victim, credited fighter and ability. It cannot see the canvas: whether the ring, glyph and bars on a token are legible is what the agent observer and the humans are for. Ring colours on every token are checked separately by the smoke's token census.

## Files

```
run.ts                    the driver (npx tsx scripts/smoke/run.ts; package script smoke:arena to be added)
lib/                      field (the field found in a screenshot), overtime (the HUD in overtime), arena-ui (the arena's own Play button), cdp (WebSocket client), browser (find, launch, clean up, the process-safety guard), page (a driven page), serve (build, preview,
                          static), viewer (the hook), saves (the page's IndexedDB saves), checks and stats (pure check logic), report (types, verdict,
                          markdown), png, options, selectors, headless
tools/overtime-seed.ts    finds career seeds whose first match reaches overtime (headless, core/game)
journeys/                 cross-hash, fixture, career, arena-steps (shared), vis003-capture, mock (self-test)
cross/                    the cross-runtime cases and the browser entry
page/probe.js             injected into every page: the rAF recorder, finders, evidence, the save reader (plain JavaScript on purpose)
mock/index.html           the self-test arena
vis003/                   key, prompts, plan, score, answers, evidence, packet, runs, cli; PROTOCOL.md, SCORE-SHEET.md
fixtures/                 a trace recorded from the mock arena, for the trace-analysis tests
```

## Gotchas

- **Edge exits with code 0 and keeps running** when `__COMPAT_LAYER` is set (some hosts set it, e.g. `DetectorsAppHealth` under Claude Code on Windows): `msedge.exe` re-launches itself detached, so the launcher is gone and a naive `taskkill` of its tree leaks the real browser. The driver drops the variable and, on close, also kills every Edge or Chrome whose command line names its throwaway profile folder. Nothing that kills or deletes runs for a name that is not `arena-smoke-profile-` plus six letters or digits directly in the temp folder (`isOwnProfile`), so a person's own browser or an empty name can never match. Ctrl+C, a kill, a crash and an unhandled rejection clean up too, from the moment the profile folder exists. If a run is killed hard and browsers are left, look for `arena-smoke-profile-` in their command lines.
- A seeded career must reach the day of the match without a "Decide first" stop; the driver makes no decisions (that is reported as blocked). If a seed's club starts blocked, pick another with `--seed`.
- Ticks are 50 ms; 20 ticks are one second.
