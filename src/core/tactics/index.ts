/**
 * core/tactics — public API (phase A placeholder; implemented in phase B).
 *
 * Planned API (see README.md and docs/design 05 §3):
 *   resolveTactics(assignment, content): Result<RuleList, EngineError>
 *   compileRules(rules, content): CompiledTactics
 *   evaluate(compiled, view: BattleView, unit): Decision   // first valid rule wins, with trace
 *
 * BattleView is declared HERE (what tactics needs to read); core/sim implements it.
 */
export {};
