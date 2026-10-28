# Technical addendum: M2 "Arena viewer" contracts and work packages

> Addendum to [05](../05-technical-design-principles-and-build-plan.md) (§3, §5, §6, §8, §9.2, §10) for M2. Architect, 2026-10-27. Branch `m2/contracts` from main @ 5eb87cd.
> **DRAFT, no authority.** Nothing here binds until the owner approves it; the owner reviews it before any implementation starts. Owner requirements and O-decisions stay REQUIRED (T1, T4, R1, V1, G1, O1, O12, O20, O22, O24, O33, D-J under O25's confirmation rules); every design choice this document needs and the package does not settle is a working assumption marked **OPEN**, with an owner question in §A14 (numbered Q53–Q59 as proposals; the lead designer assigns the final numbers in 01 §8.5, which this addendum does not edit). Technical choices are `tech-015` to `tech-025` (§A12); the owner may override any of them.
> The contracts phase (this branch) adds typed stubs only: no game behaviour changed, `npm run check` is green and the soak is unaffected (§A1).

## A0. Summary

M2 lets the player **watch his own match live** and **replay any match whose record is still kept**, in a PixiJS v8 arena at 1x/2x/4x with pause (T1), with a pause inspector, live rule badges (P-22) and auto-pause (P-01), using placeholder shapes that a sprite skin can replace later (T1, O22, open-032).

The central choice (tech-015): **the viewer plays back a round that core simulated headlessly at record level `full`, and core re-simulates the round whenever an input (a call) changes it.** The viewer never steps the sim. What the player sees is, by construction, the output of the same pure function headless play uses on the same inputs (vis-009, pillar 4), so the determinism test is a hash comparison, not a parity argument. §A2 gives the reasoning against lockstep.

Calls (P-01) do not fit M2 cleanly: the owner has not answered Q17 and sys-calls (the call kinds, the captain's relay, the AI call policy) is unwritten (03 §3.5). The recommendation is to **stage them** (§A6, Q53): M2 ships pause, inspector, auto-pause, rule badges, replays and Watch or Simulate; the calls package follows once the owner answers and the combat designer specifies sys-calls. The code reserves everything calls need now (inputs, records, command, event type, log swap), so adding them needs no save redesign and no viewer redesign.

## A1. What the contracts phase delivered (branch `m2/contracts`)

| Area | Delivered | Where |
| --- | --- | --- |
| Event model | `FIGHT_LOG_FORMAT_VERSION` (1; format 2 planned: frames gain shield and focus); `FightHeader.logFormat?`; `FrameUnit` optional `shield`, `focus`; `RuleTraceEntry` gains the detail the sim already records at `full` (`reason`, `cond`, `observed`, `readyInTicks`); reserved event type `call.issue` (never emitted) | `src/core/model/events.ts` |
| Match model | Reserved call types `FightCall`, `SideCallPlan`, `RoundCalls`; `RoundInput.calls?`; `RoundLineups.calls?`; `MatchViewMode`; `LiveWatch` and `MatchState.watch?`; `RoundResult.eventHash` documented for watched rounds | `src/core/model/match.ts` |
| Commands | `match.watch` (the watch cursor) and `match.call` (reserved); both refused with stable codes until their packages land | `src/core/model/commands.ts`, `src/core/game/commands.ts` |
| core/game API | `AdvanceOptions` (`playerMatch: 'watch' | 'simulate'`, accepted and ignored for now), `AdvanceOutcome.watch?`, `WatchPause`; stubs `liveRoundPlayback`, `roundPlayback`, `matchPlayback`, `replayAvailability`, `inspectPlayback`; types `RoundPlayback`, `MatchPlayback`, `ReplayAvailability` | `src/core/game/playback.ts`, `live.ts`, `engine.ts`, `index.ts` |
| core/sim API | Stub `inspectRoundAt(input, roundSeed, content, tick): RoundProbe` with `UnitProbe` | `src/core/sim/index.ts` |
| src/render | Pure half: contract types, render-state model (`indexFightLog`, `sampleAt`, `eventsBetween`, `decisionAt`, `autoPauseStops`, `keyMoments`, `samePrefix`), cues (`buildCueTable`), colours (`colorsForMatch`, `contrastRatio`, `parseHexColor`), camera (`DEFAULT_CAMERA`, `viewTransform`), `DEFAULT_AUTO_PAUSE`. PixiJS half: `createArenaViewer`, `ArenaViewer`, `ArenaViewerOptions`, the `ArenaSkin` interface, `placeholderSkin`. All bodies throw `NotImplementedError` | `src/render/**`, README |
| src/ui | Routes `arena` (`#/arena`) and `replay` (`#/replay/:fixtureId`) with placeholder screens (nothing links to them; the report's Replay button stays disabled); `ArenaFacade` and `MATCH_WATCHING` (`store/arena.ts`); optional `GameEngine` members for the playback views; `GameStore.advance(options?)` | `src/ui/app/routes.ts`, `src/ui/screens/arena/`, `src/ui/store/` |
| Rules | Architecture rules for the two halves of src/render, the lazy viewer import, render/platform separation, with checker tests; bundle test: PixiJS and the viewer never in startup JS, viewer chunks ≤ 250 KB gzip; ESLint mirror | `tests/architecture/`, `tests/build/bundle.test.ts`, `eslint.config.js` |

No content, no golden, no `ENGINE_VERSION`, no save schema version and no player-visible behaviour changed. `pixi.js` ^8.22 was already a pinned dependency (8.22.0 installed); the stubs import only its types.

## A2. Architecture and data flow

```
GameState ── results[fixtureId] (stored inputs, round records)        liveMatch (the player's match, watch cursor)
     │                                                                          │
     └──── core/game playback: roundInputOf / the next round's input ───────────┘
                    │      (the same builder playRound uses; calls copied from the record or liveMatch.watch)
                    ▼
     core/sim simulateRound(input, roundSeed, content, { record: 'full' })   ← the call headless play makes
                    │
                    ▼
     FightLog (header + ~1,300 events: frames every 2 ticks, decisions with traces, casts, hits, statuses...)
                    │   replay: RoundResult.checksum must reproduce;  watched: the committed round keeps log.hash
                    ▼
     src/render/timeline  indexFightLog (once per log)  →  PlaybackIndex
                    │
     PlaybackClock (viewer): tick += dtMs × speed ÷ 50; stops at auto-pause stops, the end, the live head
                    │
     sampleAt(index, tick) → ArenaFrameState ──► src/render/viewer: PixiJS scene (floor, zones, telegraphs,
                    │                                bodies by the skin, token overlays, projectiles, cues)
                    └──────────────────────────────► src/ui arena screen: DOM HUD, fighter strip, feed,
                                                     inspector (≤ 10 Hz, tech-018)
     Back from the player: pause, seek, speed (viewer only, never state) · cursor and calls → commands →
     core/game → (a call) re-simulate → new log → viewer.replaceLog(log, tick) (prefix-checked)
```

### Decision: playback of a headless round, re-simulated on input (tech-015)

| Criterion | Playback (chosen) | Lockstep (sim stepped by the render loop) |
| --- | --- | --- |
| vis-009, viewed = headless | By construction: the viewed log **is** `simulateRound` output for the round's inputs; tests compare hashes and checksums | Needs a steppable, resumable sim API whose result equals `simulateRound`'s; a second code path to keep identical forever |
| T4 / tech-009 ("the viewer replays event streams, never simulates") | Kept: src/render stays a pure consumer; only core simulates | Breaks it, or moves a long-lived mutable sim object into core/game state between frames |
| Performance | One sim per round at `full`: median 4.8 ms, max 9.7 ms on the development machine (40 random rounds of `content/default`); the render loop does no sim work | About 3 µs a tick, cheap, but the sim then runs on the render thread at every speed change, seek and resume |
| Calls (P-01) | A call is an input at a tick boundary: core re-simulates from tick 0 with it (≤ 10 ms, while paused) and the viewer swaps logs; every event up to the call tick is identical (prefix property, tested) | A call is applied at the next tick directly; no re-simulation |
| Seeking, replays, auto-pause | Free: random access into the index; auto-pause stops are known exactly (the log is complete) | Seeking back needs a re-simulation from tick 0 or snapshots |
| Mid-fight resume (05 §5: "re-simulation to the same tick") | Re-simulate the round with its calls, open the viewer paused at the cursor | The same re-simulation, then step from there |
| Future-knowledge leak | The round's end exists in memory before it is shown; contained: live `RoundPlayback.result` is null, the viewer refuses seeks past the live head, the HUD shows only sampled state | None in memory |

The future-leak point is the only cost of playback, and it is contained in code. It also matters less than it looks: **without calls, a round's outcome is fixed by its inputs** whichever architecture shows it, so watching ahead and reloading changes nothing. With calls the reload exploit (watch ahead, quit, reload, call earlier) exists in both architectures and depends only on how often the cursor is saved (tech-019, §A3).

**Commit point (P-05).** A watched round is committed when its playback ends or the player skips to its end, by `advance` (Continue) playing the round through the orchestrator exactly as today. Until then the round is pending in `liveMatch` with its cursor and calls; a quit resumes there with the same inputs, so the same outcome. Without calls this is the M1.1 guarantee unchanged; with calls, every call is committed when issued (02 §3 "Call (M2)").

**Record level.** 03 sys-match-report says "M2 records at full level for the viewer". Read as: logs at `full` are produced on demand for viewing; stored results keep their current shape (a `full` log is 255 KB of JSON at the median and 413 KB at the maximum, so storing them is out of the question under O33). A watched round is played at `full` when committed so `RoundResult.eventHash` keeps the hash of the log the player saw (a few dozen bytes).

**Log format version (tech-016).** The viewer needs each fighter's shield and focus every frame (04 §4: "HP bar with shield segment, focus bar"); frames carry neither today. Log format 2 appends both to `FrameUnit` and emits a closing frame at the end tick. That changes full-level event hashes but no outcome and no round checksum. Replays and the report timeline are verified by round checksums, so tech-016 versions the recorded shape separately (`FIGHT_LOG_FORMAT_VERSION`, `FightHeader.logFormat`) instead of bumping `ENGINE_VERSION`, which would make every stored match of every career unreplayable (and drop the report's per-round box-score lines) for a change that alters no result. The goldens are re-pinned with the format bump (approved by this addendum if the owner approves it; the golden test's rule becomes "an `ENGINE_VERSION` or `FIGHT_LOG_FORMAT_VERSION` bump"); `ENGINE_VERSION` stays 2, round checksums do not move and summary-level events are unchanged apart from the header's new field (tested). No stored data holds an event hash of an unwatched round, so nothing else depends on the old hashes.

## A3. Match flow, playback, saves

**Watch or Simulate (open-020, Q54; working assumption OPEN).** Play match offers **Watch** (primary) and **Simulate**; the choice is fixed with the squad lock (`AdvanceOptions.playerMatch` → `liveMatch.watch.mode`) and the Streamlined pacing preset (D-L) simulates. Simulate is the M1.1 flow, unchanged. Without calls, Watch and Simulate give identical results (tested over a season); with calls, Simulate gives the player's side the AI call policy (open-020's recommendation).

**Live match states** (core/game; WP-M2B):

| Step | `liveMatch` | Screen | Autosave (`auto-round`) |
| --- | --- | --- | --- |
| Play match (Watch): lock, `startMatch`, no round played | phase `round_pending`, `watch { mode 'watch', round 1, cursorTick 0, calls [] }`; `AdvanceOutcome.watch` set | `#/arena`: kickoff card, then plays | yes (resume lands in the viewer) |
| Watching | unchanged; `match.watch { tick }` at every pause, auto-pause and call, and at most once every 10 s of playing (tech-019) | viewer | after each `match.watch` |
| Round end reached, or "Skip to end of round" | `advance` plays the round (record `full`), commits it (P-05), runs the hooks; then the between-round step | round-end card, then `#/between-rounds` per `pauseBetweenRounds` (unchanged), or straight to the next round | yes (as today) |
| Between rounds → Continue | swaps applied; phase `round_pending`, `watch.round` n + 1, cursor 0 | `#/arena` | yes |
| "Simulate the rest" | `match.watch { mode: 'simulate' }`: the current round finishes with its calls, later rounds are simulated; Watch never comes back within the match | M1.1 flow | yes |
| Deciding round committed | `liveMatch` null; the week finishes (AI matches are simulated now, after the player's match, as today) | report per pacing (D-L) | weekly rotation |

**Speed and pause (T1).** 1x/2x/4x and pause are presentation only (T4, 05 §6): they change the playback clock (`tick += dtMs × speed ÷ 50`, `dtMs` clamped to 100 ms so a hidden tab never jumps), never an input. A round starts at the remembered speed (per device, outside saves).

**Auto-pause (P-01; defaults Q58, OPEN).** `autoPauseStops(index, rules)` lists the exact ticks (the log is complete); the viewer stops after drawing that tick, so the cause is on screen. Working defaults: our fighter downed, our captain down, overtime start: on; an enemy downed, our fighter below an HP threshold: off. Each is a toggle in Settings › Match day. A live round also pauses when the window is hidden (setting, on by default).

**Seeking.** Replays: free seeking on a scrubber with key-moment marks, round tabs, ← → one frame (0.1 s) and Shift ← → one second while paused, and `#/replay/<id>?round=2&tick=340` from the report's key moments (04 ui-report: "from M2 it jumps the replay to that tick"), which starts 2 s before the moment. Live: rewinding within the current round is allowed (it reveals nothing new) and "Live" returns to the head; seeking past the head is refused, and calls (later) are possible only at the head. Seeking costs a few binary searches, never a re-simulation.

**Skip watching (open-020).** Three levels: Simulate at Play match; "Simulate the rest" in the viewer; "Skip to end of round" (Shift S, asks once when live). All three commit exactly the result the inputs give.

**Mid-fight resume (05 §5).** Loading a save whose `liveMatch.watch.round` is set opens `#/arena`, re-simulates that round with its calls (`liveRoundPlayback`) and opens it paused at `cursorTick` with a "Resumed" toast; the outcome is the one the inputs give, so a reload cannot reroll it (P-05). A manual save while paused first persists the cursor.

**Save schema (WP-M2B).** State schema **v5** with an identity migration from v4: `MatchState.watch` (`LiveWatch`, below 0.2 KB) and `RoundLineups.calls` (absent until calls exist; under 0.5 KB a match with them) join the strict zod schema, with `SAVE_BOUNDS` for the call count. The version moves although both fields are optional, because the schema is strict: an M1.1 build must refuse a v5 save (`save.too-new`) instead of failing validation. Size impact: under 1 KB per watched match plus about 40 bytes of `eventHash` per watched round, about 3 KB a season. Nothing else is retained (§A4).

**Core API (fixed contract, `core/game`).** `advance(state, content, options?)`; `liveRoundPlayback(state, content)`; `roundPlayback(state, fixtureId, round, content)` (committed rounds, from `results` or from the live match's earlier rounds); `matchPlayback(state, fixtureId, content)`; `replayAvailability(state, fixtureId, content)`; `inspectPlayback(state, fixtureId, round, tick, content)`. Live `RoundPlayback.result` is always null. `liveRoundPlayback` must build the round's input with the same helper the orchestrator's `playRound` uses (one builder, so the watched input cannot drift from the played one).

## A4. Replay availability

A replay re-simulates stored inputs, so it needs (1) the inputs and round records and (2) the same build: the stored `engineVersion` equals `ENGINE_VERSION` and the stored `contentHash` equals the loaded content's hash (05 §6: determinism is not promised across builds). `replayAvailability` applies exactly the test `buildMatchReport` applies to its timeline.

| Match | Watch live | Replay | Reason when not |
| --- | --- | --- | --- |
| The player's match in progress | yes (Watch) | its committed rounds: yes | `live` for the whole match button; earlier rounds through the between-round screen |
| The player's matches, this season and last | — | yes, on the same build | never compacted in the season (O24) and kept for the current and previous season (05 §5) |
| The player's older matches | — | no | results older than last season are dropped (`compacted`: "not kept in full") |
| Matches between other clubs, within 3 weeks of play | — | yes, on the same build | — |
| Matches between other clubs, compacted (3 weeks after play, or at season end) | — | no | `compacted` (O24 dropped their inputs and round records) |
| Any match, after an update that changes `ENGINE_VERSION` or any content value | — | no | `other-build` |
| M1 results (engine 1) | — | no | `other-build` |

**What O24 means for M2.** Matches between other clubs are replayable for 3 weeks (`leagues.json matchRecords.compactAiMatchesAfterWeeks`), which covers the useful case: the next opponent's last match is usually a week old (not in the first matchweek, when it belongs to last season). Reckoning matches between other clubs are compacted at the season end. The player's own matches are always replayable in their season and the next, while the build stays the same.

**What a build change means.** Any content tuning changes the content hash, so after an update no earlier match replays, and the report loses its per-round box-score lines as it already does today. This is player-visible (Q56).

**UI states.** Replay buttons (report, fixtures, Home's last result) are enabled when available and otherwise disabled with the reason as a tooltip: `compacted` "Older matches between other clubs keep only their summary, to keep saves small"; `other-build` "Played on an earlier version of the game: the replay cannot be rebuilt. The report is unchanged"; `live` "Your match is in progress". Wording is the UI designer's (EXAMPLE). A replay whose checksum does not reproduce is a defect: it is reported (`replay.mismatch`), never shown.

**Retention (Q57).** No new retention is needed for the player's own matches. Options for other clubs' matches, measured on main for KI-2 (in-season peak at season 3): window 3 weeks (today) 7.6 MB; 5 weeks 8.2 MB; no compaction 12.3 MB. At season 10 the peak is 8.9 MB with 3 weeks, so 5 weeks would reach about 9.5 MB of the 10 MB budget (O33): possible, with 0.5 MB of headroom, and not recommended. Keeping the inputs of the player's tier's Reckoning matches until the next season end would cost about 0.1 MB. Recommendation: no change.

## A5. Rendering

### Module layout (tech-017)

| Path | Half | Contents | Owner |
| --- | --- | --- | --- |
| `src/render/index.ts`, `types.ts` | pure | Public pure API and contract types | architect |
| `src/render/timeline/` | pure | Render-state model: index and sample | WP-M2C |
| `src/render/cues/`, `colors/`, `camera/` | pure | Cue table from content, team colours and contrast, projection | WP-M2C |
| `src/render/viewer/` | PixiJS | `createArenaViewer`: application, playback clock, scene, overlays, cues, input; `skin.ts` (contract, architect) | WP-M2D |
| `src/render/skins/placeholder/` | PixiJS | The M2 placeholder skin | WP-M2D |

The pure half runs and is tested in Node without a GPU (tests/architecture rule `render-pure`). src/ui imports `src/render` statically from lazy screen chunks and `src/render/viewer` only with `import()` or `import type` (`ui-render-viewer-static`).

### PixiJS v8 as a lazy chunk (tech-024, tech-025)

- **Loading.** The arena screens (lazy routes) `import('../../../render/viewer')` on mount; Squad and Home prefetch it at idle in a matchweek. PixiJS and the viewer stay out of the startup JS (bundle test) within a viewer budget of 250 KB gzip (TUNABLE (tech)); PixiJS with Application, Graphics, Container, Text and Sprite minifies to about 165 KB gzip (esbuild measurement; an upper bound, since it includes every module PixiJS loads lazily, such as its WebGPU path). No network at run time (P-15).
- **Init.** `await app.init({ preference: 'webgl', antialias: true, autoDensity: true, resolution: min(devicePixelRatio, 2), preserveDrawingBuffer: true, backgroundAlpha: 0 })`; the canvas fills the host; `preserveDrawingBuffer` lets the F8 ticket screenshot (modern-screenshot) and `viewer.snapshot()` read the WebGL canvas. WebGL is the predictable target for both desktop wrappers (05 §8).
- **Render loop.** PixiJS's ticker drives one callback per display frame: advance the playback clock, `sampleAt`, update the scene (objects reused, keyed by unit index and event seq), render. The HUD gets `onFrame` at ≤ 10 Hz and at every pause, seek and stop. The ticker stops while paused and nothing animates (reduced CPU); it restarts on play or seek.
- **Resize and DPR.** A ResizeObserver on the host resizes the renderer and recomputes `viewTransform` (letterboxed 16:9 arena inside the HUD padding: 56 px top, 72 px bottom, 04 §4); a `matchMedia('(resolution: …dppx)')` listener follows DPR changes when the window moves between monitors. The arena never scrolls at zoom 1 (04 §4).
- **Teardown.** `destroy()` stops the ticker, destroys textures and the WebGL context and removes the canvas; loading a new round destroys the previous round's visuals (no growth across rounds, smoke-tested).

### The render-state model

`indexFightLog` turns the ~1,300 events of a round into per-unit interval lists once (frames, decisions, casts, statuses, shields, projectiles, zones, downs); `sampleAt(index, tick)` is then a pure function of `(log, tick, context)`: the same state whether playback reached the tick at 1x, at 4x or by seeking (tested). Positions are interpolated linearly between frames (every 2 ticks, 0.1 s); HP, shield and focus step at frames (format 1 logs give `shield` and `focus` null and the bars hide them, never guess); discrete state comes from the intervals; facing points at the committed target, else along the movement. Effects carry their event's seq as a stable id so the scene keeps one visual per effect.

### Asset and skin interface (tech-020)

The viewer owns every mark with game meaning and draws it above the skin: the side ring, the role glyph(s), the facing wedge, HP, shield and focus bars, status pips, the captain crown, the rule badge, telegraphs and cues. A skin draws only **bodies and the floor** (`ArenaSkin.createBody(info, colors) → BodyVisual { view, update(state, frame) }`, `createFloor`). So a skin can never hide a vis-003 cue, and sprites "add to the token and never replace it" (art research §2).

- **Placeholder skin (M2).** Generated shapes, no image files: a disc of the fighter radius (0.5 m) in the side's primary with a secondary rim; downed: flattened, 40% opacity (asset-006); a flat mid-value floor, centre line and walls (04 §5).
- **Sprite skin (after open-032).** The same interface over atlases: a base layer plus two greyscale team-mask layers tinted with `TeamColors.primary` and `.secondary` (research §6, PixiJS `tint`), animation from `UnitRenderState.action`, facing quantised to the directions the owner picks (art §12 Q4). Atlases ship in the bundle (offline).

### Team colours, role glyphs, bars and cues

- **Team colours** (`colorsForMatch`, asset-006, research §6). Player's side ring brass (`--c-side-us`), opponent steel blue (`--c-side-them`); between other clubs, both rings take the clubs' primaries, and when the primaries are too close the away side becomes secondary-dominant. Every ring and body colour reaches 3:1 against the floor (04 §9). The ring style (player solid, opponent double) is the colour-free side cue.
- **Role glyphs (D-J).** Shape first, colour second: the five SVG paths come from the `--glyph-*` tokens in `tokens.css` and the hues from `--c-role-*` (`ArenaPalette`, read from the host's computed style, so the arena and the UI share one source and follow the theme). Hybrids show both glyphs. Role hues are used for nothing else (04 §3).
- **Bars.** HP in neutral parchment on a dark track (no red/green meaning), a shield segment beyond it, a thin focus bar below; labels stack above the HP bar (04 §4).
- **Status pips** (`StatusCue`): up to 4 above the HP bar by priority (hard control first), each a category glyph; hard control also greys the ring (asset-006).
- **Freshness** (O19: constant within a round): a "Tired (52)" or "Spent (28)" tag above the token for the first 3 s of the round, and permanently in the fighter strip and the inspector (from `fight.start` unit data).
- **Captain crown** on the acting captain, moving on `captain.handover`; rally and captain-down cues.
- **Rule badge** (P-22, 04 §7): "R3" above the token, "S" for the stance, "T" while taunted; it pulses 220 ms on a new decision (static under reduced motion); the strip repeats it.
- **Downs and their cause (vis-003).** A diamond down marker in the side colour (as in the report), a callout "Knight downed by Assassin · Shadowstep" for 2 s, and a persistent entry in the live feed; auto-pause on our downs by default.

### Ability cues, data-driven (tech-021)

`buildCueTable(content)` derives a cue for every ability and status from its definition, so all 42 classes, 168 abilities and 34 statuses are covered by construction, and no ability or class id appears in code:

| Ability property | Cue |
| --- | --- |
| basic, melee range | swing arc at the target, impact spark |
| `delivery: projectile` (and ranged basics) | a projectile glyph from caster to target over `[launch, landTick]`, at least 10 px (research A4.2: no tiny projectiles), impact on landing; an area projectile bursts at its point |
| `delivery: instant`, single target | a short beam caster → target |
| `delivery: dash` / `leap` | a trail along the `displace` path |
| `area` circle, cone, line | telegraph during the windup or cast (from `cast.start` and `area`), then an area flash at release |
| `castTimeS` or `channel` of 0.3 s or more (6 ticks) | telegraph arc and cast bar (04 §7); channels pulse at each tick |
| damage type physical, arcane, true | impact tone (designer tokens `--c-fx-physical`, `--c-fx-arcane`, requested) |
| heal, shield | heal pulse and "+N" number; shield ring segment |
| status categories | pips; hard control (stun, sleep, taunt, silence, knockback, pull) gets the stronger control cue |
| zones | a floor disc in the owner's side colour at low alpha, a pulse on triggers, a fade on expiry |
| crit, evade | larger number; "Evade" text |

A theme's skin may later override cues per ability from its own data file (designer-owned, FUTURE).

### Telegraphs and readability (vis-003)

Every token always shows the side ring, the role glyph(s) and the HP bar; observers name tanks and healers from glyph shapes, not colour. Casts of 0.3 s or more telegraph their area or target line with progress; hard control greys the ring; downs name their cause. Effects are rate-limited (at most 3 flashes a second per fighter and no full-screen flashes; 04 §9). Clutter control (research A4.2): no decoration that could read as gameplay (open-019), effects fade within 400 ms at 1x and at most one number per fighter per 100 ms is drawn (merged), values TUNABLE by the UI designer, and names show on the selected fighter (L toggles all).

### Camera (OPEN, Q55)

Working assumption: top-down orthographic, the whole arena, fixed framing (04 §4, P-03), about 52 px per metre at 1920 × 1080. The projection is configuration (`CameraConfig.projection`: `top-down` or `oblique` with a tilt for a 3/4 view, art §12 Q4), as are zoom (1, 1.5, 2) and follow; `viewTransform` is pure and shared by the scene and pointer hit-testing. Depth is sorted by y in both projections. M2 ships zoom 1 without follow unless the owner chooses otherwise; changing the camera later touches no sim, log or render-state code.

### Pause inspector (P-22)

Selecting a fighter (click, Tab) while paused opens the inspector (DOM panel). Its data:

| Item | Source | In the events today? |
| --- | --- | --- |
| Rule badge, the rule as a sentence | `unit.decide.rule`; preset rules + core/tactics `describeRule` | yes, at `full` |
| Why this decision: each earlier rule's skip reason, observed value, ready-in | `unit.decide.trace` (`reason`, `cond`, `observed`, `readyInTicks`) | **yes, recorded since engine 1 but untyped**: the contract now declares the fields |
| Reaction delay and causes | `unit.decide.reactTicks`, `reactCauses` | yes |
| What he would decide **now**, at the paused tick | `inspectPlayback` → sim `inspectRoundAt` (tech-022) | **no**: the sim traces only decisions that change (its fast path re-evaluates without a trace), so a probe re-simulates to the tick (≤ 10 ms) |
| HP, shield, focus; cooldowns; a pending decision | frames (format 2); the probe | HP yes; shield and focus with format 2; cooldowns and pending only from the probe |
| Statuses with time left | `status.apply` / `status.expire` | yes |
| Fires this round so far, rules not fired yet | counted from `unit.decide` up to the tick | yes |
| Freshness and its penalty; captain and grade | `fight.start` unit data; header and `captain.*` | yes |

From M4 the inspector reads opponents through the viewing club's knowledge (P-13: opponents' rules only when scouted); M2 shows both sides (open-026).

## A6. Calls (P-01) and Q17

**If adopted (design, so the reservation is coherent):**
- A call is a **committed input at a tick boundary**: `FightCall { tick, kind, target? }` applies at the **start** of `tick`, before the timers. The viewer pauses only on frame ticks (every 2 ticks); a call made while paused on frame tick f applies at f + 1, so every event up to and including f is unchanged (the prefix property, checked by `samePrefix` before the viewer swaps logs).
- **The same for the AI** (P-04): each side's plan per round is `none`, `policy` (the AI call policy, evaluated inside the sim at decision ticks against the fight-observable `BattleView`, so it never sees hidden or future state) or `explicit` (the player's calls). Every AI club and a player who simulates use `policy`; the budget (2 per round, P-01) comes from content.
- **Reproducible on replay:** the plans are recorded per round in `RoundLineups.calls`; `roundInputOf` copies them into `RoundInput.calls`; policy calls follow from the inputs.
- **Committed when issued:** `match.call` validates (budget, tick ≥ cursor, acting captain), persists, writes the round autosave; core re-simulates the round with the new plan and the viewer swaps logs.
- **Through the captain** (sys-fight-captain rule 5): the acting captain relays; what a call does, its delay and what happens without an acting captain are sys-calls' to specify.
- Adopting calls changes every outcome (AI clubs spend calls), so it bumps `ENGINE_VERSION`; earlier matches stop being replayable once, like any build change.

**Why they do not fit M2 cleanly.** Q17 is unanswered, sys-calls is "not yet written" (03 §3.5), and no call kind exists (research C3.1 lists candidates: a focus target, toggling a rule, switching playbook, retreat). Building calls needs a combat design pass, content, an AI call policy, a balance run and an engine bump: a package of its own that depends on the owner.

**Staging (Q53, recommended):** M2 ships everything else (Q17's pause to inspect, auto-pause and skip watching need no sys-calls); the calls package (WP-M2G) follows once the owner answers and sys-calls is approved, before M3.

**Reserved now:** `FightCall`, `SideCallPlan`, `RoundCalls`, `RoundInput.calls` (the sim must refuse any plan but none until then), `RoundLineups.calls`, `LiveWatch.calls`; the event type `call.issue`; the command `match.call` (refused with `match.calls-unavailable`); `ArenaViewer.replaceLog` and `samePrefix`; the effect kind and key-moment kind `call`; the HUD's calls-left slot (hidden).

**No-reroll window (tech-019).** With calls, the cursor bounds where a call may go. It is persisted at every pause (calls are made only while paused), auto-pause and call, on `visibilitychange`/`pagehide` (best effort), and at most once every 10 s of playing. A player can therefore gain at most about 10 s of foresight by quitting and reloading, never more. Without calls there is nothing to gain.

## A7. User interface (WP-M2E)

- **Routes** (contract): `#/arena` (the live round) and `#/replay/:fixtureId` (`?round`, `?tick`); both lazy; placeholders until WP-M2E.
- **Arena screen.** The canvas fills the content area under a DOM HUD (T3): top strip 56 px (crests, score, round pips, clock, overtime in amber from 45 s, standing counts, speed, pause, and later calls left), bottom fighter strip 72 px (both sides: portrait, name, HP, rule badge, Freshness tag, a down marker), a live feed of key moments (aria-live, polite), the inspector panel, the round-end card and the controls. The between-round screen is unchanged, plus "Replay round n" and a Continue that opens the next round in the viewer.
- **Flow.** Play match offers Watch and Simulate (Q54); `store.advance({ playerMatch })`; `MATCH_WATCHING` routes to `#/arena` (as `MATCH_PAUSED` routes to the between-round screen); the round end calls `ArenaFacade.finishRound()`; on load, a live match with `watch.round` set resumes in `#/arena`.
- **Replay entry.** The report's Replay button (today disabled) and its key moments; Fixtures and Home's last result get a replay icon when available; reasons as tooltips (§A4).
- **Store.** `ArenaFacade` (fixed contract) over the GameStore, like `MatchDayFacade`; the store's autosave gains the watch points of §A3; viewer settings (`ArenaSettings`) are per device, outside saves, in the UI settings record.
- **Keyboard** (04 §9: every action by keyboard): Space play or pause; 1, 2, 4 speed ([ ] cycle); ← → a frame and Shift ← → a second while paused (replay and live rewind); Tab and Shift Tab select a fighter; Enter or I inspector; L labels; Home recentre; Shift S skip to the end of the round; Esc close or back. Remappable like the other shortcuts.
- **Settings › Match day:** Watch preference, speed, auto-pause triggers, labels, pause when hidden.
- **F8 tickets** on the arena screen add fixture, round, tick, speed and kind to `ticket.json`; the screenshot includes the canvas (`preserveDrawingBuffer`).
- **Dev hook** (dev builds only, for the smoke): `window.__arena.viewer` with `frame()`, `seek(t)`, `play()`, `pause()`, `setSpeed(s)`, `stats()`, `logHash()` and `loadFixtureRound()` (a fixed fixture round of the dev world).

## A8. Module boundaries, rules and bundle

- **Dependency direction** (05 §3.1, amended): `src/ui → src/render` (the pure index statically; the viewer only by `import()` or `import type`); `src/render → core/{util, rng, model, content, sim}` (unchanged); `src/render` and `src/platform` never import each other; inside src/render, the pure half imports nothing from the PixiJS half. No new core module; core/game and core/sim gain functions, core/model types.
- **Rules added** (`tests/architecture/rules.ts`, with checker tests): `render-pure` (no `pixi.js`, no import of `viewer/` or `skins/`, no DOM, clock, timer, `crypto` or `Math.random` in the pure half; test files exempt), `render-deep-import` and `ui-render-viewer-static` (src/ui into src/render), `platform-imports-render`, `render-imports-platform`. ESLint mirrors the pure-half import rule.
- **Bundle** (`tests/build/bundle.test.ts`): no module of `pixi.js`, `src/render/viewer` or `src/render/skins` in the startup JS; those chunks together ≤ 250 KB gzip.
- **Save schema:** v5 (§A3), WP-M2B.

## A9. Accessibility and reduced motion (04 §9)

- **Redundancy:** role = glyph shape + hue + name in the strip and inspector; side = ring colour + ring style; status = pip glyph + colour; Tired/Spent as words. The smoke takes screenshots under CDP's emulated deuteranopia, protanopia, tritanopia and achromatopsia (the arena's art-005).
- **Contrast:** rings, glyphs and bars ≥ 3:1 against the floor, text ≥ 4.5:1 (`contrastRatio`, unit-tested over all 48 club colour pairs and both themes).
- **Reduced motion** (OS or Settings): no pulses, trails or floating numbers (numbers appear and fade in place), no camera ease, effects at their end state; telegraph progress stays (it is information). Flashing ≤ 3 a second always; no screen shake (none exists).
- **Input:** no timing demand anywhere (pause is free and unlimited, P-01); everything by keyboard; a visible focus ring on the canvas and on the selected token.
- **Screen readers (best effort):** HUD, strip, feed and inspector are DOM; the feed announces downs, overtime and the round end; the canvas has `role="img"` and a label summarised at each pause.
- **Interface scale** (85–150%): the DOM HUD scales with `--ui-scale`; canvas labels and pips scale with it too (read at mount and on change).

## A10. Performance targets and memory

Reference machine: 05 §8's working reference (a 2020+ mid-range 4-core, 8 GB laptop with current Chromium), OPEN until Q35. All TUNABLE (tech); measured by the smoke and reported per package.

| Constraint | Target |
| --- | --- |
| Arena frame rate, 1920 × 1080, resolution ≤ 2, 1x and 4x | 60 fps target; p95 frame interval ≤ 20 ms; never below 30 fps |
| Our CPU per frame (clock + `sampleAt` + scene update) | p95 ≤ 4 ms |
| Round load (`roundPlayback` / `liveRoundPlayback`: sim at `full` + `indexFightLog`) | median ≤ 15 ms, p99 ≤ 30 ms (sim alone: median 4.8 ms, max 9.7 ms measured) |
| Call re-simulation and log swap (calls package) | ≤ 30 ms, while paused |
| Probe (`inspectPlayback`) | ≤ 15 ms |
| First viewer open (lazy chunk + PixiJS init), local files | ≤ 500 ms; prefetched at idle in a matchweek |
| HUD updates | ≤ 10 Hz, ≤ 2 ms each |
| Startup JS | unchanged, ≤ 250 KB gzip (about 219 KB now) |
| Viewer chunks | ≤ 250 KB gzip |
| Memory | one round's log 255 KB JSON at the median, 413 KB at the maximum; the viewer keeps the current round's log and index and the previous round's; JS heap growth ≤ 50 MB while viewing, GPU textures ≤ 32 MB (placeholder), no growth over 20 consecutive rounds; the app within 05 §8's 400 MB |
| Save | < 1 KB per watched match (§A3) |

## A11. Testing strategy

**Determinism (Node, Vitest; vis-009).**
- *Viewed = headless:* for a watched round, `liveRoundPlayback(...).log.hash` equals the `eventHash` the committed round stores, and its checksum equals the checksum of the same round played by `advance` in Simulate mode; over a season with Watch and no calls, the state checksum equals the Simulate run's (WP-M2B).
- *Replay = original:* every round of played matches with swaps, injuries and an emergency entrant re-simulates to its stored checksum, and the replay log hash equals the live log hash captured while watching (WP-M2B).
- *Format 2:* round checksums and summary-level events (the header aside) unchanged against main for 200 seeded rounds; full-level goldens re-pinned once; `balance --fights 2000 --seed balance-1` gives identical results to main (WP-M2A).
- *Resume:* save at a cursor, parse, `liveRoundPlayback`: identical log, start tick and committed result (WP-M2B).
- *Probe:* `inspectRoundAt` never changes a later result; at a tick where a decision was traced, the probe's evaluation matches the recorded trace (WP-M2A).
- *Cross-runtime:* the smoke computes a fixture round's `hashEventStream` in Chromium and compares it with Node's pinned golden (05 §10 "golden hash in Node and Chromium").
- *Calls (later):* prefix property, same calls → same hash, the AI policy identical headless and viewed.

**Render-state model without a GPU (Node, WP-M2C).** Fixture logs from the sim: interpolation at and between frames; `sampleAt` path-independence (played at 1x, at 4x, or seeked: identical states); status intervals; cast progress and telegraph geometry; rule badge transitions; projectiles; zones; down callouts with their cause; `autoPauseStops` finds exactly the triggering events; `keyMoments` equals the report's selection rules; format 1 logs give null shield and focus; every ability and status of `content/default` yields a cue (168 and 34); `colorsForMatch` clash rule and 3:1 contrast for every club pair; `viewTransform` round-trips and letterboxes. Small golden snapshots of `ArenaFrameState` at chosen ticks.

**Viewer logic (happy-dom, WP-M2D).** The parts that need no GPU: playback clock (speeds, clamps, stops, live head), flash limiter, layer ordering and object reuse by id, `replaceLog` refusal on a broken prefix. PixiJS itself is exercised only in the browser smoke.

**UI (happy-dom, WP-M2E).** Screens with a fake `ArenaViewer` injected through a factory seam and fixture `RoundPlayback`s: HUD content, controls and keys, inspector sentences from traces and probes, feed, round-end card, Watch/Simulate flow, `MATCH_WATCHING` routing, resume after a reload, Replay buttons and reasons, settings.

**Headless-browser visual smoke (WP-M2F).** `npm run smoke:arena` (script entry requested), a zero-dependency Node driver for headless Edge (or Chrome) over the DevTools protocol (Node's built-in WebSocket; Playwright stays FUTURE, 05 §10). Against `npm run preview` and the dev world: open the replay of a fixture round through the dev hook, seek to fixed ticks and take screenshots at 1280 × 720 and 1920 × 1080 in both themes and with reduced motion; check a WebGL context, a non-blank canvas, ten tokens (pixel colours at the projected positions from `frame()` match the ring colours), no console errors; measure fps and our frame time over 10 s at 1x and 4x; load 20 rounds and check heap growth; CVD screenshots; the Chromium hash check. Screenshots and a JSON report go to `reports/` (git-ignored). Not part of `npm run check` (it needs a browser); run before each M2 merge and by QA.

**vis-003 (fights are readable).** (1) Automated proxies above: glyph and ring on every token, contrast, cause named on every down. (2) An agent observer pre-check: five fights at 1x as screenshot sequences with the vis-003 prompts (name both sides' tank and healer; the cause of each down), scored. (3) The criterion itself: human observers (the owner) watch five fights at 1x; ≥ 90% of prompts answered correctly. Only (3) is evidence for vis-003 (01 §6); (1) and (2) gate the merge.

## A12. Technical decisions (proposed `tech-` entries)

| ID | Decision | Why | Rejected |
| --- | --- | --- | --- |
| tech-015 | The viewer plays back a round simulated headlessly at `full`; core re-simulates on input (calls) and the viewer swaps logs at the call tick | vis-009 by construction; tech-009 kept; free seeking; ≤ 10 ms per round | Lockstep stepping of the sim by the render loop |
| tech-016 | `FIGHT_LOG_FORMAT_VERSION` versions the recorded shape apart from `ENGINE_VERSION`; format 2 adds shield and focus to frames and a closing frame | The viewer needs them; replays are checksum-verified, so stored matches stay replayable | Bumping `ENGINE_VERSION` (every stored match loses its replay and per-round box score); deriving shield and focus from events (inexact) |
| tech-017 | src/render in two halves: pure (types, timeline, cues, colours, camera; Node-testable) and PixiJS (viewer, skins; lazy) | GPU-free tests; PixiJS only where needed; enforced by rules | One folder with PixiJS everywhere |
| tech-018 | HUD, strip, controls, feed and inspector are DOM (Preact) over the canvas, fed at ≤ 10 Hz; the canvas draws only the arena | T3; accessibility; DOM tests; the UI designer's CSS | A canvas HUD |
| tech-019 | Watch cursor in `liveMatch.watch`, persisted by `match.watch` at pauses, auto-pauses, calls and at most once every 10 s of playing, then the `auto-round` autosave | Resume at the same tick (open-016); bounds the reload window once calls exist | Saving every frame; no cursor |
| tech-020 | The viewer owns every mark with game meaning; a skin draws bodies and the floor only | Sprites can never hide vis-003 cues; a reskin touches one skin | Skins drawing whole tokens |
| tech-021 | Cues derived from ability and status definitions by a pure table | Covers 168 abilities and 34 statuses by construction; no ids in code | Hand-made cues per ability |
| tech-022 | Pause inspector probe: `inspectRoundAt` re-simulates to a tick and evaluates every rule list with a trace | Recorded traces exist only for decision changes; read-only, ≤ 10 ms | Tracing every evaluation into the log (size, hash churn) |
| tech-023 | State schema v5, identity migration, for `MatchState.watch` and `RoundLineups.calls` | Strict schema: an older build must refuse new saves cleanly | Optional fields without a version (an M1.1 build would fail validation on them) |
| tech-024 | PixiJS init: WebGL preference, antialias, autoDensity, resolution min(DPR, 2), `preserveDrawingBuffer`, ticker dt clamped to 100 ms | Predictable in both wrappers; F8 screenshots; no jumps | WebGPU first |
| tech-025 | Viewer chunks lazy, ≤ 250 KB gzip, prefetched at idle in a matchweek | Startup budget unchanged | PixiJS in the main bundle |

## A13. Work packages

Ground rules as 05 §9.2: one worktree per package on `m2/wp-<x>-<name>` from `main` after this branch merges; a package owns only its paths; no two packages share a file; contract files keep their signatures (add freely, change through the architect). **Architect-owned:** as in §9.2 (package files, configs, `tests/**`, `src/core/{util,rng,model,content,testkit}/**`), plus `src/render/index.ts`, `src/render/types.ts`, `src/render/viewer/skin.ts`, `src/render/README.md` and this addendum; the one exception is that WP-M2A sets `FIGHT_LOG_FORMAT_VERSION` to 2 in `core/model/events.ts`. **Designer-owned:** `docs/design/**` except 05 files, `content/**`, `src/ui/styles/**`.

| Package | Owns | Implements | Depends on | Parallel with | Model |
| --- | --- | --- | --- | --- | --- |
| **WP-M2A** Sim: log format 2, probe | `src/core/sim/**`, `src/core/tactics/**` | Frames with shield and focus, a closing frame, `header.logFormat`; `inspectRoundAt`; the sim refuses non-none call plans; goldens re-pinned (approved here); README | contracts only | all | Sonnet |
| **WP-M2B** Game: watch flow, playback, replay, resume, save v5 (integrator) | `src/core/game/**`, `src/core/save/**`, `src/core/ai/**`, `src/core/harness/soak*.ts`, `scripts/soak.ts`, `scripts/replay.ts` | `AdvanceOptions`, the watch pause and round commit, `match.watch` (with `mode`), `liveRoundPlayback`, `roundPlayback`, `matchPlayback`, `replayAvailability`, `inspectPlayback` (after WP-M2A), one round-input builder for play and view, `roundInputOf` copying calls, schema v5 and migration, error codes, README | contracts; WP-M2A for `inspectPlayback` only | all | **Opus**: it moves the player's commit point and the week split, where a slip breaks P-05 or vis-009 silently; it also integrates the merges |
| **WP-M2C** Render model | `src/render/timeline/**`, `src/render/cues/**`, `src/render/colors/**`, `src/render/camera/**` | The pure API of §A5 | contracts (format 1 logs suffice; format 2 fields light up when WP-M2A merges) | all | Sonnet |
| **WP-M2D** Render viewer | `src/render/viewer/**` except `skin.ts`, `src/render/skins/**` | `createArenaViewer` (clock, scene, overlays, cues, input, resize, DPR, teardown, snapshot, stats), the placeholder skin | contracts; WP-M2C's `sampleAt` (until it lands, hand-built `ArenaFrameState`s) | all | Sonnet |
| **WP-M2E** UI | `src/ui/**` except `src/ui/styles/**`; `src/platform/**` if the ticket metadata needs it | §A7: arena and replay screens, HUD, strip, feed, inspector, controls and keys, Watch/Simulate, routing and resume, Replay entries, settings, store facade and autosave points, F8 metadata, the dev hook | contracts; WP-M2B views (stubs → `safeView` null; tests use fakes); WP-M2D (a fake viewer in tests) | all | Sonnet |
| **WP-M2F** QA smoke and vis-003 protocol | `scripts/smoke/**` (new) | §A11 smoke driver and checks, the vis-003 observer kit and agent pre-check, the report format | the dev hook (WP-M2E) and the viewer (WP-M2D) for the real run; the driver can be built first against the placeholder route | all (finishes last) | Sonnet |
| **WP-M2G** Calls (gated: Q53 answered and sys-calls approved) | sim/tactics, game, ui and content changes, after M2 merges | §A6: call effects, the AI call policy, `match.call`, records, the call UI, `ENGINE_VERSION` 3, harness runs | the owner and the combat designer; all M2 packages merged | none (sequential) | Sonnet |

**Acceptance per package** (beyond `npm run check` green after a rebase, README updated, no file outside ownership):
- **WP-M2A:** format 2 frames match the sim's state (shield after `shield.gain`/`break`, focus after `cast.release`); checksums and summary-level events (the header aside) identical to main on 200 seeded rounds; `npm run balance -- --fights 2000 --seed balance-1` identical to main; `inspectRoundAt` consistent with recorded traces and side-effect-free; full-level sim time reported.
- **WP-M2B:** the determinism and resume tests of §A11; `replayAvailability` reasons for not-played, compacted (3 weeks), other-build and live; `npm run soak -- --seasons 3 --seed soak-1` and the 10-season gate identical to main (AI matches never watch); a v4 save loads as v5 and saves back identically; a scripted season in Watch mode equals the Simulate run.
- **WP-M2C:** the model tests of §A11; `sampleAt` p95 ≤ 1 ms per call in Node on a 1,500-tick round.
- **WP-M2D:** the smoke passes on the dev machine at 60 fps median at 1x and 4x; teardown leaves no growth over 20 rounds; the viewer chunk within budget; the UI designer reviews the placeholder look against asset-006.
- **WP-M2E:** screen tests; in the browser, a full matchweek watched (Watch, auto-pause, between-rounds, report), a reload mid-round resuming at the cursor, a replay from the report's key moment; keyboard-only pass; ux-001 counted (Play match and one Enter per round boundary); the UI designer's review.
- **WP-M2F:** the smoke report with screenshots, fps, heap and the Chromium hash; the vis-003 agent pre-check scored; the observer kit ready for the owner.

**Merge order and integration.** Any order; WP-M2B integrates. Suggested: WP-M2A and WP-M2C first (independent), WP-M2B, WP-M2D, WP-M2E, then WP-M2F's final run on the merged build. After WP-M2E merges, the architect adds the package script `smoke:arena` and a v4 save fixture test under `tests/save/`.

**Design tasks (not coding packages):** the UI designer mocks the arena screen (HUD, strip, inspector, round-end card) and adds tokens (`--c-arena-floor`, `--c-arena-wall`, `--c-fx-physical`, `--c-fx-arcane`, status pip glyphs) to `src/ui/styles`; the combat designer writes sys-calls when Q53 is answered; the lead designer moves Q53–Q59 into 01 §8.5.

**Highest-risk assumptions to prove early:** the watched round's input equals the played one (WP-M2B, first test); format 2 changes no outcome (WP-M2A, first test); 60 fps at 4x on integrated graphics (WP-M2D with WP-M2F's fps check, as soon as a scene draws); WebGL canvas capture for F8 (WP-M2D).

## A14. Owner questions (proposed numbers Q53–Q59)

**Q53 — Calls in watched fights: in M2, later, or never?**
**Required before M2 starts · 01 §8.3 P-01; §8.5 Q17; 03 §3.5 sys-calls**

P-01 proposes up to two calls per round per side, which AI managers spend too, through the captain. What a call does (call a focus target, toggle a rule, switch a playbook, retreat) is not designed yet, and Q17 is open. Option A: M2 ships watching, pause, the inspector, auto-pause and skipping; calls follow in a small package once the combat designer has specified them and you have approved them, before M3. Option B: hold M2 until calls are designed and build them in. Option C: no calls; you influence fights only between rounds (and from M3 by editing rules).
**Recommendation:** A. Also approve the rest of Q17 (free pause to inspect, auto-pause, skipping, each milestone keeping the M1 loop working).
**If deferred:** M2 builds A by default; the code is ready for calls either way.

**Q54 — Can you skip watching your own match, and what is the default?**
**Required before the M2 handoff · 01 §8.4 open-020; 02 §2 step 7; 04 ui-match**

Play match would offer **Watch** and **Simulate** side by side (one click either way). Without calls, Simulate gives exactly the result watching would give; once calls exist, simulating lets the AI's call policy make your side's calls. In the viewer you can also simulate the rest of the match or skip to the end of a round. The Streamlined pacing preset always simulates.
**Recommendation:** yes, with Watch as the primary button.
**If deferred:** built as recommended; the default is one setting.

**Q55 — Which camera should M2 use?**
**Required before WP-M2D finishes · 04 §4; art research §12 Q4; open-032**

The working design is a top-down view of the whole arena with fixed framing (04 §4), drawn with placeholder shapes. The camera is a setting in code, so a 3/4 view (about 40°, as sprite pipeline C would render) or zoom 1×/1.5×/2× with follow can come with the sprite decision without rework.
**Recommendation:** top-down, fixed framing in M2; decide the 3/4 view, zoom and follow with the sprite pipeline (art §12 Q4).
**If deferred:** built as recommended.

**Q56 — Which matches can be watched and replayed?**
**Required before the M2 handoff · 03 sys-match-report (O24); 05 §5, §6**

Live: your own matches. Replays: any match whose details are still kept, on the same version of the game: your matches of this season and the last; other clubs' matches for 3 weeks after they are played (O24 then trims them to a summary). After a game update that changes any balance value, earlier matches cannot be replayed (their reports stay, as now). During a live match you can rewind within the current round but not look ahead.
**Recommendation:** approve as described, including that replays end at an update.
**If deferred:** built as described.

**Q57 — Keep more replays at the cost of save size?**
**Can defer · 01 §8.1 O24, O33; 05 §5, §12 KI-2**

Today's saves peak at about 8.9 MB in season 10 against your 10 MB budget. Option A: no change (0 MB). Option B: keep other clubs' matches replayable for 5 weeks instead of 3 (about +0.6 MB, peak about 9.5 MB). Option C: keep the Reckoning matches of your tier replayable until the next season ends (about +0.1 MB).
**Recommendation:** A; C later if you miss those replays.
**If deferred:** A.

**Q58 — When should a watched fight pause by itself?**
**Can defer · 01 §8.3 P-01 ("auto-pause on configurable events")**

Each trigger is a switch in Settings › Match day. Proposed defaults: on when one of your fighters is downed, when your captain goes down and when overtime starts; off for enemy downs and for "a fighter of yours below 25% HP".
**Recommendation:** these defaults.
**If deferred:** built with these defaults.

**Q59 — What art and sound does M2 include?**
**Required before the M2 handoff · 01 §5 M2 row; 04 §5, §8, §10 (asset-005, asset-006); 01 §8.4 open-032; O22**

Option A: M2 ships placeholder shapes (a coloured disc per fighter with its side ring, role glyphs, bars and badges) and no arena sound; the 42 class icons (asset-005), sprites and arena sound (04 §8) come with the sprite pipeline decision (open-032). Option B: M2 waits for open-032 and ships sprites, icons and sound.
**Recommendation:** A. T1 allows simple shapes first, the skin interface makes sprites a drop-in, and vis-003 is judged on shapes and glyphs.
**If deferred:** A.

**Approve all in one line:** "Approve Q53–Q59 as recommended."

## A15. Working assumptions marked OPEN

| Item | Working assumption | Question |
| --- | --- | --- |
| Calls | Staged after M2 core; types, records, command, event, log swap reserved | Q53 (Q17) |
| Skip watching | Watch (primary) or Simulate at Play match; Streamlined simulates; simulate the rest; skip a round's end | Q54 (open-020) |
| Camera | Top-down orthographic, whole arena, no zoom or follow; projection configurable | Q55 |
| Watchable and replayable | Live: own matches; replay: records kept in full on the same build; live rewind within the round, never ahead | Q56 |
| Retention | No change | Q57 |
| Auto-pause | Own downs, own captain down, overtime on; others off | Q58 |
| Art and audio | Placeholder shapes, role glyphs; no class icons, sprites or arena sound in M2 | Q59 (open-032) |
| Performance | §A10 targets on 05 §8's working reference | Q35 |
| Speed | 1x at first, then the remembered speed per device | — (T1 fixes the speeds) |
| Inspector visibility | Both sides' rules and traces (open-026, M1–M3) | Q10 |

## A16. Top risks

1. **The watched input drifts from the played input** (Freshness, slots, captain CQ, entered flags), so the viewer shows a fight that differs from the committed one. Mitigation: one round-input builder for both; the first WP-M2B test compares hashes; dev builds assert the watched checksum at every commit.
2. **Format 2 accidentally changes an outcome** (a recorder that reads or mutates sim state). Mitigation: recording stays read-only; the checksum and balance-identity tests of WP-M2A.
3. **Frame rate on integrated graphics at 4x with many effects.** Mitigation: object reuse, effect caps and merging, resolution cap 2, the smoke's fps check early; fallback: lower effect density at 4x.
4. **Future-knowledge leaks** through the UI (a debug panel, the scrubber, the round-end card prepared early). Mitigation: live `result` is null, the viewer refuses seeks past the head, a UI test greps the arena screen for the round's winner before the end.
5. **Replays disappear after every content tuning**, which may surprise players across updates. Mitigation: clear reasons in the UI; Q56; FUTURE: archived content versions for replays.
6. **Watching makes matchweeks long** (a 3-round match is 1–2 minutes at 1x), against vis-006's spirit. Mitigation: Simulate is one click, 4x, skip controls, Streamlined; Q54.
7. **WebGL canvas capture** for F8 and the smoke on some drivers. Mitigation: `preserveDrawingBuffer`, `viewer.snapshot()` via PixiJS extract as a fallback.

## A17. Contradictions and gaps found in the design documents

1. **Calls are written as M2 features but cannot be built yet.** 01 §5 and 05 §9 put calls in M2 and 02 §3 has a "Call (M2)" transition, while P-01 and Q17 are unanswered and sys-calls is "not yet written" (03 §3.5): there are no call kinds. → Q53.
2. **The decision trace in the event model is narrower than the spec and the sim.** 03 sys-tactics says the trace records the condition and the observed value; the sim records them (`reason`, `cond`, `observed`, `readyInTicks`), but `core/model` typed only rule, fired and skip. Fixed in the contract (types only, no hash change). Separately, decisions are traced only when they change, so "why was this rule skipped right now" needs the probe (tech-022).
3. **04 §4 requires shield segments and focus bars, but frames carry neither.** → log format 2 (tech-016).
4. **"The viewer never re-simulates" (render README, tech-009) versus "calls are timed inputs to the deterministic sim" (03 §3.5).** A call needs a re-simulation somewhere. Resolved by tech-015: core re-simulates; the viewer only swaps logs.
5. **"M2 records at full level for the viewer" (03 sys-match-report)** could be read as storing full logs; at 255–413 KB per round that breaks O33. Read here as producing full logs on demand.
6. **M2 art scope is inconsistent:** 01 §5's M2 row says "placeholder shapes or sprites for all 42 classes", 04 §10 schedules 42 class icons (asset-005) in M2, and 04 §8 schedules arena sound in M2, while open-032 (the sprite pipeline) is unresolved and O22 excludes the existing pipeline. → Q59.
7. **Zoom and follow** are "OPEN for M2" in 04 §4 and §11 with no owner question. → Q55.
8. **Replays across builds.** 05 §6 promises determinism only within a build, so any content tuning ends every earlier replay; 02 and 04 never say so to the player (04 only covers a report "missing its event log"). → Q56.
9. **The commit point of a watched round.** 02 §3's "Match result" row commits with the week at Play match (D-O); M1.1 commits per round; M2 commits a watched round when its playback ends. P-05 holds in all three; 02 should say so when M2 is approved.
10. **No frame-rate, frame-time or viewer-memory target** exists in 05 §8 or 04 §7 (only UI responsiveness), and the reference machine is still open (Q35). Working targets in §A10.
11. **Colour tokens for arena effects and the floor are missing:** 04 §3 forbids role hues for anything but roles and 04 §5 asks for a mid-value floor, but tokens.css has no floor, wall or hit-tone tokens. → designer request (§A13).
12. **The render README's planned API** (`load(log)`, `onTick`, "interpolating between frame events and drawing deaths") predates squads, the live/replay split, auto-pause and the inspector; replaced by §A5 and the new README.
13. **Mid-fight resume with calls** (02 §3 "quitting mid-fight resumes at the same tick", open-016) needs the cursor saved more often than at round ends; without calls it changes nothing, with calls it bounds a reload exploit (§A6, tech-019). Worth one sentence in 02 §3 when calls are approved.
