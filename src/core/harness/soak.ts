import type { ContentDB } from '../content';
import { createGameEngine, realGamePorts, type GamePorts } from '../game';
import type { ClubId, FighterId, GameState, MatchResult, SeasonRecord, StatId } from '../model';
import { checksumState, createSave, parseSave, saveMetaFor, serializeSave, validateState } from '../save';
import { type Seed } from '../rng';
import { NotImplementedError } from '../util';

/**
 * Headless season soak: N seasons with AI managing every club, checking
 * economy, age and league sanity invariants after every week and season.
 *
 * Owner: WP5. CONTRACT: options and report shape fixed (additive changes
 * allowed). Runs createWorld (no player club: every club is AI-managed) ->
 * advanceWeek x 23 -> runSeasonEnd per season, with the pass bands of
 * development.json soakTargets and economy.json balanceTargets. If a module
 * is still a stub the run stops and every check it could not reach is
 * 'pending' with the missing function named. Pure: no clock, no I/O (the CLI
 * times the run and writes the report).
 */
export interface SoakOptions {
  seed: Seed;
  seasons: number;
  content: ContentDB;
  /** Module implementations (default: the real modules). Tests pass stand-ins. */
  ports?: GamePorts;
  /** Seasons replayed for the determinism check (default: all). 0 skips the second run. */
  determinismSeasons?: number;
  /** Progress hook (the CLI prints per-season timing). */
  onSeason?: (summary: SoakSeasonSummary) => void;
}

/** 'warn' is a violated warning-level check (SoakCheck.severity): reported and printed, but not a failure. */
export type SoakCheckStatus = 'pass' | 'fail' | 'warn' | 'pending';

export interface SoakCheck {
  id: string;
  description: string;
  /** 'warn': a violation reports status 'warn' instead of 'fail' and does not fail the soak. Absent: a hard check. */
  severity?: 'warn';
  status: SoakCheckStatus;
  detail?: string;
}

export interface SoakSeasonSummary {
  season: number;
  /** Crown/Banner/Muster Reckoning champions, tier order. */
  champions: (ClubId | null)[];
  shields: (ClubId | null)[];
  population: number;
  rostered: number;
  freeAgentsAtP1: number;
  freeAgentsMinInSeason: number;
  medianHumanAge: number;
  retirements: number;
  rookies: number;
  solventShareBp: number;
  medianWage: number;
  hiredBladeSlots: number;
  lineupSlots: number;
  aiRejections: number;
  checksum: string;
  // ---- M1.1 (additive) ----
  /** Round starts by AI clubs, and those started Tired (40-59) or Spent (< 40). */
  roundStarts: number;
  tiredStarts: number;
  spentStarts: number;
  /** Round-by-round matches, swaps (both sides), forced ones (injury or emergency), emergency entrants. */
  matches: number;
  swaps: number;
  forcedSwaps: number;
  emergencyEntrants: number;
  /** Levels gained this season: starters by levels.json soakTargets cohort, the bench, everyone. */
  levels: SoakLevelSummary;
  /** Median effective Stamina of the season's starters (null without the stat). */
  starterStaminaMedian: number | null;
}

/** Fighters counted and the levels they gained over the season. */
export interface LevelTally {
  fighters: number;
  levels: number;
}

/** Starters and bench of one human-age band (see levelAgeBands). */
export interface AgeBandLevels {
  starters: LevelTally;
  bench: LevelTally;
}

/** One levels.json cohort over some seasons: fighters counted, levels they gained, the sum of the squared per-fighter levels, matches they started. */
export interface CohortTally {
  fighters: number;
  levels: number;
  /** Sum over the fighters of (levels gained)^2: with `fighters` and `levels` it gives the spread of the per-fighter levels. */
  levelsSq: number;
  matches: number;
}

export interface SoakLevelSummary {
  /** Per levels.json cohort: fighters, levels gained, their sum of squares (the spread behind the gate's noise margin) and matches started. */
  cohorts: Record<string, CohortTally>;
  starters: LevelTally;
  bench: LevelTally;
  total: number;
  /** Regular starters and the bench proper by human-age band at the start of the season (PROVISIONAL_RATIO_* groups): the age-matched bench ratio compares within a band. */
  ageBands: Record<string, AgeBandLevels>;
}

export interface SoakReport {
  kind: 'soak';
  stub: boolean;
  seed: Seed;
  contentHash: string;
  seasonsRequested: number;
  seasonsCompleted: number;
  checks: SoakCheck[];
  /** Additive: per-season summaries, the final state checksum and the error that stopped the run, if any. */
  seasons: SoakSeasonSummary[];
  finalChecksum: string | null;
  error: string | null;
  /** Command codes the rulebook refused from AI clubs, with counts (diagnostics). */
  aiRejections: Record<string, number>;
}

/** The invariant catalogue. Descriptions are developer-facing. */
export const SOAK_CHECKS: readonly { id: string; description: string; severity?: 'warn' }[] = [
  { id: 'determinism', description: 'Same seed twice -> identical final state checksum' },
  { id: 'ledger-balance', description: 'Every club: balance == opening balance + sum(ledger) each week' },
  { id: 'ai-solvency', description: 'AI clubs bankrupt per season <= TUNABLE limit' },
  { id: 'roster-size', description: 'Every club can field a legal lineup every week' },
  { id: 'age-distribution', description: 'League mean age and retirements per season stay in TUNABLE bands per race' },
  { id: 'fighter-population', description: 'Active fighter count stays within TUNABLE band (rookies vs retirements)' },
  { id: 'wage-inflation', description: 'Median wage growth per season within TUNABLE band' },
  // Warning-level: a single-seed dynasty flag is noise; dynasty balance is a known issue for the M7 balance pass, measured across many seeds.
  { id: 'competitive-balance', description: 'No club wins its tier more than TUNABLE share of seasons', severity: 'warn' },
  { id: 'schedule-integrity', description: 'Every club plays the configured matches; tournament has 8 clubs and 3 rounds' },
  { id: 'references', description: 'validateState() finds no broken references after every season' },
  { id: 'save-roundtrip', description: 'serialize -> parse -> deep-equal after every season' },
  // M1.1 (levels.json soakTargets; combat sys-match)
  { id: 'freshness-rotation', description: 'AI round starts Tired / Spent within levels.json soakTargets' },
  { id: 'level-ups', description: 'Starter levels per season by human-age, matches per level, bench ratio (age-matched), starter Stamina within levels.json soakTargets' },
  { id: 'match-squads', description: 'Squad records legal (5 a side every round, <= 2 swaps, no return); swaps per match within the PROVISIONAL band' },
];

