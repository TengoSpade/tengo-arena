/**
 * core/game — public API (phase A placeholder; implemented in M1 wave 2).
 *
 * Planned API (see README.md and docs/design 05 §3, "Operation contract: season engine"):
 *   createWorld(content, { rootSeed, options }): GameState            // playerClubId = null
 *   applyCommand(state, command, content): CommandResult               // validate + apply one Command
 *   getBlockers(state, content): Blocker[]                             // why the player cannot advance yet
 *   advanceWeek(state, content): Result<{ state, report: WeekReport }, EngineError>
 *   runSeasonEnd(state, content): Result<{ state, record: SeasonRecord }, EngineError>
 *   buildMatchReport(state, fixtureId, content): MatchReport           // read-only view for the UI
 */
export {};
