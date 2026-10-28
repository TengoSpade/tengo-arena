# src/render, pure half: timeline, cues, colors, camera (WP-M2C)

**Owner:** WP-M2C. **Status:** implemented against the M2 contract (`05-technical-m2.md` §A5, §A8-A11, amended by §A18). No PixiJS, no DOM, no clock, timer or randomness (rule `render-pure`); typechecked by `tsconfig.core.json`, tested in Node (vitest "core"); imports core/{util, model, content} and core/sim as types only.

The signatures in `src/render/index.ts` and `types.ts` are the architect's and unchanged (`sampleAt` gains an optional `knownUntilTick` and `colorsForMatch` an optional `clashDeltaE`, both additive). `src/render/index.ts` re-exports everything in `colors/` (`export *`), so the default palettes and contrast helpers are public.

## Folders
| Folder | Contents |
| --- | --- |
| `timeline/` | `indexFightLog`, `sampleAt`, `eventsBetween`, `decisionAt`, `autoPauseStops`, `keyMoments`, `samePrefix`, the injectable `timeline` object. `build.ts` indexes, `frames.ts` is the frame table, `sample.ts` samples, `queries.ts` holds the bounded queries, `effects.ts` the effect lifetimes and ids, `data.ts` the internal shape. |
| `cues/` | `buildCueTable(content)`, the exhaustive effect switches, `explainRelease`, `pipOf`, `TELEGRAPH_MIN_TICKS`. |
| `colors/` | `colorsForMatch`, `contrastRatio`, `parseHexColor`, `ensureContrast`, CIEDE2000, `defaults.ts` (the default palettes: the tokens.css values, compared with the file by a test). |
| `camera/` | `DEFAULT_CAMERA` (16 px padding all round), `viewTransform`. |
| `timeline/fixtures/` | Seven committed full-level rounds of the real simulator (format 1, gzipped JSON). Regenerate with `npx tsx scripts/render-fixtures/make-fixtures.ts` (the generator lives in `scripts/`: it value-imports core/sim, which nothing under `src/render` may). |
| `timeline/support.mts` | Test support (content, fixtures, a round context, truncated and skeleton logs, event merging). It is not a test file: the architecture rules scan it like any pure-half source (no simulator, no banned global; a test checks both and that the rules would catch a violation), and it is `.mts` only so the DOM-free typecheck leaves it out (it reads files). `tsconfig.json` typechecks it. |

Tests cannot run the simulator themselves: `src/render` may import core/sim as types only (`render-sim-value`), test files included. Hence the fixtures.

## The model
`indexFightLog(log, content, cues, kind)` is one pass over the events. It needs a full-level log (`fight.start` and frames) and throws `InvariantError` otherwise. A replay index knows `endTick` (the `fight.end` tick); a live one never does. Ability and status ids the content set does not know are tolerated (no telegraph, a plain pip), at index and sample time alike.

`sampleAt(index, tick, ctx, { reducedMotion, knownUntilTick })` is a pure function of the log, the tick, the context and the options. The state is the same whether playback got there at 1x, 4x or by seeking (tested over three traversals), and every returned object is fresh.

