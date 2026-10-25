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
| `units.ts` | authoring units -> engine integers (`S` ticks, `M` cm / mm, `Mps` mm per tick, fractions -> bp) |
| `db.ts` | `ContentDB` registries and lookups |
| `load.ts` | `loadContent`, `parseContentFiles`, `hashContent` |

Profiles: `'theme'` (default; full shipped-theme rules) and `'fixture'` (skips count rules, for core/testkit).

Designers: `npm run validate-content` prints every issue as `file › path: message`.

Adding a vocabulary entry (status, effect type, rule condition, ...) is a code change: the owning module must implement it, then the architect adds it to `schema/common.ts`.