/** Swaps per match, both sides (PROVISIONAL: no content band; lifecycle model ~0.5, combat squad-match 0.6-1.4 at harsher Freshness). */
export const PROVISIONAL_SWAPS_PER_MATCH: readonly [number, number] = [0.1, 1.5];
/** Starters for the level bands: fighters who started at least this many matches of the season (PROVISIONAL). */
export const PROVISIONAL_STARTER_MIN_MATCHES = 8;
/** Bench for the bench ratio: rostered all season, started at most this many matches (PROVISIONAL). */
export const PROVISIONAL_BENCH_MAX_MATCHES = 3;
/**
 * The age-matched bench ratio compares the bench proper with regular starters, the groups of the fighters population
 * test (T004): started >= 10 matches of the season, against started <= 2. The groups above are wider (a fighter who
 * started 8 matches, or 3, still earned full match XP in those and the bench rate in the rest), which blurs the
 * comparison: at the same age they read about 0.03 higher (PROVISIONAL).
 */
export const PROVISIONAL_RATIO_STARTER_MIN_MATCHES = 10;
export const PROVISIONAL_RATIO_BENCH_MAX_MATCHES = 2;
/** Reference groups (age-matched bench ratio) with fewer fighters than this are left out. */
const MIN_COHORT = 8;
/**
 * The cohort mean gate (level-ups, starter levels per season by human-age): a cohort with fewer fighters than this,
 * pooled over the measured seasons, is reported but not gated. The "18-20 potential>=70" cohort holds only about
 * 25-35 fighters in ten measured seasons (a handful per season), so a flat band on its mean flaked by seed
 * (bal-c: 3.91 against a band of 4-6.5 on 32 fighters, other seeds 4.4-4.9). PROVISIONAL.
 */
export const MIN_COHORT_GATE = 20;
/**
 * A cohort mean fails its band only when it lies outside the band by more than this many standard errors of the
 * mean (the cohort's own spread over its size): a small cohort is allowed noise in proportion to its size, a large
 * one is held almost exactly to the band. At 2.5 a cohort whose true mean sits inside the band fails about once in
 * 150 soaks, while a real shift of a point or more is caught from about 25 fighters. PROVISIONAL.
 */
export const COHORT_NOISE_Z = 2.5;

/** The verdict on one cohort's mean levels per season against its levels.json band. */
export interface CohortVerdict {
  /** 'pass': inside the band, or outside by no more than the noise margin; 'fail': outside by more; 'skipped': too few fighters to gate. */
  status: 'pass' | 'fail' | 'skipped';
  fighters: number;
  mean: number;
  /** Standard error of the mean from the cohort's spread (null when it has fewer than 2 fighters). */
  stderr: number | null;
  /** How far the mean lies outside the band (0 inside it). */
  outside: number;
}

/**
 * Gate one cohort: skipped below MIN_COHORT_GATE fighters; otherwise it fails when its mean lies outside `band`
 * by more than COHORT_NOISE_Z standard errors. The spread comes from the tally (sum of squared per-fighter levels).
 */
export function judgeCohort(tally: Pick<CohortTally, 'fighters' | 'levels' | 'levelsSq'>, band: readonly number[]): CohortVerdict {
  const n = tally.fighters;
  const mean = n ? tally.levels / n : 0;
  const outside = mean < band[0]! ? band[0]! - mean : mean > band[1]! ? mean - band[1]! : 0;
  let stderr: number | null = null;
  if (n >= 2) {
    const variance = Math.max(0, (tally.levelsSq - n * mean * mean) / (n - 1));
    stderr = Math.sqrt(variance / n);
  }
  if (n < MIN_COHORT_GATE) return { status: 'skipped', fighters: n, mean, stderr, outside };
  const margin = COHORT_NOISE_Z * (stderr ?? 0);
  return { status: outside > margin ? 'fail' : 'pass', fighters: n, mean, stderr, outside };
}

/**
 * wage-inflation band: |median wage growth| per season after the warm-up.
 * OPEN: no content field yet (request economy.json balanceTargets.medianWageGrowthMaxBp).
 */
export const PROVISIONAL_MEDIAN_WAGE_GROWTH_MAX_BP = 1000;
/** Warm-up excluded from the drift bands (development.json soakTargets: "measured from season 3"). */
export const SOAK_WARMUP_SEASONS = 2;

const BP = 10000;

// ---- individual checks (exported for unit tests) ------------------------------------------------------------

/** Clubs whose balance differs from opening + Σ ledger. */
export function ledgerMismatches(state: GameState): string[] {
  const sums = new Map<string, number>();
  for (const e of state.ledger.entries) sums.set(e.clubId, (sums.get(e.clubId) ?? 0) + e.amount);
  const out: string[] = [];
  for (const c of Object.values(state.clubs)) {
    const expected = (state.ledger.openingBalances[c.id] ?? 0) + (sums.get(c.id) ?? 0);
    if (c.finance.balance !== expected) out.push(`${c.id}: ${c.finance.balance} != ${expected}`);
  }
  return out;
}

/** Problems with the lineups fielded in a week's results (5 distinct fighters a side, from the club or hired blades). */
export function lineupProblems(state: GameState, results: readonly MatchResult[]): string[] {
  const out: string[] = [];
  for (const r of results) {
    for (const side of [r.input.home, r.input.away]) {
      const ids = side.fighters.map((f) => f.fighterId);
      if (ids.length !== 5 || new Set(ids).size !== 5) out.push(`${r.fixtureId}: ${side.clubId} fielded ${ids.length} (${new Set(ids).size} distinct)`);
      for (const id of ids) {
        const f = state.fighters[id];
        const blade = r.hiredBladeIds.includes(id);
        if (!f) out.push(`${r.fixtureId}: unknown fighter ${id}`);
        else if (!blade && f.clubId !== side.clubId && f.status === 'active') out.push(`${r.fixtureId}: ${id} is not on ${side.clubId}`);
      }
    }
  }
  return out;
}

/** Clubs over their tier cap once the season has kicked off (the only legal over-cap state is preseason after relegation). */
export function overCap(state: GameState, content: ContentDB): string[] {
  if (state.calendar.phase === 'preseason') return [];
  const counts = new Map<string, number>();
  for (const f of Object.values(state.fighters)) if (f.clubId !== null && f.status === 'active') counts.set(f.clubId, (counts.get(f.clubId) ?? 0) + 1);
  const out: string[] = [];
  for (const c of Object.values(state.clubs)) {
    const cap = content.tiers.require(c.tierId).rosterCap;
    if ((counts.get(c.id) ?? 0) > cap) out.push(`${c.id}: ${counts.get(c.id)} > cap ${cap}`);
  }
  return out;
}

