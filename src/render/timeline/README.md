# src/render, pure half: timeline, cues, colors, camera (WP-M2C)

**Owner:** WP-M2C. **Status:** implemented against the M2 contract (`05-technical-m2.md` §A5, §A8-A11). No PixiJS, no DOM, no clock, timer or randomness (rule `render-pure`); typechecked by `tsconfig.core.json`, tested in Node (vitest "core"); imports core/{util, model, content} and core/sim as types only.

The signatures in `src/render/index.ts` and `types.ts` are the architect's and unchanged. This file records what the implementation guarantees.

## Folders
| Folder | Contents |
| --- | --- |
| `timeline/` | `indexFightLog`, `sampleAt`, `eventsBetween`, `decisionAt`, `autoPauseStops`, `keyMoments`, `samePrefix`, the injectable `timeline` object. `build.ts` indexes, `frames.ts` is the frame table, `sample.ts` samples, `queries.ts` holds the bounded queries, `effects.ts` the effect lifetimes and ids, `data.ts` the internal shape. |
| `cues/` | `buildCueTable(content)`, the exhaustive effect switches, `explainRelease`, `TELEGRAPH_MIN_TICKS`. |
| `colors/` | `colorsForMatch`, `contrastRatio`, `parseHexColor`, CIEDE2000, default palettes. |
| `camera/` | `DEFAULT_CAMERA`, `viewTransform`. |
| `timeline/fixtures/` | Seven committed full-level rounds of the real simulator (format 1, gzipped JSON) and `make-fixtures.mjs`, which regenerates them: `npx tsx src/render/timeline/fixtures/make-fixtures.mjs`. |
| `timeline/support.mts` | Test support (content, fixtures, a round context, truncated logs). `.mts` so the pure-half typecheck leaves it out. |

Tests cannot run the simulator themselves: `src/render` may import core/sim as types only (`render-sim-value`), test files included. Hence the fixtures.

## The model
`indexFightLog(log, content, cues, kind)` is one pass over the events. It needs a full-level log (`fight.start` and frames) and throws `InvariantError` otherwise. A replay index knows `endTick` (the `fight.end` tick); a live one never does.

`sampleAt(index, tick, ctx, { reducedMotion })` is a pure function of the log, the tick and the context. The state is the same whether playback got there at 1x, 4x or by seeking (tested over three traversals), and every returned object is fresh.

- **Positions** interpolate linearly between the frames around the tick. This is the only look past the tick, at most one frame interval. **HP, shield and focus** step at the last frame at or before the tick; a unit downed at or before the tick shows HP 0 and shield 0. Format 1 frames (four elements) give `shield` and `focus` null; format 2 frames (six) give exact values; a log may mix them.
- **Discrete state** (action, cast, statuses, rule badge, effects, captains, standing counts, `ended`, `overtime`) comes from intervals and events with tick at or before the sampled tick. An interval ends at the first of its planned end and a terminating event, and is active for `start <= tick < end`. So **a log truncated after tick H samples identically for every tick up to H** (tested at many heads; exactly when H is even, and with positions excluded in the last tick when H is odd, because the next frame is unknown). Nothing is derived from a later event.
- **Clamping:** a tick below 0 or NaN is 0. Once the log's end is known (a replay, or a log that contains `fight.end`) the tick clamps to it. A log without an end is never clamped upward: the caller holds its own head. `endTick` in the sample is null until `tick >= fight.end`.
- **Action**, by precedence: downed, stunned or asleep (a status that blocks move, attack and ability; asleep when damage breaks it), displaced (knockback, pull), channel, cast, windup, move (a dash or leap, or movement between the last two frames), idle.
- **Facing** points at the cast target, else the committed target, else the way the unit last moved (knockbacks and pulls do not turn it); the initial heading is east for the home side, west for the away side.
- **Casts** are `windup` (a basic attack, from `attack.start`), `cast` (`cast.start` to the release) and `channel` (the release to the channel duration from content). `progress` runs over the planned span; an interrupt, cancel, down or the target going down ends it early. A cast cut off in its own tick never shows.
- **Telegraphs** appear for casts and channels (not windups) whose cue has a telegraph and whose planned span is at least `cue.telegraph.minTicks` (6 ticks, or 1 for area abilities). A circle centred on the target follows it until release; `single` is a line to the target and its `size` is the current distance. Telegraph progress is kept under reduced motion.
- **Statuses:** one entry per status id. Several instances (different sources) merge: `stacks` add only for statuses whose content stacking is `stacks`, otherwise the highest stack count; `appliedTick` is the earliest, `endsTick` the latest. A down clears them (the sim emits no expire events then).
- **Rule badge:** `R<n>` for rule `n-1`, `S` for the stance (`rule >= ctx.units[u].ruleCount`), `T` for a forced decision (rule -1). `pulse` falls from 1 to 0 over 220 ms (`RULE_PULSE_MS`); always 0 under reduced motion. Null before the first decision and when downed.
- **Projectiles** fly home from where the launcher stood to the target's current position over `[launch, landTick)`. **Zones** live from `zone.spawn` to `zone.expire`, a replacement at `maxActive`, or the owner's down; `endsTick` is the content duration; a `follow: caster` zone follows its owner.

### Effects
Short-lived cues from events, `age` 0..1 over a lifetime (`EFFECT_LIFETIME_TICKS`, tunable). `x`,`y` is where it happens at the event tick; `unit` is the actor and `target` who it lands on, except markers about one unit (`down`, `deathward`, `rally`, `captain-down`), where `unit` is that unit and `target` the killer or saver, and `dash-trail`/`displace`, where `unit` is the unit that moves and `x`,`y` is where it began (draw to its current position).

