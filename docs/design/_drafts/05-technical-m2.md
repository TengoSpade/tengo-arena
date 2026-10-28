# Technical addendum: M2 "Arena viewer" contracts and work packages

> Addendum to [05](../05-technical-design-principles-and-build-plan.md) (§3, §5, §6, §8, §9.2, §10) for M2. Architect, 2026-10-27. Branch `m2/contracts` from main @ 5eb87cd.
> **Status: DRAFT, revision 3** (revision 2 plus the reviewer's three minor fixes: the sim-hash scope, the Q60 alternative, the paths without a shown log; and the owner's answer to Q60). It incorporates the owner's answers of 2026-10-27, which approved **Q53–Q59 as recommended** and chose **option A for Q60**, and an independent architecture review ("approve with changes", then approved; tech-015 confirmed). The approved answers are the design here. The lead designer records them in 01 §8.5 and §8.1; this addendum does not edit 01–05, and its question numbers are proposals until then. The only open question it relies on is **Q35** (the reference machine, for the performance targets). The document as a whole still binds no one until the owner approves it, and implementation waits for that. Owner requirements and O-decisions stay REQUIRED: T1, T4, R1, V1, G1, O1, O12, O20, O22, O24, O33, and D-J under O25's confirmation rules. Technical choices are `tech-015` to `tech-027` (§A12); the owner may override any of them.
> The contracts phase (this branch) adds typed stubs, one behaviour-preserving extraction (`prepareRound`) and the rules and tests that pin them. No game behaviour changed; `npm run check` is green and the soak is unaffected (§A1).

## A0. Summary

M2 lets the player **watch his own match live** and **replay any match whose record is still kept**, in a PixiJS v8 arena at 1x/2x/4x with pause (T1). It has a pause inspector, live rule badges (P-22) and auto-pause (P-01), and uses placeholder shapes that a sprite skin can replace later (T1, O22, open-032; approved in Q59).

**The central choice (tech-015):** core simulates a round headlessly at record level `full`, and the viewer plays that log back. If an input (a call) changes the round, core simulates it again. The viewer never steps the sim. What the player sees is, by construction, the output of the same pure function headless play uses, on inputs built by the same function (`prepareRound`). So the determinism test is a hash comparison, not a parity argument (vis-009, pillar 4). §A2 gives the reasoning against lockstep.

**Calls (P-01) are staged after M2** (Q53, approved). M2 ships pause, the inspector, auto-pause, rule badges, replays, and Watch or Simulate. The calls package follows once the combat designer specifies sys-calls and the owner approves it. The code reserves what calls need now (inputs, records, command, event type, log swap, the meaning of the watch cursor), so adding them needs no save redesign and no viewer redesign.

## A1. What the contracts phase delivered (branch `m2/contracts`)

| Area | Delivered | Where |
| --- | --- | --- |
| Event model | `FIGHT_LOG_FORMAT_VERSION` (1; format 2 planned: frames gain shield and focus); `FightHeader.logFormat?`; `FrameUnit` optional `shield` and `focus`; `RuleTraceEntry` gains the detail the sim already records at `full` (`reason`, `cond`, `observed`, `readyInTicks`); a reserved event type `call.issue` (never emitted) | `src/core/model/events.ts` |
| Match model | Reserved call types (`FightCall`, `SideCallPlan`, `RoundCalls`); `RoundInput.calls?`; `RoundLineups.calls?`; `MatchViewMode`; `LiveWatch` (with `cursorTick` defined as the reveal frontier) and `MatchState.watch?`; `MatchResult.simHash?`; `RoundResult.eventHash` stays null for committed rounds | `src/core/model/match.ts` |
| Commands | `match.watch` (the watch cursor, with optional `mode: 'simulate'`) and `match.call` (reserved); both refused with stable codes until their packages land | `src/core/model/commands.ts`, `src/core/game/commands.ts` |
| core/game | **`prepareRound`** (implemented): the one builder of a round's input, extracted from `playRound` with no behaviour change; `LIVE_MATCH_ALLOWED` exported. Stubs: `AdvanceOptions` (`playerMatch`, `watched`; accepted and ignored for now), `AdvanceOutcome.watch?`, `WatchPause`, `liveRoundPlayback`, `roundPlayback`, `matchPlayback`, `replayAvailability`, `inspectPlayback` | `src/core/game/orchestrator.ts`, `playback.ts`, `live.ts`, `engine.ts`, `index.ts` |
| core/sim | Stubs `inspectRoundAt(input, roundSeed, content, tick): RoundProbe` and `simContentHash(content)` | `src/core/sim/index.ts` |
| src/render | **Pure half:** contract types; the render-state model (`indexFightLog(…, kind)`, `sampleAt`, `eventsBetween`, `decisionAt`, `autoPauseStops(…, untilTick)`, `keyMoments(…, untilTick)`, `samePrefix`, and the injectable `Timeline`); cues; colours; camera; `DEFAULT_AUTO_PAUSE`. **PixiJS half:** `createArenaViewer`, `ArenaViewer` (async `load`, live `endTick` null, `keyMoments()`, `decisionAt()`), `ArenaSkin` (`load`, `prepare(units)`, no rotation by the viewer), `placeholderSkin`. All bodies throw `NotImplementedError` | `src/render/**`, README |
| src/ui | Routes `arena` (`#/arena`) and `replay` (`#/replay/:fixtureId`) with placeholder screens; nothing links to them and the report's Replay button stays disabled. `ArenaFacade` and `MATCH_WATCHING` (`store/arena.ts`); optional `GameEngine` members; `GameStore.advance(options?)` | `src/ui/app/routes.ts`, `src/ui/screens/arena/`, `src/ui/store/` |
| Rules and tests | Architecture rules and checker tests: the two render halves, the lazy viewer import, render/platform separation, core/sim as types only in render. The pure render half is typechecked without DOM (`tsconfig.core.json`) and tested in Node (vitest "core"). The bundle test keeps PixiJS and the viewer out of startup JS, with viewer chunks ≤ 250 KB gzip; ESLint mirrors the import rule. Tests pin `prepareRound` (read-only; `playRound` plays exactly it; the watched checksum equals the committed one) and assert that no command allowed during a live match changes the next round's input | `tests/architecture/`, `tests/build/`, `tsconfig.core.json`, `vitest.config.ts`, `eslint.config.js`, `src/core/game/m2-contracts.test.ts`, `src/render/pure.test.ts` |

No content, no golden, no `ENGINE_VERSION`, no save schema version and no player-visible behaviour changed. `pixi.js` ^8.22 was already a pinned dependency (8.22.0 installed); the stubs import only its types.

## A2. Architecture and data flow

```
GameState ── results[fixtureId] (stored inputs, round records)        liveMatch (the player's match, watch cursor)
     │                                                                          │
     └── core/game: roundInputOf (replay)            prepareRound (live; the builder playRound also uses) ─┘
                    │      (calls copied from the record or liveMatch.watch)
                    ▼
     core/sim simulateRound(input, roundSeed, content, { record: 'full' })   ← the call headless play makes
                    │
                    ▼
     FightLog (header + ~1,300 events: frames every 2 ticks, decisions with traces, casts, hits, statuses...)
                    │   replay: RoundResult.checksum must reproduce;  live: its hash is compared at commit
                    ▼
     src/render/timeline  indexFightLog(log, …, 'live' | 'replay')  →  PlaybackIndex (live: no end tick)
                    │
     PlaybackClock (viewer): tick += dtMs × speed ÷ 50; stops at auto-pause stops, the end, the live head
                    │
     sampleAt(index, tick) → ArenaFrameState ──► src/render/viewer: PixiJS scene (floor, zones, telegraphs,
                    │                                bodies by the skin, token overlays, projectiles, cues)
                    └──────────────────────────────► src/ui arena screen: DOM HUD, fighter strip, feed,
                                                     inspector (≤ 10 Hz; live data only through the viewer)
     Back from the player: pause, seek, speed (viewer only, never state) · cursor at stops, calls → commands →
     core/game → (a call) re-simulate → new log → viewer.replaceLog(log, tick) (prefix-checked)
```

### Decision: playback of a headless round, re-simulated on input (tech-015; confirmed by the review)

| Criterion | Playback (chosen) | Lockstep (sim stepped by the render loop) |
| --- | --- | --- |
| vis-009, viewed = headless | By construction: the viewed log **is** `simulateRound` output for `prepareRound`'s input; tests compare hashes and checksums | Needs a steppable, resumable sim API whose result equals `simulateRound`'s: a second code path to keep identical forever |
| T4 / tech-009 ("the viewer replays event streams, never simulates") | Kept: src/render stays a pure consumer and may import core/sim as types only (rule `render-sim-value`) | Breaks it, or moves a long-lived mutable sim object into core/game state between frames |
| Performance | One sim per round at `full`: median 4.8 ms, max 9.7 ms on the development machine (40 random rounds of `content/default`); the render loop does no sim work | About 3 µs a tick, cheap, but the sim then runs on the render thread at every speed change, seek and resume |
| Calls (P-01) | A call is an input at a tick boundary: core re-simulates from tick 0 with it (≤ 10 ms, while paused) and the viewer swaps logs; every event up to the call tick is identical (prefix property, tested) | A call is applied at the next tick directly; no re-simulation |
| Seeking, replays, auto-pause | Free: random access into the index; auto-pause stops known exactly as playback reaches them | Seeking back needs a re-simulation from tick 0 or snapshots |
| Mid-fight resume (05 §5: "re-simulation to the same tick") | Re-simulate the round with its calls, open the viewer paused at the cursor | The same re-simulation, then step from there |
| Future-knowledge leak | The round's end exists in memory before it is shown. Contained at the type level: a live index has no end tick; key moments and stops are bounded by `untilTick`; the live viewer's `endTick` is null; `RoundPlayback.result` is null; the UI gets live data only from the viewer; a truncated-log equivalence test (§A11) | None in memory |