/** Schedule integrity of the season that just ended (state in phase 'season-end'). */
export function scheduleProblems(state: GameState, content: ContentDB): string[] {
  const out: string[] = [];
  const season = state.calendar.season;
  const lg = content.leagues;
  const qualifiers = lg.tournament.qualifiersPerWing * lg.wings.list.length;
  for (const tier of content.tiers.list) {
    const comps = Object.values(state.competitions).filter((c) => c.season === season && c.tierId === tier.id);
    const league = comps.find((c) => c.kind === 'league');
    const rk = comps.find((c) => c.kind === 'reckoning');
    if (!league) {
      out.push(`${tier.id}: no league competition`);
      continue;
    }
    const played = new Map<string, { home: number; away: number }>();
    for (const id of league.fixtureIds) {
      const x = state.fixtures[id];
      if (!x || x.status !== 'played' || !state.results[id]) {
        out.push(`${tier.id}: fixture ${id} not played`);
        continue;
      }
      const h = played.get(x.homeClubId) ?? { home: 0, away: 0 };
      h.home++;
      played.set(x.homeClubId, h);
      const a = played.get(x.awayClubId) ?? { home: 0, away: 0 };
      a.away++;
      played.set(x.awayClubId, a);
    }
    for (const c of league.clubIds) {
      const p = played.get(c) ?? { home: 0, away: 0 };
      if (p.home + p.away !== lg.regularSeason.matchesPerClub) out.push(`${c}: played ${p.home + p.away} league matches`);
    }
    if (!rk || !rk.bracket) {
      out.push(`${tier.id}: no Reckoning`);
      continue;
    }
    if (rk.clubIds.length !== qualifiers) out.push(`${tier.id}: Reckoning has ${rk.clubIds.length} clubs`);
    if (rk.bracket.rounds.length !== lg.tournament.rounds.length) out.push(`${tier.id}: Reckoning has ${rk.bracket.rounds.length} rounds`);
    const rkPlayed = rk.fixtureIds.filter((id) => state.results[id]).length;
    if (rkPlayed !== qualifiers - 1) out.push(`${tier.id}: ${rkPlayed} Reckoning matches played`);
    if (rk.bracket.championId === null) out.push(`${tier.id}: no Reckoning champion`);
  }
  return out;
}

/** Dynasty flags over the archive (economy.json balanceTargets.dynasty). */
export function dynastyFlags(history: readonly SeasonRecord[], content: ContentDB): string[] {
  const d = content.economy.balanceTargets.dynasty;
  const out: string[] = [];
  const windows = (key: 'reckoningChampionId' | 'shieldWinnerId', size: number, flag: number, label: string): void => {
    for (let start = 0; start < history.length; start++) {
      const span = history.slice(start, start + size);
      const counts = new Map<string, number>();
      for (const rec of span) for (const t of rec.tiers) if (t[key]) counts.set(`${t.tierId}/${t[key]}`, (counts.get(`${t.tierId}/${t[key]}`) ?? 0) + 1);
      for (const [k, n] of counts) {
        if (n >= flag) {
          const msg = `${k}: ${n} ${label} in seasons ${span[0]!.season}-${span[span.length - 1]!.season}`;
          if (!out.includes(msg)) out.push(msg);
        }
      }
    }
  };
  windows('reckoningChampionId', d.windowSeasons, d.titlesFlag, 'Reckoning titles');
  windows('shieldWinnerId', d.shieldWindowSeasons, d.shieldsFlag, 'Shields');
  return out;
}

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.trunc(s.length / 2);
  return s.length % 2 === 1 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

interface AgeStats {
  medianHumanAge: number;
  shareAtMost22: number;
  shareAtLeast31: number;
}

/** Human-age distribution of rostered fighters (development.json soakTargets). */
export function ageStats(state: GameState, ports: GamePorts, content: ContentDB): AgeStats {
  const ages: number[] = [];
  for (const f of Object.values(state.fighters)) if (f.status === 'active') ages.push(ports.fighters.humanAge100(f, content) / 100);
  const n = Math.max(1, ages.length);
  return {
    medianHumanAge: median(ages),
    shareAtMost22: ages.filter((a) => a < 23).length / n,
    shareAtLeast31: ages.filter((a) => a >= 31).length / n,
  };
}

// ---- M1.1 observations ------------------------------------------------------------------------------------------

/** Round starts of non-player clubs by Freshness label (from the recorded round lineups). */
export function freshnessStarts(state: GameState, results: readonly MatchResult[]): { starts: number; tired: number; spent: number } {
  const out = { starts: 0, tired: 0, spent: 0 };
  for (const r of results) {
    for (const rl of r.roundLineups ?? []) {
      for (const side of ['home', 'away'] as const) {
        const clubId = side === 'home' ? r.homeClubId : r.awayClubId;
        if (clubId === state.playerClubId) continue;
        for (const f of rl[side].freshness) {
          out.starts++;
          if (f < 40) out.spent++;
          else if (f < 60) out.tired++;
        }
      }
    }
  }
  return out;
}

/** Swaps per result (both sides), forced (injury or emergency), emergency entrants. */
export function swapCounts(results: readonly MatchResult[]): { matches: number; swaps: number; forced: number; emergency: number } {
  const out = { matches: 0, swaps: 0, forced: 0, emergency: 0 };
  for (const r of results) {
    if (!r.roundLineups) continue;
    out.matches++;
    for (const b of r.betweenRounds ?? []) {
      for (const s of [...b.home, ...b.away]) {
        out.swaps++;
        if (s.reason === 'injury' || s.reason === 'emergency') out.forced++;
        if (s.reason === 'emergency') out.emergency++;
      }
    }
  }
  return out;
}

/**
 * Integrity of the round-by-round records: 5 distinct fighters a side every
 * round; at most combat.json maxPerMatch swaps a side (emergency entrants
 * aside); a swapped-out fighter never plays again; who enters was a squad
 * reserve (a swap) or an emergency entrant.
 */
