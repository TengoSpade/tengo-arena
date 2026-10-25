# core/save

**Owner:** WP5 (game loop). **Status:** implemented. API: `checksumState`, `saveMetaFor`, `createSave`, `serializeSave`, `parseSave`, `validateState`, `MIGRATIONS` (contract) plus `parseSaveWith` (explicit migration list, for tests) and `GameStateSchema`.

## parseSave order and error codes
1. `JSON.parse` → `save.json`
2. `format` tag, malformed envelope → `save.format`
3. `schemaVersion` newer than the build → `save.too-new` (details: saveVersion, buildVersion)
4. checksum of the state as written, by the rule of the save's schema version → `save.checksum`. v1: `hashString(stableStringify(state))`. v2: an order-sensitive `StreamHasher` over each top-level key and its JSON text, with `results`, `history` and `alumni` folded in per entry (key, then the entry's `hashString`) (`encode.ts`)
5. stepwise migrations vN → vN+1 (missing or throwing step) → `save.migration`
6. structure: strict zod schema of the whole `GameState` → `save.structure`
7. content: another theme, or any referenced content id missing → `save.content-missing`; a different content hash with every id present loads with a warning
8. references and the ledger invariant (balance = opening + Σ entries) → `save.references`

`save.storage` belongs to `src/platform`. A failed parse never returns a state.

## validateState
Structure (strict: an unknown key is an error, so a module writing an undeclared field is caught by the soak), content ids (classes, races, traits, presets, tiers, regions, districts, AI personalities, paces, stats, weeks, venues), and references: map keys equal ids, clubs/fighters/fixtures/competitions resolve, lineup fighters on the roster (hired blades allowed), captain ≠ vice, contract club = fighter club, status consistency, fixture `played` ⇔ result, offers only to free agents, ledger sequence and the balance invariant, id counters ahead of every allocated id, calendar consistent with `leagues.json`. Issues are capped at 200 per group.

## Decisions
- `serializeSave` output equals `JSON.stringify(envelope)`. Results, archived seasons and alumni are deep-frozen once a transition shares them, so their JSON text and hash are cached per entry object; an autosave encodes only the mutable part of the state.
- The v2 checksum depends on key order. JSON.parse keeps it, so a parsed save hashes the same; states built by the engine are deterministic in key order too.
- **v1 → v2** (`migrations.ts`): retired fighters and past hired blades move to `alumni`, and every shortlist, lineup, offer and negotiation entry naming them is dropped; agreed renewals move from negotiations to `Contract.next`; `FreeAgency.enteredAt`, `Injury.careerEnding` and `TierSeasonRecord.reckoningStages` (from the clubs' season rows) are filled in; fighter history rows keep display stats on the last two rows only.
- After a migration the envelope carries the checksum of the migrated state and `migratedFrom`.
- The schema mirrors `core/model`; a model change bumps `STATE_SCHEMA_VERSION`, adds a migration and updates `schema.ts` together (architect).

## Orchestrator decisions (M1 core fix round, pending owner confirmation)
- **Tampered-save ids.** Names every plain object inherits (`constructor`, `toString`, `hasOwnProperty`, `__proto__`, ...) are never valid: `reservedNameIssues` rejects them anywhere in the state as a map key, as a value under `id` / `...Id` / `captainAtLastLock`, and as any string in an array (id lists, shortlists, seeds), before the zod check (`save.structure`). Reference checks look ids up in null-prototype copies. A save with `playerClubId: "constructor"` no longer loads.
