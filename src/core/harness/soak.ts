import type { ContentDB } from '../content';
import { type Seed } from '../rng';

/**
 * Headless season soak: N seasons with AI managing every club, checking
 * economy, age and league sanity invariants after every week and season.
 *
 * Owner: WP5. CONTRACT: options and report shape fixed (additive changes
 * allowed). STUB until core/game lands: every check reports "pending". WP5
 * implements the loop with createWorld / AI for every club / advanceWeek /
 * runSeasonEnd and the checks in SOAK_CHECKS, using the pass bands in
 * development.json soakTargets and economy.json balanceTargets.
 */
export interface SoakOptions {
  seed: Seed;
  seasons: number;
  content: ContentDB;
}

export type SoakCheckStatus = 'pass' | 'fail' | 'pending';

export interface SoakCheck {
  id: string;
  description: string;
  status: SoakCheckStatus;
  detail?: string;
}

export interface SoakReport {
  kind: 'soak';
  stub: boolean;
  seed: Seed;
  contentHash: string;
  seasonsRequested: number;
  seasonsCompleted: number;
  checks: SoakCheck[];
}

/** The invariant catalogue. Descriptions are developer-facing. */
export const SOAK_CHECKS: readonly { id: string; description: string }[] = [
  { id: 'determinism', description: 'Same seed twice -> identical final state checksum' },
  { id: 'ledger-balance', description: 'Every club: balance == opening balance + sum(ledger) each week' },
  { id: 'ai-solvency', description: 'AI clubs bankrupt per season <= TUNABLE limit' },
  { id: 'roster-size', description: 'Every club can field a legal lineup every week' },
  { id: 'age-distribution', description: 'League mean age and retirements per season stay in TUNABLE bands per race' },
  { id: 'fighter-population', description: 'Active fighter count stays within TUNABLE band (rookies vs retirements)' },
  { id: 'wage-inflation', description: 'Median wage growth per season within TUNABLE band' },
  { id: 'competitive-balance', description: 'No club wins its tier more than TUNABLE share of seasons' },
  { id: 'schedule-integrity', description: 'Every club plays the configured matches; tournament has 8 clubs and 3 rounds' },
  { id: 'references', description: 'validateState() finds no broken references after every season' },
  { id: 'save-roundtrip', description: 'serialize -> parse -> deep-equal after every season' },
];

export function runSoak(options: SoakOptions): SoakReport {
  const { seed, seasons } = options;
  if (!Number.isSafeInteger(seasons) || seasons < 0) throw new RangeError(`seasons must be a non-negative integer, got ${seasons}`);
  return {
    kind: 'soak',
    stub: true,
    seed,
    contentHash: options.content.ref.hash,
    seasonsRequested: seasons,
    seasonsCompleted: 0,
    checks: SOAK_CHECKS.map((c) => ({ ...c, status: 'pending' as const, detail: 'season engine not implemented yet' })),
  };
}