export function squadRecordProblems(results: readonly MatchResult[], content: ContentDB): string[] {
  const out: string[] = [];
  const max = content.combat.match.swaps.maxPerMatch;
  for (const r of results) {
    if (!r.roundLineups || !r.squads) continue;
    for (const side of ['home', 'away'] as const) {
      const squad = r.squads[side];
      const out5 = new Set<FighterId>();
      let swaps = 0;
      for (const rl of r.roundLineups) {
        const ids = rl[side].fighterIds;
        if (ids.length !== 5 || new Set(ids).size !== 5) out.push(`${r.fixtureId} ${side} round ${rl.round}: ${new Set(ids).size} distinct`);
        for (const id of ids) if (out5.has(id)) out.push(`${r.fixtureId} ${side}: ${id} returned in round ${rl.round}`);
        for (const b of r.betweenRounds ?? []) {
          if (b.afterRound !== rl.round) continue;
          for (const s of b[side]) {
            out5.add(s.out);
            if (s.costsSwap) {
              swaps++;
              if (!squad.reserves.includes(s.in)) out.push(`${r.fixtureId} ${side}: ${s.in} entered with a swap but is no reserve`);
            } else if (!(r.emergencyEntrants ?? []).includes(s.in)) out.push(`${r.fixtureId} ${side}: ${s.in} entered without a swap and is no emergency entrant`);
          }
        }
      }
      if (swaps > max) out.push(`${r.fixtureId} ${side}: ${swaps} swaps`);
    }
  }
  return out;
}

interface LevelCohort {
  key: string;
  minAge: number;
  maxAge: number;
  potMin: number;
  potMax: number;
}

/** levels.json soakTargets cohort keys: "18-20 potential>=70", "21-23", "24-26 potential 50-65", "35+". */
export function parseCohort(key: string): LevelCohort {
  const m = /^(\d+)(?:-(\d+)|\+)(?:\s+potential\s*(?:>=\s*(\d+)|(\d+)-(\d+)))?$/.exec(key.trim());
  if (!m) throw new RangeError(`soak: unreadable cohort "${key}"`);
  return {
    key,
    minAge: Number(m[1]),
    maxAge: m[2] !== undefined ? Number(m[2]) : 999,
    potMin: m[3] !== undefined ? Number(m[3]) : m[4] !== undefined ? Number(m[4]) : 0,
    potMax: m[5] !== undefined ? Number(m[5]) : 999,
  };
}

/** A human-age band for the age-matched bench ratio. The first band also takes every age below its lower edge. */
export interface LevelAgeBand {
  key: string;
  minAge: number;
  maxAge: number;
}

/**
 * Human-age bands for the age-matched bench ratio: one band per distinct lower age edge among the levels.json
 * soakTargets cohort keys ("18-20 potential>=70", "21-23", ..., "35+" give 18-20, 21-23, 24-26, 27-30, 31-34, 35+),
 * the potential part of a key ignored. The first band starts at age 0 and the last is open-ended, so every
 * fighter falls in exactly one band.
 */
export function levelAgeBands(content: ContentDB): LevelAgeBand[] {
  const edges = [...new Set(Object.keys(content.levels.soakTargets.starterLevelsPerSeasonByHumanAge).map((k) => parseCohort(k).minAge))].sort((a, b) => a - b);
  if (edges.length === 0) return [{ key: 'all', minAge: 0, maxAge: 999 }];
  return edges.map((lo, i) => {
    const next = edges[i + 1];
    return { key: next === undefined ? `${lo}+` : `${lo}-${next - 1}`, minAge: i === 0 ? 0 : lo, maxAge: next === undefined ? 999 : next - 1 };
  });
}

/**
 * Bench levels against what the same bench fighters would have gained at their own age's starter rate.
 *
 * The bench skews younger than the starters and the young level faster, so pooling every bench fighter against
 * every starter inflates the ratio. Here each band's bench fighters are compared with the starters of that band
 * only: ratio = sum(bench levels) / sum(bench fighters x starter mean levels of the band), i.e. the band ratios
 * weighted by bench count (x the band's starter rate). A band with fewer than MIN_COHORT starters, no bench
 * fighters or no starter levels has no reliable reference and is left out of both sides. null when no band is left.
 */
export function ageMatchedBenchRatio(bands: Iterable<AgeBandLevels>): { ratio: number; benchFighters: number; bands: number } | null {
  let benchLevels = 0;
  let expected = 0;
  let benchFighters = 0;
  let used = 0;
  for (const b of bands) {
    if (b.starters.fighters < MIN_COHORT || b.starters.levels <= 0 || b.bench.fighters === 0) continue;
    benchLevels += b.bench.levels;
    expected += b.bench.fighters * (b.starters.levels / b.starters.fighters);
    benchFighters += b.bench.fighters;
    used++;
  }
  return expected > 0 ? { ratio: benchLevels / expected, benchFighters, bands: used } : null;
}

interface LevelStart {
  level: number;
  humanAge: number;
  potential: number;
  clubId: ClubId | null;
}

function levelSnapshot(state: GameState, ports: GamePorts, content: ContentDB): Map<FighterId, LevelStart> {
  const m = new Map<FighterId, LevelStart>();
  for (const f of Object.values(state.fighters)) {
    if (f.status !== 'active') continue;
    m.set(f.id, { level: f.level, humanAge: Math.floor(ports.fighters.humanAge100(f, content) / 100), potential: ports.fighters.potential(f, content), clubId: f.clubId });
  }
  return m;
}

/** Levels gained over the season (state at phase 'season-end', before the season-end step) by fighters rostered at its start. */
function levelSummary(state: GameState, start: Map<FighterId, LevelStart>, ports: GamePorts, content: ContentDB): { levels: SoakLevelSummary; stamina: number | null } {
  const cohorts = Object.keys(content.levels.soakTargets.starterLevelsPerSeasonByHumanAge).map(parseCohort);
  const ageBands = levelAgeBands(content);
  const levels: SoakLevelSummary = { cohorts: {}, starters: { fighters: 0, levels: 0 }, bench: { fighters: 0, levels: 0 }, total: 0, ageBands: {} };
  for (const c of cohorts) levels.cohorts[c.key] = { fighters: 0, levels: 0, levelsSq: 0, matches: 0 };
  for (const b of ageBands) levels.ageBands[b.key] = { starters: { fighters: 0, levels: 0 }, bench: { fighters: 0, levels: 0 } };
  const stamina: number[] = [];
  const hasStamina = content.stats.list.some((s) => s.id === 'stamina');
  for (const [id, s0] of start) {
    const f = state.fighters[id];
    if (!f || f.status !== 'active' || f.clubId !== s0.clubId) continue;
    const gained = Math.max(0, f.level - s0.level);
    levels.total += gained;
    const matches = f.season.matchesStarted;
    const ageBand = levels.ageBands[(ageBands.find((b) => s0.humanAge >= b.minAge && s0.humanAge <= b.maxAge) ?? ageBands[0]!).key]!;
    if (matches >= PROVISIONAL_STARTER_MIN_MATCHES) {
      levels.starters.fighters++;
      levels.starters.levels += gained;
      if (hasStamina) stamina.push(ports.fighters.effectiveStats(f, content)['stamina' as StatId] ?? 0);
      for (const c of cohorts) {
        if (s0.humanAge < c.minAge || s0.humanAge > c.maxAge || s0.potential < c.potMin || s0.potential > c.potMax) continue;
        const row = levels.cohorts[c.key]!;
        row.fighters++;
        row.levels += gained;
        row.levelsSq += gained * gained;
        row.matches += matches;
      }
    } else if (matches <= PROVISIONAL_BENCH_MAX_MATCHES) {
      levels.bench.fighters++;
      levels.bench.levels += gained;
    }
    // The age-matched bench ratio's groups: regular starters against the bench proper (see the constants).
    if (matches >= PROVISIONAL_RATIO_STARTER_MIN_MATCHES) {
      ageBand.starters.fighters++;
      ageBand.starters.levels += gained;
    } else if (matches <= PROVISIONAL_RATIO_BENCH_MAX_MATCHES) {
      ageBand.bench.fighters++;
      ageBand.bench.levels += gained;
    }
  }
  return { levels, stamina: stamina.length > 0 ? median(stamina) : null };
}

