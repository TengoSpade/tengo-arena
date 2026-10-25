# core/save

**Owner:** WP5 (game loop). **Status:** contract stubs in `index.ts` (phase B; `checksumState` implemented). The public API in `index.ts` is a fixed contract (typed stubs); implement the bodies, add exports only additively, and request signature changes from the architect.

## Responsibility
- Build a `SaveEnvelope` (format, schemaVersion, engineVersion, content ref, meta, checksum, state).
- Parse and validate untrusted JSON: format tag, version, checksum, structural validation (zod), referential integrity (every `clubId`, `fighterId`, `fixtureId` reference resolves; lineup fighters belong to the club; ledger invariant).
- Migrations: an ordered list of pure functions `vN -> vN+1`; saves newer than the build are rejected with a clear error.
- Content mismatch policy: a save made with a different content hash still loads if all referenced content ids exist; otherwise a clear error.

## Rules
- Pure: no storage access. `src/platform` (IndexedDB / file system / file export-import) calls this module.
- Never "repair" silently: return issues; the UI decides (load anyway is not offered for errors).

Depends on: `util`, `rng`, `model`, `content`. Tests: round trip, checksum mismatch, each migration, future version rejected, broken reference detected, truncated JSON.
