# core/content

**Owner:** architect. **Status:** implemented (phase B): zod schemas for all 11 files, cross-file validator, loader, ContentDB, units.

## Use
```ts
import { loadContent, formatContentIssues, secondsToTicks, metresToMm } from '../content';
const result = loadContent('default', raw);          // raw: RawContentFiles from a platform loader
if (!result.ok) console.error(formatContentIssues(result.error));
const db = result.value;                               // ContentDB (frozen)
db.classes.require('oathguard'); db.classAbility('oathguard', 'a1'); db.tierByLevel(1); db.weekByIndex(5);
```

## Files
| File | Purpose |
| --- | --- |
| `schema/common.ts` | id pattern and the CLOSED vocabularies (stats, archetypes, statuses, effect types, predicates, triggers, rule conditions/selectors/predicates/actions, trait effects, ...) |
| `schema/<file>.ts` | one zod schema per content file; types inferred (`types.ts`) |
| `validate.ts` | cross-file rules: references, unique ids, closed lists match, O8 class structure (6 per archetype, 2 per hybrid pair, 42 total), mutual trait opposites, rule params vs vocabulary (type, range, step, required), selector pool vs action/ability target, O2 caps, calendar and schedule coverage, economy integers, exact unit conversion |
| `save-bounds.ts` | `SAVE_BOUNDS`: the structural limits of the save format that tunable content values feed into (squad size 5, reserves 2, swaps per match 2, queued level-ups 3, options per level-up 3, perks per fighter 4). `core/save/schema.ts` builds its array lengths and counters from it and `validate.ts` (`validateSaveBounds`) refuses content that exceeds it (`levels.json offers.pending.maxQueued`, `offers.optionsPerLevelUp`, `perks.json rules.perkCap`, `combat.json match.squad.starters` (must equal it), `match.squad.reservesMax`, `match.swaps.maxPerMatch`), so a tuned file can never write a save that does not load. Raising a bound is a save-format change made in this one place. |
| `units.ts` | authoring units -> engine integers (`S` ticks, `M` cm / mm, `Mps` mm per tick, fractions -> bp) |
| `db.ts` | `ContentDB` registries and lookups |
| `load.ts` | `loadContent` (option `hash`: the production build ships the files without their doc keys and passes the source files' hash), `parseContentFiles`, `hashContent` (over the files as written) |
| `doc-keys.ts` | `isDocKey`, `stripDocKeys`: `_`-prefixed keys are documentation for designers. No code reads them (the validator skips them, the schemas only declare them optional), so the production build drops them (`scripts/vite/strip-doc-keys.ts`) and `tests/content` checks the stripped files validate the same. |

Profiles: `'theme'` (default; full shipped-theme rules) and `'fixture'` (skips count rules, for core/testkit).

Designers: `npm run validate-content` prints every issue as `file › path: message`. A key that starts with `_` is a note to yourself: it has no effect in the game and is removed from the production build, so never put data there.

Rank steps (`ability-ranks.json`) never change an ability's control durations: the validator compares every `cc_hard` and `cc_soft` status duration (Stunned, Rooted, Slowed, Sluggish, ...) before and after each rank, so no rank lengthens (or shortens) any control; rank steps use magnitude, cooldown, focus, area or non-control durations.

Adding a vocabulary entry (status, effect type, rule condition, ...) is a code change: the owning module must implement it, then the architect adds it to `schema/common.ts`.

## Orchestrator decisions (M1 core fix round, pending owner confirmation)
- **Reserved ids.** Content ids may not be inherited object names (`constructor` passes the id pattern, so the cross-file check names it).
- **D-Q, one rating formula.** `combatRating(content, classId, stats)` (rating.ts) = clamp(round(5 × Σ wᵢ × statᵢ), ratingMin, ratingMax) on the integer effective stats, rounded half away from zero in integer bp. Fighter ratings and potentials (core/fighters `ratingFromStats`), the fight-input OVR of the balance harness (sim/build) and the stand-ins all call it; the displayed rating is the one the rules use. development.json's rating `_doc` states this form.
- **D-P / D-T keys.** economy.json `budget.worldGenBillBandBp` and `market.trialsDay.maxAskBpOfTierMinWage`; development.json `retirement.physicalPeakHumanAge`, `hazardByRatingDrop`, `hazardPerHumanYearPastPeak` (replacing `hazardPerHumanYear`). The frozen fixture content (testkit) was patched with these keys only.