// ---- the run ----------------------------------------------------------------------------------------------------

interface RunResult {
  summaries: SoakSeasonSummary[];
  checksums: string[];
  final: GameState | null;
  error: string | null;
  notImplemented: string | null;
  observations: Observations;
}

interface Observations {
  ledger: string[];
  lineups: string[];
  overCap: string[];
  schedule: string[];
  references: string[];
  roundtrip: string[];
  solvency: { season: number; shareBp: number }[];
  ages: { season: number; stats: AgeStats }[];
  aiRejections: Record<string, number>;
  squads: string[];
}

function notImplementedOf(message: string): string | null {
  const m = /Not implemented yet: ([\w.]+)/.exec(message);
  return m ? m[1]! : null;
}

function runOnce(options: SoakOptions, seasons: number, observe: boolean): RunResult {
  try {
    return runOnceUnsafe(options, seasons, observe);
  } catch (e) {
    // A stubbed module throws NotImplementedError through the engine; any other throw is an engine bug.
    const message = e instanceof Error ? e.message : String(e);
    const obs: Observations = { ledger: [], lineups: [], overCap: [], schedule: [], references: [], roundtrip: [], solvency: [], ages: [], aiRejections: {}, squads: [] };
    return { summaries: [], checksums: [], final: null, error: message, notImplemented: e instanceof NotImplementedError ? notImplementedOf(message) : null, observations: obs };
  }
}

function runOnceUnsafe(options: SoakOptions, seasons: number, observe: boolean): RunResult {
  const { content } = options;
  const ports = options.ports ?? realGamePorts;
  const engine = createGameEngine(ports);
  const obs: Observations = { ledger: [], lineups: [], overCap: [], schedule: [], references: [], roundtrip: [], solvency: [], ages: [], aiRejections: {}, squads: [] };
  const summaries: SoakSeasonSummary[] = [];
  const checksums: string[] = [];
  const fail = (message: string, state: GameState | null): RunResult => ({ summaries, checksums, final: state, error: message, notImplemented: notImplementedOf(message), observations: obs });
  const created = engine.createWorld(content, { rootSeed: options.seed });
  if (!created.ok) return fail(created.error.message, null);
  let state = created.value;
  const push = (list: string[], items: readonly string[]): void => {
    for (const i of items) if (list.length < 50) list.push(i);
  };
  for (let s = 0; s < seasons; s++) {
    let freeAgentsAtP1 = -1;
    let minPool = Number.POSITIVE_INFINITY;
    let bladeSlots = 0;
    let slots = 0;
    let rejections = 0;
    const fresh = { starts: 0, tired: 0, spent: 0 };
    const swaps = { matches: 0, swaps: 0, forced: 0, emergency: 0 };
    let levelStart: Map<FighterId, LevelStart> | null = null;
    while (state.calendar.phase !== 'season-end') {
      if (freeAgentsAtP1 < 0) freeAgentsAtP1 = Object.values(state.fighters).filter((f) => f.status === 'free-agent').length;
      if (observe && levelStart === null) levelStart = levelSnapshot(state, ports, content);
      const r = engine.advanceWeekLogged(state, content);
      if (!r.ok) return fail(`${r.error.code}: ${r.error.message}`, state);
      state = r.value.state;
      rejections += r.value.log.rejections.length;
      for (const x of r.value.log.rejections) obs.aiRejections[`${x.type}:${x.code}`] = (obs.aiRejections[`${x.type}:${x.code}`] ?? 0) + 1;
      if (observe) {
        const results = r.value.report.fixtureIds.map((id) => state.results[id]!).filter(Boolean);
        push(obs.ledger, ledgerMismatches(state).map((m) => `S${state.calendar.season} ${r.value.report.weekId}: ${m}`));
        push(obs.lineups, lineupProblems(state, results));
        push(obs.squads, squadRecordProblems(results, content));
        const fr = freshnessStarts(state, results);
        fresh.starts += fr.starts;
        fresh.tired += fr.tired;
        fresh.spent += fr.spent;
        const sw = swapCounts(results);
        swaps.matches += sw.matches;
        swaps.swaps += sw.swaps;
        swaps.forced += sw.forced;
        swaps.emergency += sw.emergency;
        push(obs.overCap, overCap(state, content).map((m) => `S${state.calendar.season} ${r.value.report.weekId}: ${m}`));
        for (const res of results) {
          slots += 10;
          bladeSlots += res.hiredBladeIds.length;
        }
        if (state.calendar.phase !== 'preseason') {
          minPool = Math.min(minPool, Object.values(state.fighters).filter((f) => f.status === 'free-agent').length);
        }
      }
    }
    const season = state.calendar.season;
    let solventShareBp = 0;
    let medianWage = 0;
    const progression = observe && levelStart ? levelSummary(state, levelStart, ports, content) : null;
    if (observe) {
      push(obs.schedule, scheduleProblems(state, content).map((m) => `S${season}: ${m}`));
      const ai = Object.values(state.clubs).filter((c) => c.id !== state.playerClubId);
      solventShareBp = ai.length ? Math.trunc((ai.filter((c) => c.finance.balance >= 0).length * BP) / ai.length) : BP;
      obs.solvency.push({ season, shareBp: solventShareBp });
      medianWage = median(Object.values(state.fighters).filter((f) => f.status === 'active' && f.contract).map((f) => f.contract!.wagePerWeek));
    }
    const end = engine.runSeasonEndLogged(state, content);
    if (!end.ok) return fail(`${end.error.code}: ${end.error.message}`, state);
    state = end.value.state;
    rejections += end.value.log.rejections.length;
    for (const x of end.value.log.rejections) obs.aiRejections[`${x.type}:${x.code}`] = (obs.aiRejections[`${x.type}:${x.code}`] ?? 0) + 1;
    const checksum = checksumState(state);
    checksums.push(checksum);
    const record = state.history[state.history.length - 1]!;
    const fighters = Object.values(state.fighters);
    const summary: SoakSeasonSummary = {
      season,
      champions: record.tiers.map((t) => t.reckoningChampionId),
      shields: record.tiers.map((t) => t.shieldWinnerId),
      population: fighters.filter((f) => f.status === 'active' || f.status === 'free-agent').length,
      rostered: fighters.filter((f) => f.status === 'active').length,
      freeAgentsAtP1,
      freeAgentsMinInSeason: Number.isFinite(minPool) ? minPool : 0,
      medianHumanAge: 0,
      retirements: record.retirements.filter((r) => r.cause !== 'left-unsigned').length,
      rookies: record.rookieIds.length,
      solventShareBp,
      medianWage,
      hiredBladeSlots: bladeSlots,
      lineupSlots: slots,
      aiRejections: rejections,
      checksum,
      roundStarts: fresh.starts,
      tiredStarts: fresh.tired,
      spentStarts: fresh.spent,
      matches: swaps.matches,
      swaps: swaps.swaps,
      forcedSwaps: swaps.forced,
      emergencyEntrants: swaps.emergency,
      levels: progression?.levels ?? { cohorts: {}, starters: { fighters: 0, levels: 0 }, bench: { fighters: 0, levels: 0 }, total: 0, ageBands: {} },
      starterStaminaMedian: progression?.stamina ?? null,
    };
    if (observe) {
      const stats = ageStats(state, ports, content);
      summary.medianHumanAge = stats.medianHumanAge;
      obs.ages.push({ season, stats });
      push(obs.references, validateState(state, content).map((i) => `S${season} ${i.path}: ${i.message}`));
      const env = createSave(state, saveMetaFor(state, { slotId: 'soak', kind: 'auto', label: 'soak', savedAt: '1970-01-01T00:00:00Z', playtimeSec: 0, gameVersion: 'soak' }), { engineVersion: ports.sim.engineVersion });
      const parsed = parseSave(serializeSave(env), content);
      if (!parsed.ok) push(obs.roundtrip, [`S${season}: ${parsed.error.code} ${parsed.error.message}`]);
      else if (checksumState(parsed.value.envelope.state) !== checksum) push(obs.roundtrip, [`S${season}: checksum changed through save/load`]);
      options.onSeason?.(summary);
    }
    summaries.push(summary);
  }
  return { summaries, checksums, final: state, error: null, notImplemented: null, observations: obs };
}

