/**
 * core/save — public API (phase A placeholder; implemented in M1 wave 1/2).
 *
 * Planned API (see README.md and docs/design 05 §5, "Operation contract: save / load"):
 *   createSave(state, meta, versions): SaveEnvelope
 *   serializeSave(envelope): string
 *   parseSave(json, content?): Result<{ envelope, migratedFrom: number | null }, SaveError>
 *   validateState(state, content?): StateIssue[]
 *   MIGRATIONS: ordered list of pure (vN -> vN+1) functions
 */
export {};