- **Positions** interpolate linearly between the frames around the tick. **HP, shield and focus** step at the last frame at or before the tick; a unit downed at or before the tick shows HP 0 and shield 0. Format 1 frames (four elements) give `shield` and `focus` null; format 2 frames (six) give exact values; a log may mix them.
- **No future leaks.** Everything except positions comes from intervals and events with tick at or before the sampled tick, and no event ever shortens or lengthens something already shown (an effect's age runs over its full lifetime; a guard link or a leap's landing is dropped from the tick a fighter is down, rather than cut short). Positions are the one look past the tick: the next frame, at most one frame interval ahead. `knownUntilTick` (a live round's head) forbids that look: a frame later than it is never used and positions hold at the frame before it, also for effect anchors and projectile starts. **A log truncated after tick H samples exactly as the full log does with `knownUntilTick: H`**, for every tick up to H, whole sample (tested on all seven fixtures at heads every few ticks and around every down, both motion settings). For a smooth live view keep the displayed tick at least one frame interval (2 ticks) behind the head, or accept 10 Hz position steps at the head; a replay passes no `knownUntilTick`.
- **Clamping:** a tick below 0 or NaN is 0. Once the log's end is known (a replay, or a log that contains `fight.end`) the tick clamps to it. A log without an end is never clamped upward: the caller holds its own head. `endTick` in the sample is null until `tick >= fight.end`.
- **Action**, by precedence: downed, stunned or asleep (a status that blocks move, attack and ability; asleep when damage breaks it), displaced (knockback, pull), channel, cast, windup, move (a dash or leap, or movement between the last two frames), idle.
- **Facing** points at the cast target, else the committed target, else the way the unit last moved (knockbacks and pulls do not turn it); the initial heading is east for the home side, west for the away side.
- **Casts** are `windup` (a basic attack, from `attack.start`), `cast` (`cast.start` to the release) and `channel` (the release to the channel duration from content). `progress` runs over the planned span; an interrupt, cancel, down or the target going down ends it early. A cast cut off in its own tick never shows.
- **Telegraphs** appear for casts and channels (not windups) whose cue has a telegraph and whose planned span is at least `cue.telegraph.minTicks` (6 ticks, or 1 for area abilities). A circle centred on the target follows it until release; `single` is a line to the target and its `size` is the current distance. Telegraph progress is kept under reduced motion.
- **Statuses:** one entry per status id. Several instances (different sources) merge: `stacks` add only for statuses whose content stacking is `stacks`, otherwise the highest stack count; `appliedTick` is the earliest, `endsTick` the latest. A down clears them (the sim emits no expire events then).
- **Rule badge:** `R<n>` for rule `n-1`, `S` for the stance (`rule >= ctx.units[u].ruleCount`), `T` for a forced decision (rule -1). `pulse` falls from 1 to 0 over 220 ms (`RULE_PULSE_MS`); always 0 under reduced motion. Null before the first decision and when downed.
- **Projectiles** fly home from where the launcher stood to the target's current position over `[launch, landTick)`. **Zones** live from `zone.spawn` to `zone.expire`, a replacement at `maxActive`, or the owner's down; `endsTick` is the content duration; a `follow: caster` zone follows its owner.

### Effects
Short-lived cues from events, `age` 0..1 over a lifetime (`EFFECT_LIFETIME_TICKS`, tunable; every kind is within the 400 ms rule, 8 ticks, except the down callout (2 s), the guard link (while it lasts) and the motion streaks (as long as the motion)). `x`,`y` is where it happens at the event tick (resolved at sample time from the anchor unit, so `knownUntilTick` applies). `unit` is the actor and `target` who it lands on (impact, number, heal, shield gain and break, status apply and resist, evade, interrupt, cleanse, dispel, guard link, zone trigger, call: for an evade `unit` is the attacker and `target` the evader). Markers about one unit (`down`, `deathward`, `rally`, `captain-down`) have `unit` = that unit and `target` the killer or saver. For `dash-trail` and `displace`, `unit` is the unit that moves and `x`,`y` where it began (draw to its current position). Effects are listed in event order; one that announces a later moment (a leap's landing) starts then.

**Ids.** The primary effect of an event has `id` = the event's seq. A companion adds a multiple of `COMPANION_ID_OFFSET` (2^20): slot 1 is a hit's or heal's number, slot 2 a chain arc, an extra splash flash or a leap's landing flash, slot 3 a guard link. `effectEventSeq(id)` gives the seq back. Ids are stable and unique at every tick (tested), so a scene keeps one visual per id.

| Kind | From |
| --- | --- |
| `swing`, `beam`, `splash` | `cast.release`, by the ability's cue (`swing`, `beam`, `area-flash` and `self-pulse` map to `splash`) |
| `splash` (landing) | an ability that dashes or leaps and then strikes an area flashes it where it lands (the target's position at the landing, or the landing point); dropped if the leaper is down before landing |
| `impact`, `number` | `hit` (number = HP damage plus shield absorbed, in the damage tone) |
| `heal-pulse`, `number` | `heal` with healing above 0 |
| `shield-gain`, `shield-break`, `evade`, `status-resist`, `interrupt` | the events of those names (`interrupt` only when someone interrupted) |
| `status-apply` | `status.apply` by an ability (system statuses such as Shaken and Rallied have a pip but no flash) |
| `dash-trail`, `displace` | `displace` (dash and leap; knockback and pull) |
| `chain-arc` | later hits of a chain release on other targets: an arc from the previous target |
| `cleanse`, `dispel` | an early `status.expire` in the tick of a release whose cue carries a cleanse (a debuff on an ally) or a dispel (a buff on an enemy) |
| `guard-link` | the release of a guard ability, for the guard's duration; dropped from the tick either fighter is down |
| `zone-trigger` | `zone.trigger`, at the zone nearest the trigger |
| `down`, `deathward`, `rally`, `captain-down`, `call` | the events of those names |
| `cooldown-reset`, `focus-gain` | no event exists for them in log format 1 or 2: they stay in the cue vocabulary only |

Every one of the 84 active abilities is visible when released: a test feeds each one's release (with the launch or displacement its delivery implies) to `sampleAt` and requires an effect or a projectile of the kind its cue names.

**Reduced motion** (04 §9, A9) sets pulses and animated ages to their end states: the rule badge pulse is 0; the motion-only kinds (`MOTION_ONLY_EFFECTS`: `dash-trail`, `displace`, `heal-pulse`, `cooldown-reset`, `focus-gain`) are left out; every other effect is at its end state, `age` 1, while it lasts, except a number, whose age keeps running because a number appears and fades in place. Telegraph progress, projectiles, zones and every marker are unchanged: they are information.

### Bounded queries
- `keyMoments(index, ctx, untilTick)`: the report's selection rules (down, interrupt by another fighter, deathward, rally, captain-down, handover, overtime) plus `call` and `end`, in event order, up to and including `untilTick`. `unit` is the acting fighter and `target` the one it happened to (for a down: killer, fallen).
- `autoPauseStops(index, rules, ctx, untilTick)`: our downs, their downs, our captain's down, overtime, and our HP below a line (first frame below it, once per unit, not for a unit that fell straight to a down). "Our" is `ctx.playerSide`; with null only the overtime stop exists. Sorted by tick, then seq.
- `eventsBetween(index, from, to)`: events with `from < tick <= to`, including frames. `decisionAt(index, unit, tick)`: the latest `unit.decide` with commit tick at or before `tick`.
- `samePrefix(prev, next, atTick)`: equal headers and identical events up to `atTick`.

## Cues
Derived from definitions with no ability, class or status id in code (a test scans the sources). Release is chosen by named rules (`explainRelease`: projectile delivery, dash or leap delivery, a dash effect, an area, a self target, a melee single target, any other single target, a passive's `none`); a shape no rule covers makes `buildCueTable` throw, so a fallback can never count as coverage. All 84 actives have one: 25 area, 8 dash (6 by delivery, 2 by effect), 11 melee-single swing, 7 projectile, 11 self-target, 22 single-target beam. Effects are walked with exhaustive switches over the 17 types (`effectCueKind`, `childEffects`), nested effects included. Statuses read from content (category, blocks, interrupts, icon id): hard control greys the ring and leads the pips, and `pip` is the category's pip kind (`pipOf`, an exhaustive switch; the shield category has none).

## Colours (A18 decision 4)
`colorsForMatch(home, away, playerSide, palette, { clashDeltaE })`: **body and trim colours are the exact club colours**, exempt from 3:1 (the body is enclosed by the ring and keylines and carries identity only). The player's ring is brass and solid, the opponent's steel blue and double; between other clubs the rings are the clubs' leading colours (home solid, away double), shifted in Lab (hue and chroma kept, only L* moves) until they reach 3:1 against `palette.floor`: only those rings are ever shifted. If the two primaries are closer than `clashDeltaE` (CIEDE2000, default 20 = clubs.json `colorRules`) the away side leads with whichever of its colours is farther from the home primary; no colour is altered to separate them (the club validator's kit distance of 25 resolves every pair of the 48 clubs: tested, both themes, every player side). 3:1 binds the rings, the glyph plate and glyph, the bars, the pip outlines and the tones: the default palettes are tested for it in both themes and equal to tokens.css, field by field (colours, role and pip glyphs, `metrics` at a 15 px root).

## Camera
`viewTransform(camera, viewport, arenaCm, focusCm)`: top-down at zoom 1 fits the arena inside the padding (16 px all round: the viewer's host is the stage only, so there is no HUD padding), centred. At zoom above 1 it centres on the focus and clamps so the arena edge never leaves the screen. Oblique squashes y by cos(tilt) (clamped to 80 degrees) and lifts height by sin(tilt); `toWorld` inverts the ground plane.

## Measured (Node, this machine)
`sampleAt` on the 1,500-tick time-limit round (3,055 events): p50 about 8 us, p95 about 20 us, p99 about 30-50 us over 4,000 random ticks (budget: p95 1 ms). `indexFightLog`: median about 1.5 ms. `keyMoments` plus `autoPauseStops`: about 0.01 ms. `samePrefix` over 3,055 events: about 1 ms. The tests assert the budgets and print the figures.

## Known gaps
- Log format 2 is exercised with synthetic six-element frames until WP-M2A merges; refresh the fixtures with the script after it (the pinned snapshot in `__snapshots__` needs `vitest -u` only if the sim's behaviour changed).
- `cooldown-reset` and `focus-gain` effects have no source event; `call` and `rally` effects are tested with synthetic events (the sim emits no calls before the calls package, and a rally needs captain grades the default fixtures do not reach).
- Format 2 adds a closing frame at the end tick; the frame table already takes frames at any tick.