function inBand(x: number, band: readonly number[]): boolean {
  return x >= band[0]! && x <= band[1]!;
}

/** Outcome of an evaluated check: pass, or fail (warn for a warning-level check). */
export function checkStatus(id: string, ok: boolean): SoakCheckStatus {
  if (ok) return 'pass';
  return SOAK_CHECKS.find((c) => c.id === id)?.severity === 'warn' ? 'warn' : 'fail';
}

/**
 * The level-ups check over the measured seasons (levels.json soakTargets): starter levels per season by human-age
 * cohort (each cohort judged by `judgeCohort`: skipped when small, noise margin otherwise), matches per level of the
 * mid cohort, the age-matched bench ratio and the starter Stamina median. Pure: exported for tests.
 */
export function levelUpsCheck(measured: readonly SoakSeasonSummary[], content: ContentDB): Pick<SoakCheck, 'status' | 'detail'> {
  const lt = content.levels.soakTargets;
  const total = measured.reduce((n, s) => n + s.levels.total, 0);
  if (total === 0) return { status: 'pending', detail: 'no level-ups observed (in-season leveling not active)' };
  const bad: string[] = [];
  const parts: string[] = [];
  for (const [key, band] of Object.entries(lt.starterLevelsPerSeasonByHumanAge)) {
    // Pooled over the measured seasons; judged against the band with the cohort's own sampling noise (judgeCohort).
    const tally = measured.reduce(
      (a, s) => {
        const row = s.levels.cohorts[key];
        return row ? { fighters: a.fighters + row.fighters, levels: a.levels + row.levels, levelsSq: a.levelsSq + row.levelsSq } : a;
      },
      { fighters: 0, levels: 0, levelsSq: 0 },
    );
    const v = judgeCohort(tally, band);
    const note = v.status === 'skipped' ? `, below ${MIN_COHORT_GATE}: not gated` : v.outside > 0 ? `, outside ${band.join('-')} by ${v.outside.toFixed(2)}, within noise ±${(COHORT_NOISE_Z * (v.stderr ?? 0)).toFixed(2)}` : '';
    parts.push(`${key}: ${v.mean.toFixed(2)} (n ${v.fighters}${note})`);
    if (v.status === 'fail') bad.push(`${key} ${v.mean.toFixed(2)} (band ${band.join('-')}, n ${v.fighters}, outside by ${v.outside.toFixed(2)} > ${(COHORT_NOISE_Z * (v.stderr ?? 0)).toFixed(2)} noise margin)`);
  }
  const midKey = Object.keys(lt.starterLevelsPerSeasonByHumanAge).find((k) => k.startsWith('24-26'));
  const mid = midKey ? measured.reduce((a, s) => ({ l: a.l + (s.levels.cohorts[midKey]?.levels ?? 0), m: a.m + (s.levels.cohorts[midKey]?.matches ?? 0) }), { l: 0, m: 0 }) : { l: 0, m: 0 };
  const perLevel = mid.l ? mid.m / mid.l : 0;
  if (mid.l > 0 && !inBand(perLevel, lt.matchesPerLevelMidCohort)) bad.push(`matches per level (mid) ${perLevel.toFixed(2)} (band ${lt.matchesPerLevelMidCohort.join('-')})`);
  const st = measured.reduce((a, s) => ({ f: a.f + s.levels.starters.fighters, l: a.l + s.levels.starters.levels }), { f: 0, l: 0 });
  const be = measured.reduce((a, s) => ({ f: a.f + s.levels.bench.fighters, l: a.l + s.levels.bench.levels }), { f: 0, l: 0 });
  // Pooled over all ages the bench reads high (it skews young); the check compares within human-age bands.
  const pooled = st.l && be.f ? be.l / be.f / (st.l / st.f) : 0;
  const bands: Record<string, AgeBandLevels> = {};
  for (const s of measured) {
    for (const [key, b] of Object.entries(s.levels.ageBands)) {
      const t = (bands[key] ??= { starters: { fighters: 0, levels: 0 }, bench: { fighters: 0, levels: 0 } });
      t.starters.fighters += b.starters.fighters;
      t.starters.levels += b.starters.levels;
      t.bench.fighters += b.bench.fighters;
      t.bench.levels += b.bench.levels;
    }
  }
  const matched = ageMatchedBenchRatio(Object.values(bands));
  const ratio = matched?.ratio ?? 0;
  if (matched && matched.benchFighters >= MIN_COHORT && !inBand(ratio, lt.benchLevelsToStarterLevelsRatio)) bad.push(`bench/starter levels, age-matched ${ratio.toFixed(2)} (band ${lt.benchLevelsToStarterLevelsRatio.join('-')}; pooled ${pooled.toFixed(2)})`);
  const sta = measured.map((s) => s.starterStaminaMedian).filter((x): x is number => x !== null);
  const staMed = sta.length ? median(sta) : null;
  if (staMed !== null && !inBand(staMed, lt.starterStaminaMedian)) bad.push(`starter Stamina median ${staMed} (band ${lt.starterStaminaMedian.join('-')})`);
  return {
    status: checkStatus('level-ups', bad.length === 0),
    detail: bad.length
      ? bad.slice(0, 4).join('; ')
      : `starter levels/season ${parts.join(', ')}; matches per level (mid) ${perLevel.toFixed(2)}; bench/starter ${matched ? ratio.toFixed(2) : 'n/a'} age-matched (${pooled.toFixed(2)} pooled); starter Stamina median ${staMed ?? 'n/a'}`,
  };
}

