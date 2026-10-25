# core/save

**Owner:** WP5 (game loop). **Status:** implemented. API: `checksumState`, `saveMetaFor`, `createSave`, `serializeSave`, `parseSave`, `validateState`, `MIGRATIONS` (contract) plus `parseSaveWith` (explicit migration list, for tests) and `GameStateSchema`.

## parseSave order and error codes
1. `JSON.parse` → `save.json`
2. `format` tag, malformed envelope → `save.format`
3. `schemaVersion` newer than the build → `save.too-new` (details: saveVersion, buildVersion)
4. checksum of the state as written (`hashString(stableStringify(state))`) → `save.checksum`
5. stepwise migrations vN → vN+1 (missing or throwing step) → `save.migration`
6. structure: strict zod schema of the whole `GameState` → `save.structure`
7. content: another theme, or any referenced content id missing → `save.content-missing`; a different content hash with every id present loads with a warning
8. references and the ledger invariant (balance = opening + Σ entries) → `save.references`

`save.storage` belongs to `src/platform`. A failed parse never returns a state.

## validateState
Structure (strict: an unknown key is an error, so a module writing an undeclared field is caught by the soak), content ids (classes, races, traits, presets, tiers, regions, districts, AI personalities, paces, stats, weeks, venues), and references: map keys equal ids, clubs/fighters/fixtures/competitions resolve, lineup fighters on the roster (hired blades allowed), captain ≠ vice, contract club = fighter club, status consistency, fixture `played` ⇔ result, offers only to free agents, ledger sequence and the balance invariant, id counters ahead of every allocated id, calendar consistent with `leagues.json`. Issues are capped at 200 per group.

## Decisions
- Envelopes are written with `JSON.stringify` (key order is irrelevant: the checksum uses `stableStringify`).
- After a migration the envelope carries the checksum of the migrated state and `migratedFrom`.
- The schema mirrors `core/model`; a model change bumps `STATE_SCHEMA_VERSION`, adds a migration and updates `schema.ts` together (architect).