**Ids.** The primary effect of an event has `id` = the event's seq. A companion adds a multiple of `COMPANION_ID_OFFSET` (2^20): slot 1 is a hit's or heal's number, slot 2 a chain arc or an extra splash flash. `effectEventSeq(id)` gives the seq back. Ids are stable and unique, so a scene keeps one visual per id.

| Kind | From |
| --- | --- |
| `swing`, `beam`, `splash` | `cast.release`, by the ability's cue (`swing`, `beam`, `area-flash` and `self-pulse` map to `splash`) |
| `impact`, `number` | `hit` (number = HP damage plus shield absorbed, in the damage tone) |
| `heal-pulse`, `number` | `heal` with healing above 0 |
| `shield-gain`, `shield-break`, `evade`, `status-resist`, `interrupt` | the events of those names (`interrupt` only when someone interrupted) |
| `status-apply` | `status.apply` by an ability (system statuses such as Shaken and Rallied have a pip but no flash) |
| `dash-trail`, `displace` | `displace` (dash and leap; knockback and pull) |
| `chain-arc` | later hits of a chain release on other targets: an arc from the previous target |
| `cleanse`, `dispel` | an early `status.expire` in the tick of a release whose cue carries a cleanse (a debuff on an ally) or a dispel (a buff on an enemy) |
| `guard-link` | the release of a guard ability, for the guard's duration or until either fighter goes down |
| `zone-trigger` | `zone.trigger`, at the zone nearest the trigger |
| `down`, `deathward`, `rally`, `captain-down`, `call` | the events of those names |
| `cooldown-reset`, `focus-gain` | no event exists for them in log format 1 or 2: they stay in the cue vocabulary only |

**Reduced motion** (04 §9) drops the motion-only kinds (`MOTION_ONLY_EFFECTS`: `dash-trail`, `displace`, `heal-pulse`, `cooldown-reset`, `focus-gain`), zeroes the badge pulse, and leaves everything else (numbers, markers, telegraphs, projectiles) alone.

### Bounded queries
- `keyMoments(index, ctx, untilTick)`: the report's selection rules (down, interrupt by another fighter, deathward, rally, captain-down, handover, overtime) plus `call` and `end`, in event order, up to and including `untilTick`. `unit` is the acting fighter and `target` the one it happened to (for a down: killer, fallen).
- `autoPauseStops(index, rules, ctx, untilTick)`: our downs, their downs, our captain's down, overtime, and our HP below a line (first frame below it, once per unit, not for a unit that fell straight to a down). "Our" is `ctx.playerSide`; with null only the overtime stop exists. Sorted by tick, then seq.
- `eventsBetween(index, from, to)`: events with `from < tick <= to`, including frames. `decisionAt(index, unit, tick)`: the latest `unit.decide` with commit tick at or before `tick`.
- `samePrefix(prev, next, atTick)`: equal headers and identical events up to `atTick`.

## Cues
Derived from definitions with no ability, class or status id in code (a test scans the sources). Release is chosen by named rules (`explainRelease`: projectile delivery, dash or leap delivery, a dash effect, an area, a self target, a melee single target, any other single target, a passive's `none`); a shape no rule covers makes `buildCueTable` throw, so a fallback can never count as coverage. All 84 actives have one: 25 area, 8 dash (6 by delivery, 2 by effect), 11 melee-single swing, 7 projectile, 11 self-target, 22 single-target beam. Effects are walked with exhaustive switches over the 17 types (`effectCueKind`, `childEffects`), nested effects included. Statuses read from content (category, blocks, interrupts, icon id): hard control greys the ring and leads the pips.

## Colours
`colorsForMatch(home, away, playerSide, palette, { clashDeltaE })`: the player's ring is brass and solid, the opponent's steel blue and double (between other clubs both take the clubs' primaries, home solid, away double). Every colour is first moved the least needed to reach 3:1 against `palette.floor`. If the two bodies are closer than `clashDeltaE` (CIEDE2000, default 20 = clubs.json `colorRules`) the away side leads with its secondary; if that still clashes the away body is lightened or darkened. Tested over all ordered pairs of the 48 clubs, both themes and every player side. `DEFAULT_ARENA_PALETTES` are the tokens.css values, for tests and the first frame; the host passes the real palette.

## Camera
`viewTransform(camera, viewport, arenaCm, focusCm)`: top-down at zoom 1 fits the arena inside the padding, centred (about 52.9 px per metre at 1920 x 1080). At zoom above 1 it centres on the focus and clamps so the arena edge never leaves the screen. Oblique squashes y by cos(tilt) (clamped to 80 degrees) and lifts height by sin(tilt); `toWorld` inverts the ground plane.

## Measured (Node, this machine)
`sampleAt` on the 1,500-tick time-limit round (3,055 events): p50 7 us, p95 about 20 us, p99 about 30-50 us over 4,000 random ticks (budget: p95 1 ms). `indexFightLog`: median about 1.6 ms. `keyMoments` plus `autoPauseStops`: about 0.01 ms. `samePrefix` over 3,055 events: about 1 ms. The tests assert the budgets and print the figures.

## Known gaps
- Log format 2 is exercised with synthetic six-element frames until WP-M2A merges; refresh the fixtures with `make-fixtures.mjs` after it (the pinned snapshot in `__snapshots__` will need `vitest -u` only if the sim's behaviour changed).
- `cooldown-reset` and `focus-gain` effects have no source event; `call` and `rally` effects are tested with synthetic events (the sim emits no calls before the calls package, and a rally needs captain grades the default fixtures do not reach).
- Format 2 adds a closing frame at the end tick; the frame table already takes frames at any tick.