function evaluate(options: SoakOptions, main: RunResult, replay: RunResult | null): SoakCheck[] {
  const { content } = options;
  const st = content.development.soakTargets;
  const bt = content.economy.balanceTargets;
  const obs = main.observations;
  const done = main.summaries.length;
  const blocked = main.notImplemented ? `blocked: ${main.notImplemented} is not implemented yet` : main.error ? `stopped: ${main.error}` : null;
  const measured = main.summaries.filter((s) => s.season > Math.min(SOAK_WARMUP_SEASONS, Math.max(0, done - 1)));
  const result = new Map<string, Omit<SoakCheck, 'id' | 'description'>>();
  const set = (id: string, ok: boolean, detail: string): void => {
    result.set(id, { status: checkStatus(id, ok), detail });
  };
  const needSeasons = (id: string): boolean => {
    if (done > 0) return true;
    result.set(id, { status: 'pending', detail: blocked ?? 'no season completed' });
    return false;
  };

  // determinism
  if (replay === null) result.set('determinism', { status: 'pending', detail: blocked ?? 'second run skipped (determinismSeasons 0)' });
  else if (replay.error) result.set('determinism', { status: replay.notImplemented ? 'pending' : 'fail', detail: `second run: ${replay.error}` });
  else {
    const n = replay.checksums.length;
    const a = main.checksums[n - 1];
    const b = replay.checksums[n - 1];
    if (n === 0 || a === undefined) result.set('determinism', { status: 'pending', detail: blocked ?? 'no season to compare' });
    else set('determinism', a === b, `checksum after season ${n}: ${a}${a === b ? ' (identical)' : ` vs ${b}`}`);
  }
  // ledger-balance (every week)
  if (needSeasons('ledger-balance') || obs.ledger.length > 0) set('ledger-balance', obs.ledger.length === 0, obs.ledger.length ? obs.ledger.slice(0, 3).join('; ') : `${done} seasons, every club every week`);
  // ai-solvency
  if (needSeasons('ai-solvency')) {
    const min = bt.solventClubShareAtSeasonEndMinBp;
    const worst = obs.solvency.reduce((w, s) => (s.shareBp < w.shareBp ? s : w), obs.solvency[0]!);
    set('ai-solvency', obs.solvency.every((s) => s.shareBp >= min), `worst season ${worst.season}: ${(worst.shareBp / 100).toFixed(1)}% solvent (min ${min / 100}%)`);
  }
  // roster-size
  if (needSeasons('roster-size') || obs.lineups.length + obs.overCap.length > 0) {
    const problems = [...obs.lineups, ...obs.overCap];
    const blades = main.summaries.reduce((s, x) => s + x.hiredBladeSlots, 0);
    const slots = main.summaries.reduce((s, x) => s + x.lineupSlots, 0);
    const share = slots ? ((blades * 100) / slots).toFixed(2) : '0';
    set('roster-size', problems.length === 0, problems.length ? problems.slice(0, 3).join('; ') : `every lineup legal; hired blades ${share}% of slots (target <= ${bt.hiredBladeSlotShareMaxBp / 100}%)`);
  }
  // age-distribution
  if (needSeasons('age-distribution')) {
    const bad: string[] = [];
    for (const a of obs.ages.filter((x) => measured.some((m) => m.season === x.season))) {
      if (!inBand(a.stats.medianHumanAge, st.medianHumanAge)) bad.push(`S${a.season} median human-age ${a.stats.medianHumanAge.toFixed(1)}`);
      if (!inBand(a.stats.shareAtMost22, st.shareHumanAgeAtMost22)) bad.push(`S${a.season} share <=22 ${(a.stats.shareAtMost22 * 100).toFixed(1)}%`);
      if (!inBand(a.stats.shareAtLeast31, st.shareHumanAgeAtLeast31)) bad.push(`S${a.season} share >=31 ${(a.stats.shareAtLeast31 * 100).toFixed(1)}%`);
    }
    const last = obs.ages[obs.ages.length - 1]?.stats;
    const retire = main.summaries.map((s) => s.retirements).join('/');
    const inMeasured = obs.ages.filter((x) => measured.some((m) => m.season === x.season));
    const range = (xs: number[], bandOf: readonly number[]): string => (xs.length ? `${Math.min(...xs).toFixed(2)}-${Math.max(...xs).toFixed(2)} (band ${bandOf.join('-')})` : 'n/a');
    const share31 = inMeasured.length
      ? `; share <=22 ${range(inMeasured.map((x) => x.stats.shareAtMost22), st.shareHumanAgeAtMost22)}, share >=31 ${range(inMeasured.map((x) => x.stats.shareAtLeast31), st.shareHumanAgeAtLeast31)}`
      : '';
    set('age-distribution', bad.length === 0, bad.length ? bad.slice(0, 4).join('; ') : `median ${last?.medianHumanAge.toFixed(1)} (band ${st.medianHumanAge.join('-')})${share31}; retirements per season ${retire}`);
  }
  // fighter-population
  if (needSeasons('fighter-population')) {
    const base = measured[0] ?? main.summaries[0]!;
    const drift = measured.map((s) => Math.abs(s.population - base.population) / Math.max(1, base.population));
    const worst = Math.max(0, ...drift);
    const pool = main.summaries.map((s) => s.freeAgentsAtP1);
    const poolBad = main.summaries.filter((s) => s.season > 1 && !inBand(s.freeAgentsAtP1, bt.freeAgentPoolAtP1));
    const floorBad = main.summaries.filter((s) => s.freeAgentsMinInSeason < bt.freeAgentPoolInSeasonMin);
    const ok = worst * 100 <= st.populationDriftMaxPct && poolBad.length === 0 && floorBad.length === 0;
    set(
      'fighter-population',
      ok,
      `population ${main.summaries.map((s) => s.population).join('/')}, drift ${(worst * 100).toFixed(1)}% (max ${st.populationDriftMaxPct}%); pool at P1 ${pool.join('/')} (band ${bt.freeAgentPoolAtP1.join('-')}); in-season min ${Math.min(...main.summaries.map((s) => s.freeAgentsMinInSeason))} (floor ${bt.freeAgentPoolInSeasonMin})`,
    );
  }
  // wage-inflation
  if (needSeasons('wage-inflation')) {
    const ws = measured.map((s) => s.medianWage);
    let worst = 0;
    for (let i = 1; i < ws.length; i++) worst = Math.max(worst, Math.abs(ws[i]! - ws[i - 1]!) / Math.max(1, ws[i - 1]!));
    set('wage-inflation', worst * BP <= PROVISIONAL_MEDIAN_WAGE_GROWTH_MAX_BP, `median wage ${main.summaries.map((s) => s.medianWage).join('/')}; worst change ${(worst * 100).toFixed(1)}% (max ${PROVISIONAL_MEDIAN_WAGE_GROWTH_MAX_BP / 100}%, provisional)`);
  }
  // competitive-balance
  if (needSeasons('competitive-balance')) {
    const flags = main.final ? dynastyFlags(main.final.history, content) : [];
    set('competitive-balance', flags.length === 0, flags.length ? flags.slice(0, 3).join('; ') : `no dynasty flag over ${done} seasons`);
  }
  // schedule-integrity
  if (needSeasons('schedule-integrity') || obs.schedule.length > 0) set('schedule-integrity', obs.schedule.length === 0, obs.schedule.length ? obs.schedule.slice(0, 3).join('; ') : `${done} seasons: every club played its matches; every Reckoning complete`);
  // references
  if (needSeasons('references')) set('references', obs.references.length === 0, obs.references.length ? obs.references.slice(0, 3).join('; ') : `validateState clean after ${done} seasons`);
  // save-roundtrip
  if (needSeasons('save-roundtrip')) set('save-roundtrip', obs.roundtrip.length === 0, obs.roundtrip.length ? obs.roundtrip.slice(0, 3).join('; ') : `${done} season-end saves parsed back to identical checksums`);

  // ---- M1.1 ----
  const lt = content.levels.soakTargets;
  const pct = (n: number, d: number): string => `${d ? ((n * 100) / d).toFixed(1) : '0.0'}%`;
  // freshness-rotation (measured seasons)
  if (needSeasons('freshness-rotation')) {
    const starts = measured.reduce((n, s) => n + s.roundStarts, 0);
    const tired = measured.reduce((n, s) => n + s.tiredStarts, 0);
    const spent = measured.reduce((n, s) => n + s.spentStarts, 0);
    if (starts === 0) result.set('freshness-rotation', { status: 'pending', detail: 'no round-by-round matches recorded' });
    else {
      const ok = tired <= lt.aiTiredRoundStartShareMax * starts && spent <= lt.aiSpentRoundStartShareMax * starts;
      const per = measured.map((s) => `${pct(s.tiredStarts, s.roundStarts)}/${pct(s.spentStarts, s.roundStarts)}`).join(' ');
      set('freshness-rotation', ok, `Tired ${pct(tired, starts)} (max ${lt.aiTiredRoundStartShareMax * 100}%), Spent ${pct(spent, starts)} (max ${lt.aiSpentRoundStartShareMax * 100}%) of ${starts} AI round starts; by season ${per}`);
    }
  }
  // level-ups (measured seasons)
  if (needSeasons('level-ups')) result.set('level-ups', levelUpsCheck(measured, content));
  // match-squads (all seasons)
  if (needSeasons('match-squads') || obs.squads.length > 0) {
    const m = main.summaries.reduce((n, s) => n + s.matches, 0);
    const sw = main.summaries.reduce((n, s) => n + s.swaps, 0);
    const forced = main.summaries.reduce((n, s) => n + s.forcedSwaps, 0);
    const em = main.summaries.reduce((n, s) => n + s.emergencyEntrants, 0);
    const per = m ? sw / m : 0;
    const band = PROVISIONAL_SWAPS_PER_MATCH;
    const ok = obs.squads.length === 0 && (m === 0 || inBand(per, band));
    set(
      'match-squads',
      ok,
      obs.squads.length
        ? obs.squads.slice(0, 3).join('; ')
        : `${m} matches: ${per.toFixed(2)} swaps a match (band ${band.join('-')}, provisional), ${m ? (forced / m).toFixed(2) : '0'} forced, ${em} emergency entrants`,
    );
  }

  return SOAK_CHECKS.map((c) => {
    const r = result.get(c.id) ?? { status: 'pending' as const, detail: blocked ?? 'not evaluated' };
    // A run stopped by a module failure fails every check it reached; the rest stay pending.
    return { ...c, ...r, detail: blocked && r.status === 'pass' ? `${r.detail} (partial: ${blocked})` : r.detail };
  });
}

export function runSoak(options: SoakOptions): SoakReport {
  const { seed, seasons } = options;
  if (!Number.isSafeInteger(seasons) || seasons < 0) throw new RangeError(`seasons must be a non-negative integer, got ${seasons}`);
  const main = runOnce(options, seasons, true);
  const replaySeasons = Math.min(main.summaries.length, options.determinismSeasons ?? seasons);
  const replay = replaySeasons > 0 && !main.notImplemented ? runOnce(options, replaySeasons, false) : null;
  const checks = evaluate(options, main, replay);
  if (main.error && !main.notImplemented) {
    // The engine failed (not a missing module): every check the run could not reach fails.
    for (const c of checks) {
      if (c.status === 'pending') {
        c.status = 'fail';
        c.detail = `stopped: ${main.error}`;
      }
    }
  }
  return {
    kind: 'soak',
    stub: main.notImplemented !== null,
    seed,
    contentHash: options.content.ref.hash,
    seasonsRequested: seasons,
    seasonsCompleted: main.summaries.length,
    checks,
    seasons: main.summaries,
    finalChecksum: main.checksums[main.checksums.length - 1] ?? null,
    error: main.error,
    aiRejections: main.observations.aiRejections,
  };
}