The future-leak point is the only cost of playback, and it is contained in the types. It also matters less than it looks. **Without calls, a round's outcome is fixed by its inputs** whichever architecture shows it, so watching ahead and reloading changes nothing. With calls, a reload exploit (watch ahead, quit, reload, call earlier) would exist in both architectures. §A6's write-ahead reveal record closes it.

**Commit point (owner answer to Q60, option A).** The owner: "a watched round may play before its result is saved, as long as its lineups, presets and seed are locked and autosaved first, so the outcome is fixed and can't be rerolled." So a watched round's inputs are locked and autosaved before it is shown, and the round itself is committed when its playback ends, or when the player skips to its end, by `advance` playing `prepareRound`'s input through the orchestrator exactly as today. Nothing of its result is in GameState before then. §A3 records the rejected alternative.

**Record level.** 03 sys-match-report says "M2 records at full level for the viewer". Read as: logs at `full` are produced on demand for viewing, and stored results keep their current shape. A `full` log is 255 KB of JSON at the median and 413 KB at the maximum, so storing them would break O33. `RoundResult.eventHash` stays null for every committed round, watched ones included. The watched log's hash is compared at commit and never stored, so a Watch season and a Simulate season end in identical states (§A3).

**Log format version (tech-016).** The viewer needs each fighter's shield and focus every frame (04 §4: "HP bar with shield segment, focus bar"); frames carry neither today. Log format 2 appends both to `FrameUnit`, emits a closing frame at the end tick and names its format in the header. That changes full-level event hashes, but no outcome and no round checksum. Replays and the report timeline are verified by round checksums. So tech-016 versions the recorded shape separately (`FIGHT_LOG_FORMAT_VERSION`) instead of bumping `ENGINE_VERSION`, which would make every stored match of every career unreplayable for a change that alters no result.
- The goldens are re-pinned with the format bump, approved by this addendum. The golden test's rule becomes "an `ENGINE_VERSION` or `FIGHT_LOG_FORMAT_VERSION` bump".
- `ENGINE_VERSION` stays 2, round checksums do not move, and summary-level events are unchanged apart from the header's new field (tested).
- No stored data holds an event hash of a round, so nothing depends on the old hashes. The sim's fast-path hash must still equal the full hash with six-element frames (tested).

## A3. Match flow, playback, saves

**Watch or Simulate (open-020; owner answer to Q54, approved).**
- Play match offers **Watch** (primary) and **Simulate**. The choice is fixed with the squad lock (`AdvanceOptions.playerMatch` → `liveMatch.watch.mode`), and the Streamlined pacing preset (D-L) simulates.
- Simulate is the M1.1 flow, unchanged.
- Without calls, Watch and Simulate give identical results (tested over a season); with calls, Simulate gives the player's side the AI call policy.

**Live match states** (core/game, WP-M2B; Q60 option A):

