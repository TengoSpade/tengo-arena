import type { ContentDB } from '../content';
import { createGameEngine, realGamePorts, type GamePorts } from '../game';
import type { ClubId, GameState, MatchResult, SeasonRecord } from '../model';
import { checksumState, createSave, parseSave, saveMetaFor, serializeSave, validateState } from '../save';
import { type Seed } from '../rng';

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

export type SoakCheckStatus = 'pass' | 'fail' | 'pending';

export interface SoakCheck {
  id: string;
  description: string;
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
  const windows = (key: 'reckoningChampionId' | 'shieldWinnerId', window: number, flag: number, label: string): void => {
    for (let start = 0; start < history.length; start++) {
      const span = history.slice(start, start + window);
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
}

function notImplementedOf(message: string): string | null {
  const m = /Not implemented yet: ([\w.]+)/.exec(message);
  return m ? m[1]! : null;
}

function runOnce(options: SoakOptions, seasons: number, observe: boolean): RunResult {
  const { content } = options;
  const ports = options.ports ?? realGamePorts;
  const engine = createGameEngine(ports);
  const obs: Observations = { ledger: [], lineups: [], overCap: [], schedule: [], references: [], roundtrip: [], solvency: [], ages: [], aiRejections: {} };
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
    while (state.calendar.phase !== 'season-end') {
      if (freeAgentsAtP1 < 0) freeAgentsAtP1 = Object.values(state.fighters).filter((f) => f.status === 'free-agent').length;
      const r = engine.advanceWeekLogged(state, content);
      if (!r.ok) return fail(`${r.error.code}: ${r.error.message}`, state);
      state = r.value.state;
      rejections += r.value.log.rejections.length;
      for (const x of r.value.log.rejections) obs.aiRejections[`${x.type}:${x.code}`] = (obs.aiRejections[`${x.type}:${x.code}`] ?? 0) + 1;
      if (observe) {
        const results = r.value.report.fixtureIds.map((id) => state.results[id]!).filter(Boolean);
        push(obs.ledger, ledgerMismatches(state).map((m) => `S${state.calendar.season} ${r.value.report.weekId}: ${m}`));
        push(obs.lineups, lineupProblems(state, results));
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
    result.set(id, { status: ok ? 'pass' : 'fail', detail });
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
    set('age-distribution', bad.length === 0, bad.length ? bad.slice(0, 4).join('; ') : `median ${last?.medianHumanAge.toFixed(1)} (band ${st.medianHumanAge.join('-')}); retirements per season ${retire}`);
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