| Step | `liveMatch` | Screen | Autosave (`auto-round`) |
| --- | --- | --- | --- |
| Play match (Watch): lock, `startMatch`, no round played | phase `round_pending`, `watch { mode 'watch', round 1, cursorTick 0, calls [] }`; `AdvanceOutcome.watch` set | `#/arena` opens **only after this autosave has succeeded**; on failure the viewer stays closed with "Could not save: Retry" | **required** (review B3) |
| Watching | unchanged; nothing is written while playback runs | viewer | — |
| Playback stops: pause, auto-pause, window hidden | `match.watch { tick }` (the cursor = the shown tick) | viewer | yes, while stopped (no frame to hitch) |
| Round end reached, or "Skip to end of round" | `advance({ watched: { round, logHash } })` with the hash of the log the viewer loaded: plays `prepareRound`'s input at `full`, refuses with `watch.mismatch` unless the hashes match (every build), commits (P-05), runs the hooks; then the between-round step | the round-end overlay (non-blocking, §A7), then `#/between-rounds` per `pauseBetweenRounds` (unchanged), or straight to the next round | yes (as today) |
| `advance` with no shown log while watching (Continue from Home or another screen, a stale tab, a harness) | refused with `watch.not-shown` (no state) | the UI routes it to `#/arena`; Home's Continue reads "Resume watching" and navigates there instead of advancing | — |
| Between rounds → Continue | swaps applied; phase `round_pending`, `watch.round` n + 1, cursor 0 | `#/arena` (after the autosave, as above) | required |
| "Simulate the rest" | `match.watch { mode: 'simulate' }`, then `advance` with no `watched` hash (not required once the mode is 'simulate'): the current round is committed from `prepareRound` with its calls (its outcome was fixed at the lock), later rounds are simulated; Watch never comes back within the match | M1.1 flow | yes |
| Deciding round committed | `liveMatch` null; the week finishes (AI matches are simulated now, after the player's match, as today) | report per pacing (D-L) | weekly rotation |

**Who supplies `AdvanceOptions.watched`.** It is required exactly while `watch.mode` is 'watch' and `watch.round` is set. The viewer supplies the hash of the log it loaded (`RoundPlayback.log.hash`) at the round's end and on "Skip to end of round". After a resume, the viewer first re-simulates and loads the round, and skipping stays disabled until it has. Every other caller gets `watch.not-shown`, which routes to `#/arena`. "Simulate the rest" changes the mode first, so it needs no hash.

**Only these commands are accepted during a live match** (`LIVE_MATCH_ALLOWED`: `match.swap`, which is refused while a round is pending; news; shortlist; level-up policy; auto-swap rules; pacing; and from WP-M2B `match.watch`). None of them changes the next round's input; a test pins that for every entry, so any later addition fails it.

**Cursor saves (tech-019; review B4).** A full save costs 19–39 ms for `createSave` and serialization alone on 4–7.6 MB saves, which hitches a 30 fps floor. So **M2 persists the cursor only when playback stops**: pause, auto-pause, round end, window hidden. No frame is drawn then. `LiveWatch.cursorTick` is fixed now, because save v5 freezes it: it is **the reveal frontier**, an integer fight tick at or beyond every tick the player may have been shown before the save. A reload resumes there, paused, and (calls package) calls are accepted only after it. In M2 it equals the shown tick at the last stop. A quit while playing resumes at the last stop, earlier than the shown tick; the outcome is unaffected (A17 item 14).

**Speed and pause (T1).** Presentation only (T4, 05 §6): they change the playback clock (`tick += dtMs × speed ÷ 50`, `dtMs` clamped to 100 ms so a hidden tab never jumps), never an input. A round starts at the remembered speed (per device, outside saves).

**Auto-pause (P-01; owner answer to Q58, approved).** On by default: our fighter downed, our captain down, overtime start. Off by default: an enemy downed, our fighter below an HP threshold. Each is a toggle in Settings › Match day. The viewer asks `autoPauseStops(…, untilTick)` for the tick it is advancing to and stops after drawing that tick, so the cause is on screen. A live round also pauses when the window is hidden (setting, on by default), which also saves the cursor.

**Seeking (owner answer to Q56, approved).**
- *Replays:* free seeking on a scrubber with key-moment marks, round tabs, and ← → (one frame, 0.1 s) or Shift ← → (one second) while paused. `#/replay/<id>?round=2&tick=340` from the report's key moments (04 ui-report) starts 2 s before the moment.
- *Live:* rewinding within the current round is allowed, and "Live" returns to the head. The scrubber spans 0 to the head; it never shows the end or marks beyond the head. Seeking past the head is refused, and calls (later) are possible only at the head.
- Seeking costs a few binary searches, never a re-simulation.

**Skip watching (open-020, approved).** Three levels: Simulate at Play match; "Simulate the rest" in the viewer; "Skip to end of round" (Shift S, asks once when live). All three commit exactly the result the inputs give.

**Mid-fight resume (05 §5).** Loading a save whose `liveMatch.watch.round` is set opens `#/arena`. It re-simulates that round with its calls (`liveRoundPlayback`) and opens it paused at `cursorTick` with a "Resumed" toast. The outcome is the one the inputs give, so a reload cannot reroll it (P-05). A manual save while paused first persists the cursor.

**Rejected alternative (Q60 option B), for the record.** B would simulate, commit and autosave the round before its playback starts, the literal D-O. In core that is one function. But the result would then sit in GameState while the round plays: the score, rounds and phase, the Freshness drain, round XP and injuries on the fighters, the save's "after round n" label, and the winner in `MatchPlayback`. Every screen reading those (HUD pips, fighter strip, Saves, resume routing, badges) would have needed read rules and a pre-round snapshot during playback, plus a leak test over state-derived data. Calls could never apply to such rounds. The owner chose A, so WP-M2B builds only A and keeps no switch.

**Save schema (WP-M2B, tech-023).** State schema **v5** with an identity migration from v4:
- New fields: `MatchState.watch` (`LiveWatch`, under 0.2 KB), `RoundLineups.calls` (absent until calls exist; under 0.5 KB a match with them) and `MatchResult.simHash` (about 40 bytes a match, about 15 KB a season over every stored result). All join the strict zod schema, with `SAVE_BOUNDS` for the call count.
- The version moves although every field is optional: the schema is strict, and an M1.1 build must refuse a v5 save (`save.too-new`) instead of failing validation.
- `STATE_SCHEMA_VERSION` (`core/model/game-state.ts`) and `SAVE_BOUNDS` (`core/content/save-bounds.ts`) are architect-owned. They are granted to WP-M2B as exceptions (§A13).

**Core API (fixed contract, `core/game`).**
- Functions: `advance(state, content, options?)`; `prepareRound(ports, state, ms, content)` (implemented); `liveRoundPlayback(state, content)`; `roundPlayback(state, fixtureId, round, content)` (committed rounds, from `results` or from the live match's earlier rounds); `matchPlayback(state, fixtureId, content)`; `replayAvailability(state, fixtureId, content)`; `inspectPlayback(state, fixtureId, round, tick, content)`.
- A live `RoundPlayback.result` is always null.
- `liveRoundPlayback` must use `prepareRound`; it is the only builder of a round's input.

## A4. Replay availability (owner answer to Q56, approved)

A replay re-simulates stored inputs. It needs (1) the inputs and round records and (2) the same sim: the stored `engineVersion` equals `ENGINE_VERSION`, and **the stored `simHash` equals `simContentHash(content)`**.
- `simContentHash` is a hash of exactly what the fight reads (tech-026; `HASH_EXCLUDED` is the precedent for leaving keys out): a canonical serialization of what `simTables` compiles plus every direct ContentDB read of core/sim and core/tactics. That includes reads outside `combat` such as `development.captaincy.grades`, `actingCaptainCqPenalty` and `levels.freshness.labels`; a read-set test guards it. That honours the owner's wording: replays end at a balance-changing update, not at a renamed club or a tuned wage.
- Results written before M2 have no `simHash` and fall back to the content hash.
- The career content hash (saves, `GameState.content`, the load warning) is unchanged.
- One rule (`replayAvailability`) serves replays and the report timeline, so the report's per-round box-score lines also survive non-sim updates (WP-M2B switches `buildMatchReport` to it).

| Match | Watch live | Replay | Reason when not |
| --- | --- | --- | --- |
| The player's match in progress | yes (Watch) | its committed rounds: yes | `live` for the whole-match button; earlier rounds through the between-round screen |
| The player's matches, this season and last | — | yes, while the sim is the same | never compacted in the season (O24) and kept for the current and previous season (05 §5) |
| The player's older matches | — | no | results older than last season are dropped (`compacted`: "not kept in full") |
| Matches between other clubs, within 3 weeks of play | — | yes, while the sim is the same | — |
| Matches between other clubs, compacted (3 weeks after play, or at season end) | — | no | `compacted` (O24 dropped their inputs and round records) |
| Any match, after an update that changes `ENGINE_VERSION` or anything the fight reads (combat, classes' combat fields, abilities, ranks, perks, presets and vocabulary, race combat mods, sim-applied trait effects, captaincy grades and the acting-captain penalty, Freshness labels) | — | no | `other-build` |
| Any match after an update that changes nothing the fight reads (names, clubs, economy, calendar, development outside captaincy) | — | yes | — |
| M1 results (engine 1) | — | no | `other-build` |

**What O24 means for M2.** Matches between other clubs are replayable for 3 weeks (`leagues.json matchRecords.compactAiMatchesAfterWeeks`). That covers the useful case: the next opponent's last match is usually a week old (not in the first matchweek, when it belongs to last season). Reckoning matches between other clubs are compacted at the season end. The player's own matches are always replayable in their season and the next, while the sim stays the same.

**UI states.** Replay buttons (report, fixtures, Home's last result) are enabled when available and otherwise disabled, with the reason as a tooltip:
- `compacted`: "Older matches between other clubs keep only their summary, to keep saves small".
- `other-build`: "Played before a balance update: the replay cannot be rebuilt. The report is unchanged".
- `live`: "Your match is in progress".

The UI designer owns the wording (EXAMPLE). A replay whose checksum does not reproduce is a defect: it is reported (`replay.mismatch`), never shown.

**Retention (owner answer to Q57, approved: no change).** No new retention is needed for the player's own matches; other clubs' matches keep the 3-week window. For the record, the options measured on main for KI-2 were 7.6 MB at the season-3 in-season peak (3 weeks), 8.2 MB (5 weeks) and 12.3 MB (no compaction). The season-10 peak with 3 weeks is 8.9 MB of the 10 MB budget (O33).

## A5. Rendering

### Module layout (tech-017)

| Path | Half | Contents | Owner |
| --- | --- | --- | --- |
| `src/render/index.ts`, `types.ts` | pure | Public pure API and contract types | architect |
| `src/render/timeline/` | pure | Render-state model: index, sample, bounded queries, the injectable `Timeline` | WP-M2C |
| `src/render/cues/`, `colors/`, `camera/` | pure | Cue table from content, team colours and contrast, projection | WP-M2C |
| `src/render/viewer/` | PixiJS | `createArenaViewer`: application, playback clock, scene, overlays, cues, input; `skin.ts` (contract, architect) | WP-M2D |
| `src/render/skins/placeholder/` | PixiJS | The M2 placeholder skin | WP-M2D |

The pure half is typechecked with the ECMAScript lib only (`tsconfig.core.json`) and tested in Node (vitest "core"). It imports no `pixi.js` and touches no DOM, clock, timer, `matchMedia`, `getComputedStyle`, `devicePixelRatio`, `ResizeObserver` or randomness (rule `render-pure`). src/ui imports `src/render` statically from lazy screen chunks, and `src/render/viewer` only with `import()` or `import type` (`ui-render-viewer-static`). src/render imports core/sim as types only (`render-sim-value`).

### PixiJS v8 as a lazy chunk (tech-024, tech-025)

- **Loading.** The arena screens (lazy routes) `import('../../../render/viewer')` on mount; Squad and Home prefetch it at idle in a matchweek. PixiJS and the viewer stay out of the startup JS (bundle test), within a viewer budget of 250 KB gzip (TUNABLE (tech)). PixiJS with Application, Graphics, Container, Text and Sprite minifies to about 165 KB gzip (esbuild measurement; an upper bound, since it includes every module PixiJS loads lazily, such as its WebGPU path). No network at run time (P-15).
- **Init.** `await app.init({ preference: 'webgl', antialias: true, autoDensity: true, resolution: min(devicePixelRatio, 2), preserveDrawingBuffer: true, backgroundAlpha: 0 })`, with the canvas filling the host. `preserveDrawingBuffer` lets the F8 ticket screenshot (modern-screenshot) and `viewer.snapshot()` read the WebGL canvas. WebGL is the predictable target for both desktop wrappers (05 §8).
- **Render loop.** PixiJS's ticker drives one callback per display frame: advance the playback clock, `sampleAt`, update the scene (objects reused, keyed by unit index and event seq), render. The HUD gets `onFrame` at ≤ 10 Hz and at every pause, seek and stop. The ticker stops while paused and restarts on play or seek.
- **Resize and DPR.** A ResizeObserver on the host resizes the renderer and recomputes `viewTransform`: a letterboxed 16:9 arena inside the HUD padding (56 px top, 72 px bottom, 04 §4). A `matchMedia('(resolution: …dppx)')` listener follows DPR changes when the window moves between monitors. The arena never scrolls at zoom 1 (04 §4).
- **Loading a round.** `ArenaViewer.load` is async: it awaits `skin.prepare(units)`, so the first frame never waits on a texture.
- **Teardown.** `destroy()` stops the ticker, destroys textures and the WebGL context, and removes the canvas. Loading a new round destroys the previous round's visuals (no growth across rounds, smoke-tested).

### The render-state model

`indexFightLog(log, content, cues, kind)` turns the ~1,300 events of a round into per-unit interval lists once (frames, decisions, casts, statuses, shields, projectiles, zones, downs). After that, `sampleAt(index, tick)` is a pure function of `(log, tick, context)`: the same state whether playback reached the tick at 1x, at 4x or by seeking (tested).
- **Interpolation.** Positions are interpolated linearly between frames (every 2 ticks, 0.1 s). HP, shield and focus step at frames; format 1 logs give `shield` and `focus` null, and the bars hide them rather than guess.
- **Discrete state and facing.** Discrete state comes from the intervals. Facing points at the committed target, else along the movement.
- **Bounded for live rounds (review B1).** A live index has `endTick` null. `keyMoments` and `autoPauseStops` take `untilTick`. `ArenaFrameState.endTick` is set only once the end is reached.
- **Effect ids.** Effects carry their event's seq as a stable id, so the scene keeps one visual per effect.

### Asset and skin interface (tech-020; review B6)

The viewer owns every mark with game meaning and draws it above the skin: the side ring, the role glyph(s), the facing wedge, HP, shield and focus bars, status pips, the captain crown, the rule badge, telegraphs and cues. A skin draws only **bodies and the floor**, so it can never hide a vis-003 cue, and sprites "add to the token and never replace it" (art research §2).
- `ArenaSkin` API: `load(ctx)` once per viewer (shared resources); `prepare(units)` before every round (only the classes of that match); `createBody(info, colors) → BodyVisual { view, update(state, frame) }`; `createFloor`; `setPalette`; `destroy`.
- **The viewer translates and depth-sorts bodies and never rotates or mirrors them.** A body picks its own direction or frame from `UnitRenderState.facing`. Fixed-direction sprites in a 3/4 view must not be rotated.

Skins:
- **Placeholder skin (M2; approved in Q59).** Generated shapes, no image files: a disc of the fighter radius (0.5 m) in the side's primary with a secondary rim; downed: flattened, 40% opacity (asset-006). A flat mid-value floor, centre line and walls (04 §5).
- **Sprite skin (after open-032).** The same interface over atlases: a base layer plus two greyscale team-mask layers tinted with `TeamColors.primary` and `.secondary` (research §6, PixiJS `tint`); animation from `UnitRenderState.action`; facing quantised by the skin to the directions the owner picks (art §12 Q4).
  - `prepare` loads at most the 14 fighters' classes of a match (5 + 2 a side), within the texture budget (≤ 32 MB GPU) and ≤ 300 ms from the local bundle (TUNABLE (tech)), and releases what the next match does not need.
  - Atlases ship in the bundle (offline).

### Team colours, role glyphs, bars and cues

- **Team colours** (`colorsForMatch`, asset-006, research §6).
  - The player's side ring is brass (`--c-side-us`), the opponent's steel blue (`--c-side-them`).
  - Between other clubs, both rings take the clubs' primaries; when the primaries are too close, the away side becomes secondary-dominant.
  - Every ring and body colour reaches 3:1 against the floor (04 §9). The ring style (player solid, opponent double) is the colour-free side cue.
- **Role glyphs (D-J).** Shape first, colour second. The five SVG shapes come from the `--glyph-*` tokens in `tokens.css` and the hues from `--c-role-*`, through `ArenaPalette` read by the host from computed style. So the arena and the UI share one source and follow the theme. Hybrids show both glyphs. Role hues are used for nothing else (04 §3).
- **Bars.** HP in neutral parchment on a dark track (no red/green meaning), a shield segment beyond it, a thin focus bar below. Labels stack above the HP bar (04 §4).
- **Status pips** (`StatusCue`): up to 4 above the HP bar by priority (hard control first), each a category glyph. Hard control also greys the ring (asset-006).
- **Freshness** (O19: constant within a round): a "Tired (52)" or "Spent (28)" tag above the token for the first 3 s of the round, and permanently in the fighter strip and the inspector (from `fight.start` unit data).
- **Captain crown** on the acting captain, moving on `captain.handover`; rally and captain-down cues.
- **Rule badge** (P-22, 04 §7): "R3" above the token, "S" for the stance, "T" while taunted. It pulses 220 ms on a new decision (static under reduced motion), and the strip repeats it.
- **Downs and their cause (vis-003).** A diamond down marker in the side colour (as in the report), a callout "Knight downed by Assassin · Shadowstep" for 2 s, and a persistent entry in the live feed. Auto-pause on our downs is on by default.

### Ability cues, data-driven (tech-021; review B10)

`buildCueTable(content)` derives a cue for every ability and status from its definition, with no ability or class id in code.
- **Exhaustive switch.** It switches **exhaustively** over the 17 effect types (`AbilityEffectType`, `assertNever` on the default branch), so a new effect type fails to compile until it has a cue. Nested effects (chain, splash, zone, onKill) are walked.
- **Visible release.** Every one of the **84 active abilities** of `content/default` must have a visible release cue (`release` ≠ `'none'`); a test checks it, and a fallback does not count.
- **Statuses.** All 34 statuses map to a pip.

| Source | Cue |
| --- | --- |
| basic, melee range | swing arc at the target, impact spark |
| `delivery: projectile` (and ranged basics) | a projectile glyph from caster to target over `[launch, landTick]`, at least 10 px (research A4.2: no tiny projectiles), impact on landing; an area projectile bursts at its point |
| `delivery: instant`, single target | a short beam caster → target |
| `delivery: dash` / `leap`; effect `dash` | a trail along the `displace` path |
| `area` circle, cone, line | telegraph during the windup or cast (from `cast.start` and `area`), then an area flash at release |
| `castTimeS` or `channel` of 0.3 s or more (6 ticks) | telegraph arc and cast bar (04 §7); channels pulse at each tick |
| effect `damage` (physical, arcane, true) | impact in the damage tone (designer tokens `--c-fx-physical`, `--c-fx-arcane`, requested) and a number |
| effect `heal`, `heal_recent_damage` | heal pulse and "+N" number |
| effect `shield` | shield ring segment |
| effect `status` | status pip; hard control (stun, sleep, taunt, silence) gets the stronger control cue |
| effect `knockback`, `pull` | a displacement streak along the push or pull |
| effect `interrupt` | an interrupt burst on the target's cast bar |
| effect `cleanse` | a rising cleanse ring on the ally, the removed pips fading |
| effect `dispel` | a breaking ring on the enemy, the removed buff pips shattering |
| effect `guard` | a guard link (a line from guard to ward) while it lasts |
| effect `chain` | an arc jumping from target to target, one hop per bounce |
| effect `splash` | a small area flash at the primary target |
| effect `zone` | a floor disc in the owner's side colour at low alpha, a pulse on triggers, a fade on expiry |
| effect `cooldown` | a cooldown-reset glint on the caster |
| effect `focus` | a focus-gain glint on the focus bar |
| crit, evade | larger number; "Evade" text |

A theme's skin may later override cues per ability from its own data file (designer-owned, FUTURE).

### Telegraphs and readability (vis-003)

Every token always shows the side ring, the role glyph(s) and the HP bar, so observers name tanks and healers from glyph shapes, not colour. Casts of 0.3 s or more telegraph their area or target line with progress; hard control greys the ring; downs name their cause. Effects are rate-limited: at most 3 flashes a second per fighter, and no full-screen flashes (04 §9). Clutter control (research A4.2):
- no decoration that could read as gameplay (open-019);
- effects fade within 400 ms at 1x, and at most one number per fighter per 100 ms is drawn (merged); both values TUNABLE by the UI designer;
- names show on the selected fighter (L toggles all).

### Camera (owner answer to Q55, approved)

M2 is top-down orthographic, showing the whole arena with fixed framing (04 §4, P-03), at about 52 px per metre at 1920 × 1080. The projection stays configuration (`CameraConfig.projection`: `top-down`, or `oblique` with a tilt for a 3/4 view, art §12 Q4), as do zoom (1, 1.5, 2) and follow. A 3/4 view, zoom and follow are decided with the sprite pipeline. `viewTransform` is pure and shared by the scene and pointer hit-testing, and depth is sorted by y in both projections.

### Pause inspector (P-22)

Selecting a fighter (click, Tab) while paused opens the inspector, a DOM panel. For a live round its data comes through the viewer (`decisionAt()`) and `inspectPlayback`, never from the UI indexing the log.

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

From M4 the inspector reads opponents through the viewing club's knowledge (P-13: opponents' rules only when scouted). M2 shows both sides (open-026).

## A6. Calls (P-01): staged after M2 (owner answer to Q53, approved)

**Design for the calls package (so the reservation is coherent):**
- **A committed input at a tick boundary.** `FightCall { tick, kind, target? }` applies at the **start** of `tick`, before the timers. The viewer pauses only on frame ticks (every 2 ticks), so a call made while paused on frame tick f applies at f + 1, and every event up to and including f is unchanged. That is the prefix property; `samePrefix` checks it before the viewer swaps logs.
- **The same for the AI** (P-04). Each side's plan per round is `none`, `policy` or `explicit`. `policy` is the AI call policy, evaluated inside the sim at decision ticks against the fight-observable `BattleView`, so it never sees hidden or future state. `explicit` is the player's calls. Every AI club, and a player who simulates, uses `policy`. The budget (2 per round, P-01) comes from content.
- **Reproducible on replay.** The plans are recorded per round in `RoundLineups.calls`; `roundInputOf` copies them into `RoundInput.calls`. Policy calls follow from the inputs.
- **Committed when issued.** `match.call` validates (budget, tick > cursor, acting captain), persists, and writes the round autosave. Core re-simulates the round with the new plan, and the viewer swaps logs.
- **Through the captain** (sys-fight-captain rule 5). The acting captain relays. What a call does, its delay, and what happens without an acting captain are for sys-calls to specify.
- **Engine bump.** Calls change every outcome (AI clubs spend them), so the package bumps `ENGINE_VERSION`; earlier matches stop being replayable once, as with any sim change. Calls need Q60 option A for the rounds where they are possible.

**Write-ahead reveal limit (closes the reload exploit; review B4).** Before the viewer shows any tick beyond R, a small separate record `{ careerId, fixtureId, round, revealedTick: R }` is written durably. It lives in the save store under its own key: about 100 bytes, about 1 ms, not the full save.
- R advances in steps of W fight ticks ahead of the head (W = 200, 10 s of fight time at any speed, TUNABLE (tech)). If the write has not completed, the viewer holds at R.
- On load, the cursor is max(`liveMatch.watch.cursorTick`, `revealedTick`), and calls are accepted only after it. So a reload can never place a call before anything the player may have seen. The cost is that a reload resumes up to W ticks ahead of the last shown tick; those ticks can be rewatched but not called in.
- The record exists only with calls. M2 has nothing to protect: its outcomes are fixed by the inputs.

**Reserved now:**
- Types and fields: `FightCall`, `SideCallPlan`, `RoundCalls`, `RoundInput.calls` (WP-M2A makes the sim refuse any plan but none until then), `RoundLineups.calls`, `LiveWatch.calls`, and the meaning of `LiveWatch.cursorTick`.
- Log, command and viewer: the event type `call.issue`; the command `match.call` (refused with `match.calls-unavailable`); `ArenaViewer.replaceLog` and `samePrefix`.
- UI: the effect kind and key-moment kind `call`; the HUD's calls-left slot (hidden).

## A7. User interface (WP-M2E)

- **Routes** (contract): `#/arena` (the live round) and `#/replay/:fixtureId` (`?round`, `?tick`); both lazy; placeholders until WP-M2E.
- **Arena screen.** The canvas fills the content area under a DOM HUD (T3):
  - top strip, 56 px: crests, score, round pips, clock (amber in overtime from 45 s), standing counts, speed, pause, later calls left;
  - bottom fighter strip, 72 px, both sides: portrait, name, HP, rule badge, Freshness tag, a down marker;
  - a live feed of key moments (aria-live, polite), the inspector panel, the round-end overlay and the controls.
- **Live data only through the viewer (review B1).** For a live round, the screen renders round data only from `onFrame`, `viewer.keyMoments()`, `viewer.decisionAt()` and `viewer.headTick`; `viewer.endTick` stays null until reached. The scrubber spans 0 to the head. The screen never indexes or reads the live log itself.
- **Play match.** Offers Watch (primary) and Simulate (Q54). It calls `store.advance({ playerMatch })`, and `MATCH_WATCHING` routes to `#/arena` only after the lock's `auto-round` write has succeeded. The store must not ignore that failure as it does for other autosaves (`create-store.ts` today): on failure it returns `save.round-failed`, shows "Could not save: Retry" and keeps the viewer closed.
- **Round end.** The round-end overlay is non-blocking (1.5 s, skipped by any key) and then the between-round screen opens by itself. So a round boundary still costs one input, as ux-001 counts (A17 item 15). Its Continue calls `ArenaFacade.finishRound({ round, logHash })`. The between-round screen gains "Replay round n", and its Continue opens the next round in the viewer.
- **Resume.** On load, a live match with `watch.round` set resumes in `#/arena`.
- **Replay entry.** The report's Replay button (today disabled) and its key moments; Fixtures and Home's last result get a replay icon when available; reasons appear as tooltips (§A4).
- **Store.** `ArenaFacade` (fixed contract) sits over the GameStore, like `MatchDayFacade`. Cursor saves happen at stops only (tech-019). Viewer settings (`ArenaSettings`) are per device, outside saves, in the UI settings record.
- **Keyboard** (04 §9: every action by keyboard). Remappable like the other shortcuts.
  - Space play or pause; 1, 2, 4 speed (or [ ] to cycle).
  - ← → a frame, Shift ← → a second, while paused (replay and live rewind).
  - Tab and Shift Tab select a fighter; Enter or I opens the inspector; L labels.
  - Home recentre; Shift S skip to the end of the round; Esc close or back.
- **Settings › Match day:** Watch preference, speed, auto-pause triggers, labels, pause when hidden.
- **F8 tickets** on the arena screen add fixture, round, tick, speed and kind to `ticket.json`; the screenshot includes the canvas (`preserveDrawingBuffer`).
- **Test hook** (dev builds and the `smoke` build mode only, tech-027): `window.__arena.viewer` with `frame()`, `seek(t)`, `play()`, `pause()`, `setSpeed(s)`, `stats()`, `logHash()` and `loadFixtureRound()` (a fixed round of the dev world).

## A8. Module boundaries, rules and bundle

- **Dependency direction** (05 §3.1, amended):
  - `src/ui → src/render`: the pure index statically; the viewer only by `import()` or `import type`.
  - `src/render → core/{util, rng, model, content}`; core/sim as types only.
  - `src/render` and `src/platform` never import each other.
  - Inside src/render, the pure half imports nothing from the PixiJS half.
  - No new core module: core/game and core/sim gain functions, core/model gains types.
- **Rules added** (`tests/architecture/rules.ts`, with checker tests):
  - `render-pure`: in the pure half, no `pixi.js`, no import of `viewer/` or `skins/`, and no DOM, clock, timer, `matchMedia`, `getComputedStyle`, `devicePixelRatio`, `ResizeObserver`, `crypto` or `Math.random`; test files exempt.
  - `render-sim-value`: core/sim as types only.
  - `render-deep-import` and `ui-render-viewer-static`: src/ui into src/render.
  - `platform-imports-render`, `render-imports-platform`.
  - ESLint mirrors the pure-half import rule.
- **Type and test environment.** The pure half is in `tsconfig.core.json` (no DOM types), and its tests run in the vitest "core" project (Node). The viewer and skins test in "ui" (happy-dom).
- **Bundle** (`tests/build/bundle.test.ts`): no module of `pixi.js`, `src/render/viewer` or `src/render/skins` in the startup JS; those chunks together ≤ 250 KB gzip. WP-M2E adds an assertion that the production build contains no test hook.
- **Save schema:** v5 (§A3), WP-M2B.

## A9. Accessibility and reduced motion (04 §9)

- **Redundancy.** Role = glyph shape + hue + name in the strip and inspector. Side = ring colour + ring style. Status = pip glyph + colour. Tired and Spent appear as words. The smoke takes screenshots under CDP's emulated deuteranopia, protanopia, tritanopia and achromatopsia (the arena's art-005).
- **Contrast.** Rings, glyphs and bars ≥ 3:1 against the floor, text ≥ 4.5:1 (`contrastRatio`, unit-tested over all 48 club colour pairs and both themes).
- **Reduced motion** (OS or Settings). No pulses, trails or floating numbers (numbers appear and fade in place), no camera ease, effects at their end state. Telegraph progress stays, because it is information. Flashing is ≤ 3 a second always, and there is no screen shake.
- **Input.** No timing demand anywhere (pause is free and unlimited, P-01); everything by keyboard; a visible focus ring on the canvas and on the selected token.
- **Screen readers (best effort).** HUD, strip, feed and inspector are DOM; the feed announces downs, overtime and the round end. The canvas has `role="img"` and a label summarised at each pause.
- **Interface scale** (85–150%). The DOM HUD scales with `--ui-scale`, and canvas labels and pips scale with it too (read at mount and on change).

## A10. Performance targets and memory

Reference machine: 05 §8's working reference (a 2020+ mid-range 4-core, 8 GB laptop with current Chromium), OPEN until Q35. All values TUNABLE (tech), measured by the smoke and reported per package.

| Constraint | Target |
| --- | --- |
| Arena frame rate, 1920 × 1080, resolution ≤ 2, 1x and 4x | 60 fps target; p95 frame interval ≤ 20 ms; never below 30 fps, including across a cursor save (a stop) and the resume after it |
| Our CPU per frame (clock + `sampleAt` + scene update) | p95 ≤ 4 ms |
| Round load (`roundPlayback` / `liveRoundPlayback`: sim at `full` + `indexFightLog`) | median ≤ 15 ms, p99 ≤ 30 ms (sim alone: median 4.8 ms, max 9.7 ms measured) |
| Commit of a watched round (the `full` replay of `prepareRound` and the hash comparison) | ≤ 15 ms |
| Cursor save (`match.watch` + `auto-round`) | at stops only; 19–39 ms for `createSave` + serialization on today's 4–7.6 MB saves, invisible while stopped |
| Call re-simulation and log swap (calls package); reveal record write | ≤ 30 ms while paused; about 1 ms |
| Probe (`inspectPlayback`) | ≤ 15 ms |
| First viewer open (lazy chunk + PixiJS init + `prepare`), local files | ≤ 500 ms; prefetched at idle in a matchweek |
| HUD updates | ≤ 10 Hz, ≤ 2 ms each |
| Startup JS | unchanged, ≤ 250 KB gzip (about 219 KB now) |
| Viewer chunks | ≤ 250 KB gzip |
| Memory: logs | one round's log is 255 KB JSON at the median, 413 KB at the maximum; the viewer keeps the current round's log and index and the previous round's |
| Memory: heap and textures | JS heap growth ≤ 50 MB while viewing; GPU textures ≤ 32 MB (placeholder and per-match sprite atlases); no growth over 20 consecutive rounds; the app within 05 §8's 400 MB |
| Save | < 1 KB per watched match, plus `simHash` on every result (about 15 KB a season) |

## A11. Testing strategy

**Test first** (review; each in its package's acceptance, §A13):
1. **Watch season = Simulate season:** identical round checksums and final state checksum, with swaps, injuries, an emergency entrant and a captain handover (WP-M2B).
2. **A failed or interrupted `auto-round` write at Play match (Watch):** the viewer stays closed. A reload lands on the last good save with no round shown, and Play match from it locks the same lineup and plays the same round (WP-M2E, with a failing save store).
3. **The fake-viewer leak test** (WP-M2E, below).
4. **Format 2:** 200 rounds and `npm run balance -- --fights 2000 --seed balance-1` identical to main, and the fast-path hash still equal to the full hash with six-element frames (WP-M2A).
5. **A frame-time trace at 4x across a cursor save:** an auto-pause stop, the save, the resume; no frame over 33 ms (WP-M2F).

**Determinism (Node, Vitest; vis-009).**
- *Watched = committed* (contracts phase, `m2-contracts.test.ts`). `prepareRound` is read-only; `playRound` plays exactly its input; the `full` log of that input has the committed checksum. No command in `LIVE_MATCH_ALLOWED` changes the next round's input, and `match.swap` is refused while a round is pending.
- *Commit check* (WP-M2B). `advance` with a wrong `watched.logHash` returns `watch.mismatch` and no state; with the right one, it commits; without one while watching it returns `watch.not-shown` and no state; after `match.watch { mode: 'simulate' }` it commits without one, with the same checksum as the watched path. This holds in every build. WP-M2E tests that `watch.not-shown` routes to `#/arena` and that Home's Continue reads "Resume watching" while a round is being watched.
- *Replay = original* (WP-M2B). Every round of played matches with swaps, injuries and an emergency entrant re-simulates to its stored checksum, and the replay log hash equals the live log hash captured while watching.
- *Format 2* (WP-M2A). As test-first item 4; full-level goldens are re-pinned once.
- *Replay hash* (WP-M2A). The hash covers what `simTables` compiles plus every direct read of the fight (tech-026), not a hand-kept key list.
  - *Read-set guard:* a corpus of seeded rounds runs on a ContentDB that records every property path the fight touches; a touched path outside the hashed set fails the test.
  - *Changes that must move the hash:* `development.captaincy.grades`, `actingCaptainCqPenalty`, `levels.freshness.labels`, an ability coefficient, a preset rule, a combat constant.
  - *Changes that must not:* any excluded key (names, descriptions, icons, wages, calendar, development outside captaincy) leaves the hash and the corpus's round checksums unchanged.
- *Resume* (WP-M2B). Save at a cursor, parse, `liveRoundPlayback`: identical log, start tick and committed result.
- *Probe* (WP-M2A). `inspectRoundAt` never changes a later result; at a tick where a decision was traced, its evaluation matches the recorded trace.
- *Cross-runtime.* The smoke computes a fixture round's `hashEventStream` in Chromium and compares it with Node's pinned golden (05 §10 "golden hash in Node and Chromium").
- *Calls (later).* The prefix property; same calls give the same hash; the AI policy is identical headless and viewed; the reveal record bounds a reload.

**Render-state model without a GPU (Node, WP-M2C).** On fixture logs from the sim, the tests cover:
- *Sampling:* interpolation at and between frames; `sampleAt` path-independence (played at 1x, at 4x, or seeked: identical states); status intervals; cast progress and telegraph geometry; rule badge transitions; projectiles; zones; down callouts with their cause.
- *Bounded queries:* a live index's `endTick` is null; `keyMoments` and `autoPauseStops` never return a tick past `untilTick`; `ArenaFrameState.endTick` is null before the end.
- *Selection rules:* `keyMoments` equals the report's selection rules; format 1 logs give null shield and focus.
- *Cues:* the exhaustive effect switch (compile-time); every active ability (84) with a visible release cue; all 34 statuses with a pip.
- *Colours and camera:* the `colorsForMatch` clash rule and 3:1 contrast for every club pair; `viewTransform` round-trips and letterboxes.
- Small golden snapshots of `ArenaFrameState` at chosen ticks.

**Viewer logic (happy-dom, WP-M2D).** The parts that need no GPU, with a fake `Timeline` injected:
- the playback clock (speeds, clamps, stops, the live head, `endTick` null until reached);
- `keyMoments()` and `decisionAt()` bounded by the head;
- the flash limiter, layer ordering and object reuse by id;
- `replaceLog` refusal on a broken prefix;
- `load` awaiting `skin.prepare`;
- bodies never rotated by the viewer.

PixiJS itself is exercised only in the browser smoke.

**UI (happy-dom, WP-M2E).** Screens run with a fake `ArenaViewer` injected through a factory seam and fixture `RoundPlayback`s. Covered: HUD content, controls and keys, inspector sentences from traces and probes, the feed, the round-end overlay, the Watch/Simulate flow, `MATCH_WATCHING` routing only after a successful round autosave, resume after a reload, Replay buttons and reasons, and settings.
- **The leak test (replaces the earlier "grep the winner" idea).** A fake viewer wraps the real timeline over a fixture live round with known later events: a down at tick 400, overtime at 900, the end at 1,000. With the head at 200, the arena screen is rendered twice: once fed the full log, once fed the same log truncated after tick 200 (no `fight.end`). **The two DOM trees must be identical.** The fake also records every value it hands out and asserts each tick is ≤ the head: scrubber maximum, marks, feed items, `endTick`, standing counts. Any read past the head shows up as a DOM difference.

**Headless-browser visual smoke (WP-M2F; review B5).** Script: `npm run smoke:arena` (entry requested from the architect), a zero-dependency Node driver for headless Edge (or Chrome) over the DevTools protocol, using Node's built-in WebSocket (Playwright stays FUTURE, 05 §10).
- **Target:** a **`vite build --mode smoke`** build served by `vite preview`. In that mode, and in dev, the test hook and the dev world's fixture round are compiled in (tech-027); the production build keeps neither (bundle test).
- **Two paths:**
  - The fixture round through the hook: seek to fixed ticks; screenshots at 1280 × 720 and 1920 × 1080 in both themes and with reduced motion.
  - A seeded new career through the real UI: new game with a typed seed, pick a club, Play match → Watch → between rounds → report.
- **Checks:** a WebGL context; a non-blank canvas; ten tokens (pixel colours at the projected positions from `frame()` match the ring colours); no console errors.
- **Measurements:** fps and our frame time over 10 s at 1x and 4x; test-first item 5; 20 round loads for heap growth; CVD screenshots; the Chromium hash check.
- **Output:** screenshots and a JSON report go to `reports/` (git-ignored).
- **When it runs:** not in `npm run check` (it needs a browser); before each M2 merge from WP-M2E on, and by QA.

**vis-003 (fights are readable).**
1. Automated proxies above: glyph and ring on every token, contrast, cause named on every down.
2. An agent observer pre-check: five fights at 1x as screenshot sequences with the vis-003 prompts (name both sides' tank and healer; the cause of each down), scored.
3. The criterion itself: human observers (the owner) watch five fights at 1x; ≥ 90% of prompts answered correctly.

Only (3) is evidence for vis-003 (01 §6); (1) and (2) gate the merge.

## A12. Technical decisions (proposed `tech-` entries)

| ID | Decision | Why | Rejected |
| --- | --- | --- | --- |
| tech-015 | The viewer plays back a round simulated headlessly at `full` from `prepareRound`'s input; core re-simulates on input (calls) and the viewer swaps logs at the call tick; the commit compares the shown log's hash in every build | vis-009 by construction; tech-009 kept; free seeking; ≤ 10 ms per round | Lockstep stepping of the sim by the render loop |
| tech-016 | `FIGHT_LOG_FORMAT_VERSION` versions the recorded shape apart from `ENGINE_VERSION`; format 2 adds shield and focus to frames and a closing frame | The viewer needs them; replays are checksum-verified, so stored matches stay replayable | Bumping `ENGINE_VERSION` (every stored match loses its replay and per-round box score); deriving shield and focus from events (inexact) |
| tech-017 | src/render in two halves: pure (types, timeline, cues, colours, camera; typechecked without DOM, tested in Node) and PixiJS (viewer, skins; lazy) | GPU-free tests; PixiJS only where needed; enforced by rules | One folder with PixiJS everywhere |
| tech-018 | HUD, strip, controls, feed and inspector are DOM (Preact) over the canvas, fed at ≤ 10 Hz; for a live round they read only through the viewer | T3; accessibility; DOM tests; the UI designer's CSS; no future leaks | A canvas HUD |
| tech-019 | Watch cursor = the reveal frontier in fight ticks; M2 persists it (`match.watch` + `auto-round`) only when playback stops; the calls package adds a write-ahead reveal record (W = 200 fight ticks) | A full save (19–39 ms) would hitch playback; fight ticks, not wall time, bound foresight at any speed | Periodic saves while playing; wall-clock limits |
| tech-020 | The viewer owns every mark with game meaning and translates bodies only; a skin draws bodies (choosing its own facing) and the floor, loads shared resources once and prepares each match's classes | Sprites can never hide vis-003 cues; fixed-direction sprites; the texture budget | Skins drawing whole tokens; the viewer rotating bodies; preloading 42 classes |
| tech-021 | Cues derived from ability and status definitions by a pure table with an exhaustive switch over effect types | Covers 168 abilities and 34 statuses by construction; a new effect type cannot ship without a cue | Hand-made cues per ability; a silent fallback |
| tech-022 | Pause inspector probe: `inspectRoundAt` re-simulates to a tick and evaluates every rule list with a trace | Recorded traces exist only for decision changes; read-only, ≤ 10 ms | Tracing every evaluation into the log |
| tech-023 | State schema v5, identity migration, for `MatchState.watch`, `RoundLineups.calls` and `MatchResult.simHash` | Strict schema: an older build must refuse new saves cleanly | Optional fields without a version |
| tech-024 | PixiJS init: WebGL preference, antialias, autoDensity, resolution min(DPR, 2), `preserveDrawingBuffer`, ticker dt clamped to 100 ms | Predictable in both wrappers; F8 screenshots; no jumps | WebGPU first |
| tech-025 | Viewer chunks lazy, ≤ 250 KB gzip, prefetched at idle in a matchweek | Startup budget unchanged | PixiJS in the main bundle |
| tech-026 | Replay availability compares `simContentHash` (what `simTables` compiles plus the fight's direct content reads, guarded by a read-set test) and the engine version; the career content hash is unchanged | The owner's "replays end at a balance-changing update" (Q56) | The full content hash (any edit ends replays); a hand-kept key list (misses reads such as captaincy grades) |
| tech-027 | A `smoke` build mode compiles in the test hook and the dev world's fixture round; production never does (bundle test) | The smoke must run on a built bundle, and the hook is dev-only today | Smoke against `npm run dev` only; shipping the hook |

## A13. Work packages

**Ground rules** as 05 §9.2: one worktree per package on `m2/wp-<x>-<name>` from `main` after this branch merges; a package owns only its paths; no two packages share a file; contract files keep their signatures (add freely, change through the architect).

**Architect-owned:** as in §9.2 (package files, configs, `tests/**`, `src/core/{util,rng,model,content,testkit}/**`), plus `src/render/index.ts`, `src/render/types.ts`, `src/render/viewer/skin.ts`, `src/render/README.md` and this addendum. **Exceptions granted:**
- WP-M2A sets `FIGHT_LOG_FORMAT_VERSION` to 2 (`core/model/events.ts`).
- WP-M2B sets `STATE_SCHEMA_VERSION` to 5 (`core/model/game-state.ts`) and adds the call-count bound to `SAVE_BOUNDS` (`core/content/save-bounds.ts`), each one declaration.

**Designer-owned:** `docs/design/**` except 05 files, `content/**`, `src/ui/styles/**`.

| Package | Owns | Implements | Depends on | Parallel with | Model |
| --- | --- | --- | --- | --- | --- |
| **WP-M2A** Sim: log format 2, probe, replay hash | `src/core/sim/**`, `src/core/tactics/**` | Frames with shield and focus, a closing frame, `header.logFormat`; `inspectRoundAt`; `simContentHash`; the sim refuses non-none call plans; goldens re-pinned (approved here); README | contracts only | all | Sonnet |
| **WP-M2B** Game: watch flow, playback, replay, resume, save v5 (integrator) | `src/core/game/**`, `src/core/save/**`, `src/core/ai/**`, `src/core/harness/soak*.ts`, `scripts/soak.ts`, `scripts/replay.ts`, plus the two exceptions above | `AdvanceOptions` (`playerMatch`, `watched`), the watch step (inputs locked and autosaved first, Q60 option A), `watch.mismatch`, `watch.not-shown`, `match.watch` (with `mode`), the live playback functions on `prepareRound`, `replayAvailability` with `simHash` (and `buildMatchReport` on it), `inspectPlayback` (after WP-M2A), `roundInputOf` copying calls, schema v5 and migration, error codes, README | contracts; WP-M2A for `inspectPlayback` and `simContentHash` (stubs until then) | all | **Opus**: it moves the player's commit point and the week split, where a slip breaks P-05 or vis-009 silently; it also integrates the merges |
| **WP-M2C** Render model | `src/render/timeline/**`, `src/render/cues/**`, `src/render/colors/**`, `src/render/camera/**` | The pure API of §A5 | contracts (format 1 logs suffice; format 2 fields light up when WP-M2A merges) | all | Sonnet |
| **WP-M2D** Render viewer | `src/render/viewer/**` except `skin.ts`, `src/render/skins/**` | `createArenaViewer` (clock, scene, overlays, cues, input, resize, DPR, teardown, snapshot, stats), the placeholder skin | contracts; a fake `Timeline` until WP-M2C lands | all | Sonnet |
| **WP-M2E** UI | `src/ui/**` except `src/ui/styles/**`; `src/platform/**` if the ticket metadata needs it | §A7: arena and replay screens, HUD, strip, feed, inspector, controls and keys, Watch/Simulate, routing (after a successful autosave) and resume, Replay entries, settings, store facade and autosave points, F8 metadata, the test hook in dev and smoke mode | contracts; WP-M2B views (stubs → `safeView` null; tests use fakes); WP-M2D (a fake viewer in tests) | all | Sonnet |
| **WP-M2F** QA smoke and vis-003 protocol | `scripts/smoke/**` (new) | §A11 smoke driver and checks against the `smoke` build, the vis-003 observer kit and agent pre-check, the report format | WP-M2D and WP-M2E for the real run; the driver can start against the placeholder route | all (finishes last) | Sonnet |
| **WP-M2G** Calls (gated on sys-calls being specified and approved; staging approved in Q53) | sim/tactics, game, UI and content changes, after M2 merges | §A6: call effects, the AI call policy, `match.call`, records, the reveal record, the call UI, `ENGINE_VERSION` 3, harness runs | the combat designer and the owner; all M2 packages merged | none (sequential) | Sonnet |

**Acceptance per package** (beyond `npm run check` green after a rebase, README updated, no file outside ownership):
- **WP-M2A:**
  - format 2 frames match the sim's state (shield after `shield.gain`/`break`, focus after `cast.release`);
  - test-first item 4;
  - the replay-hash tests (read-set guard, the keys that must move it, the excluded keys that must not move it or any round checksum);
  - `inspectRoundAt` consistent with recorded traces and side-effect-free;
  - full-level sim time reported.
- **WP-M2B:**
  - test-first item 1;
  - the commit-check, replay and resume tests of §A11;
  - `replayAvailability` reasons for not-played, compacted (3 weeks), other-build (engine, `simHash`, and the `contentHash` fallback) and live;
  - `npm run soak -- --seasons 3 --seed soak-1` and the 10-season gate identical to main (AI matches never watch);
  - a v4 save loads as v5 and saves back identically.
- **WP-M2C:**
  - the model tests of §A11, including the bounded queries and the cue coverage;
  - `sampleAt` p95 ≤ 1 ms per call in Node on a 1,500-tick round.
- **WP-M2D:**
  - the viewer-logic tests on a fake timeline;
  - teardown leaves no growth over 20 rounds;
  - the viewer chunk within budget;
  - the UI designer reviews the placeholder look against asset-006.
  - Its **frame-rate criterion** (60 fps median at 1x and 4x, test-first item 5) closes after WP-M2E merges, measured by WP-M2F on the smoke build; WP-M2D stays responsible for fixes.
- **WP-M2E:**
  - screen tests, including test-first items 2 and 3;
  - in the browser: a full matchweek watched (Watch, auto-pause, between-rounds, report), a reload mid-round resuming at the last stop, and a replay from the report's key moment;
  - a keyboard-only pass;
  - ux-001 counted (Play match and one Enter per round boundary);
  - the UI designer's review.
- **WP-M2F:**
  - the smoke report on the `smoke` build (screenshots, fps, the cursor-save trace, heap, the Chromium hash);
  - the vis-003 agent pre-check scored;
  - the observer kit ready for the owner.

**Merge order and integration.** Any order; WP-M2B integrates. Suggested order: WP-M2A and WP-M2C first (independent), then WP-M2B, WP-M2D, WP-M2E, and finally WP-M2F's run on the merged build. When WP-M2E merges, the architect adds the package script `smoke:arena` (with the `smoke` mode build) and a v4 save fixture test under `tests/save/`.

**Design tasks (not coding packages):**
- the UI designer mocks the arena screen (HUD, strip, inspector, round-end overlay) and adds tokens (`--c-arena-floor`, `--c-arena-wall`, `--c-fx-physical`, `--c-fx-arcane`, status pip glyphs) to `src/ui/styles`;
- the combat designer writes sys-calls (staging approved, Q53);
- the lead designer records the answers to Q53–Q60.

**Highest-risk assumptions to prove early:**
- the watched input equals the played one (pinned now by `prepareRound`; WP-M2B test-first item 1);
- format 2 changes no outcome (WP-M2A, test-first item 4);
- 60 fps at 4x on integrated graphics (WP-M2D, measured by WP-M2F as soon as the smoke build draws);
- WebGL canvas capture for F8 (WP-M2D).

## A14. Owner questions

Q53–Q59 were answered by the owner on 2026-10-27: **"approved as recommended"**. Q60 was answered the same day: **option A**.

**Q53 — Calls in watched fights: in M2, later, or never?**
**Required before M2 starts · 01 §8.3 P-01; §8.5 Q17; 03 §3.5 sys-calls**

P-01 proposes up to two calls per round per side, through the captain, which AI managers spend too. What a call does (call a focus target, toggle a rule, switch a playbook, retreat) is not designed yet, and Q17 is open.
- **Option A:** M2 ships watching, pause, the inspector, auto-pause and skipping. Calls follow in a small package once the combat designer has specified them and you have approved them, before M3.
- **Option B:** hold M2 until calls are designed, and build them in.
- **Option C:** no calls; you influence fights only between rounds (and from M3 by editing rules).

**Recommendation:** A. Also approve the rest of Q17: free pause to inspect, auto-pause, skipping, each milestone keeping the M1 loop working.
**Answer (owner, 2026-10-27):** approved as recommended: option A, and the rest of Q17.

**Q54 — Can you skip watching your own match, and what is the default?**
**Required before the M2 handoff · 01 §8.4 open-020; 02 §2 step 7; 04 ui-match**

Play match would offer **Watch** and **Simulate** side by side, one click either way. Without calls, Simulate gives exactly the result watching would give; once calls exist, simulating lets the AI's call policy make your side's calls. In the viewer you can also simulate the rest of the match or skip to the end of a round. The Streamlined pacing preset always simulates.
**Recommendation:** yes, with Watch as the primary button.
**Answer (owner, 2026-10-27):** approved as recommended.

**Q55 — Which camera should M2 use?**
**Required before WP-M2D finishes · 04 §4; art research §12 Q4; open-032**

The working design is a top-down view of the whole arena with fixed framing (04 §4), drawn with placeholder shapes. The camera is a setting in code, so a 3/4 view (about 40°, as sprite pipeline C would render) or zoom 1×/1.5×/2× with follow can come with the sprite decision without rework.
**Recommendation:** top-down with fixed framing in M2; decide the 3/4 view, zoom and follow with the sprite pipeline (art §12 Q4).
**Answer (owner, 2026-10-27):** approved as recommended.

**Q56 — Which matches can be watched and replayed?**
**Required before the M2 handoff · 03 sys-match-report (O24); 05 §5, §6**

- **Live:** your own matches.
- **Replays:** any match whose details are still kept, on the same version of the game: your matches of this season and the last, and other clubs' matches for 3 weeks after they are played (O24 then trims them to a summary).
- **After an update:** once a game update changes any balance value, earlier matches cannot be replayed; their reports stay, as now.
- **During a live match:** you can rewind within the current round, but not look ahead.

**Recommendation:** approve as described, including that replays end at an update.
**Answer (owner, 2026-10-27):** approved as recommended. As worded, replays end at an update that changes a balance value: the replay check compares a hash of only what the sim reads (tech-026), so updates to names, clubs or the economy keep them.

**Q57 — Keep more replays at the cost of save size?**
**Can defer · 01 §8.1 O24, O33; 05 §5, §12 KI-2**

Today's saves peak at about 8.9 MB in season 10, against your 10 MB budget.
- **Option A:** no change (0 MB).
- **Option B:** keep other clubs' matches replayable for 5 weeks instead of 3 (about +0.6 MB, peak about 9.5 MB).
- **Option C:** keep your tier's Reckoning matches replayable until the next season ends (about +0.1 MB).

**Recommendation:** A; C later if you miss those replays.
**Answer (owner, 2026-10-27):** approved as recommended (A).

**Q58 — When should a watched fight pause by itself?**
**Can defer · 01 §8.3 P-01 ("auto-pause on configurable events")**

Each trigger is a switch in Settings › Match day. Proposed defaults:
- on: one of your fighters is downed; your captain goes down; overtime starts;
- off: enemy downs; "a fighter of yours below 25% HP".

**Recommendation:** these defaults.
**Answer (owner, 2026-10-27):** approved as recommended.

**Q59 — What art and sound does M2 include?**
**Required before the M2 handoff · 01 §5 M2 row; 04 §5, §8, §10 (asset-005, asset-006); 01 §8.4 open-032; O22**

- **Option A:** M2 ships placeholder shapes (a coloured disc per fighter with its side ring, role glyphs, bars and badges) and no arena sound. The 42 class icons (asset-005), sprites and arena sound (04 §8) come with the sprite pipeline decision (open-032).
- **Option B:** M2 waits for open-032 and ships sprites, icons and sound.

**Recommendation:** A. T1 allows simple shapes first, the skin interface makes sprites a drop-in, and vis-003 is judged on shapes and glyphs.
**Answer (owner, 2026-10-27):** approved as recommended (A).

**Q60 — When is a watched round "committed"?**
**Required before WP-M2B starts · 01 §8.2 D-O; §8.3 P-05; 02 §3 "Match result"; Q53**

D-O says a result is committed and autosaved before it is shown, so reloading cannot reroll it. For a round you watch there are two readings.
- **Option A:** the round's inputs (squads, rows, presets, the seed) are locked and autosaved before it is shown. Its outcome is then fixed and cannot be rerolled, and it is committed when playback ends. Calls (staged, Q53) stay possible, because a call is a new input at a tick.
- **Option B:** the round is simulated and its result committed and autosaved before playback starts: the literal D-O. It is simpler in the engine, but while you watch, the result already sits in the saved game. Every screen that could show it (the score, Freshness and injuries, the save list, where Continue takes you) must then be held back until the round has been shown, and the rounds where calls are possible would later need A anyway.

**Recommendation:** A.
**Answer (owner, 2026-10-27):** "Q60 option A: a watched round may play before its result is saved, as long as its lineups, presets and seed are locked and autosaved first, so the outcome is fixed and can't be rerolled."

## A15. Approved design and the remaining open item

| Item | Design | Status |
| --- | --- | --- |
| Calls | Staged after M2; types, records, command, event, log swap and the cursor meaning reserved | Approved (Q53) |
| Skip watching | Watch (primary) or Simulate at Play match; Streamlined simulates; simulate the rest; skip a round's end | Approved (Q54, open-020) |
| Camera | Top-down orthographic, whole arena, no zoom or follow; projection configurable | Approved (Q55) |
| Watchable and replayable | Live: own matches. Replay: records kept in full, same engine and same sim content. Live rewind within the round, never ahead | Approved (Q56; the sim hash per its wording) |
| Retention | No change | Approved (Q57) |
| Auto-pause | Own downs, own captain down, overtime on; others off | Approved (Q58) |
| Art and audio | Placeholder shapes, role glyphs; no class icons, sprites or arena sound in M2 | Approved (Q59) |
| Commit point of a watched round | Lineups, presets and seed locked and autosaved before it is shown; committed when playback ends | Approved (Q60, option A) |
| Performance | §A10 targets on 05 §8's working reference | **OPEN** (Q35) |
| Speed | 1x at first, then the remembered speed per device | T1 fixes the speeds |
| Inspector visibility | Both sides' rules and traces | as the package's M1–M3 visibility rule (open-026); fog arrives with M4 |

## A16. Top risks

1. **The watched input drifts from the played input.** Mitigation: `prepareRound` is the one builder (in place, tested); the commit compares the shown log's hash in every build and refuses on a mismatch; a commit with no shown log is refused (`watch.not-shown`) unless the player chose "Simulate the rest".
2. **Format 2 accidentally changes an outcome** (a recorder that reads or mutates sim state). Mitigation: recording stays read-only; test-first item 4.
3. **Frame rate on integrated graphics at 4x with many effects.** Mitigation: object reuse, effect caps and merging, the resolution cap at 2, the smoke's fps check early. Fallback: lower effect density at 4x.
4. **Future-knowledge leaks through the UI.** Mitigation: bounded types (live `endTick` null, `untilTick` queries, the viewer as the only live source) and the truncated-log DOM equivalence test.
5. **Replays disappear after balance updates**, which may surprise players across updates. Mitigation: the sim hash keeps them over non-sim updates; clear reasons in the UI. FUTURE: archived sim content versions for replays.
6. **Watching makes matchweeks long** (a 3-round match is 1–2 minutes at 1x), against vis-006's spirit. Mitigation: Simulate is one click; 4x; skip controls; Streamlined pacing.
7. **The lock's autosave fails or a write is slow.** Mitigation: the viewer opens only after the write succeeds; cursor saves happen only at stops.
8. **WebGL canvas capture** for F8 and the smoke on some drivers. Mitigation: `preserveDrawingBuffer`, with `viewer.snapshot()` via PixiJS extract as the fallback.

## A17. Contradictions and gaps found in the design documents

1. **Calls are written as M2 features but cannot be built yet.** 01 §5 and 05 §9 put calls in M2, and 02 §3 has a "Call (M2)" transition, while sys-calls is "not yet written" (03 §3.5): there are no call kinds. → Q53 (answered: staged).
2. **The decision trace in the event model is narrower than the spec and the sim.** 03 sys-tactics says the trace records the condition and the observed value. The sim records them (`reason`, `cond`, `observed`, `readyInTicks`), but `core/model` typed only rule, fired and skip. Fixed in the contract (types only, no hash change). Separately, decisions are traced only when they change, so "why was this rule skipped right now" needs the probe (tech-022).
3. **04 §4 requires shield segments and focus bars, but frames carry neither.** → log format 2 (tech-016).
4. **"The viewer never re-simulates" versus "calls are timed inputs to the deterministic sim".** The render README and tech-009 say the first; 03 §3.5 says the second, and a call needs a re-simulation somewhere. Resolved by tech-015: core re-simulates; the viewer only swaps logs.
5. **"M2 records at full level for the viewer" (03 sys-match-report)** could be read as storing full logs; at 255–413 KB per round that breaks O33. Read here as producing full logs on demand.
6. **M2 art scope is inconsistent.** 01 §5's M2 row says "placeholder shapes or sprites for all 42 classes"; 04 §10 schedules 42 class icons (asset-005) in M2; 04 §8 schedules arena sound in M2. Meanwhile open-032 is unresolved and O22 excludes the existing pipeline. → Q59 (answered: placeholders).
7. **Zoom and follow** are "OPEN for M2" in 04 §4 and §11, with no owner question. → Q55 (answered).
8. **Replays across builds.** 05 §6 promises determinism only within a build, and the content hash covers non-sim data too, so any content edit would end every earlier replay. 02 and 04 never say so to the player. → Q56 (answered) and tech-026.
9. **The commit point of a watched round.** 02 §3's "Match result" row commits with the week at Play match (D-O); M1.1 commits per round; a watched round can be committed before or after it is shown. → Q60 (answered: inputs locked and autosaved first, committed after it is shown); 02 should say so when M2 is approved.
10. **No frame-rate, frame-time or viewer-memory target** exists in 05 §8 or 04 §7 (only UI responsiveness), and the reference machine is still open (Q35). Working targets in §A10.
11. **Colour tokens for arena effects and the floor are missing.** 04 §3 forbids role hues for anything but roles, and 04 §5 asks for a mid-value floor, but tokens.css has no floor, wall or hit-tone tokens. → designer request (§A13).
12. **The render README's planned API** (`load(log)`, `onTick`, "interpolating between frame events and drawing deaths") predates squads, the live/replay split, auto-pause and the inspector. Replaced by §A5 and the new README.
13. **Mid-fight resume with calls** (02 §3, open-016) needs a reveal bound in fight ticks to keep "no rerolls"; without calls it changes nothing. → §A6, tech-019.
14. **"Quitting mid-fight resumes at the same tick" (02 §3, open-016)** conflicts with saving the cursor only at stops (tech-019, forced by the 19–39 ms save cost). A quit while playing resumes where playback last stopped, earlier than the shown tick. The outcome is unaffected; 02 should say "resumes where playback last stopped" when M2 is approved.
15. **"One Enter per between-round pause" (ux-001, 02 §1)** conflicts with a blocking round-end card followed by the between-round screen's Continue, which would be two inputs per boundary. Resolved: the round-end overlay is non-blocking (§A7).
