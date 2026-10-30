/**
 * Balance mode `squad-match` (combat-skills.md §8 mode 5; wired by the M1.1
 * integrator, WP-C): full matches through core/game's orchestrator
 * (`playMatchAuto`) with the real modules: 7-fighter squads chosen by the AI
 * rule, starting Freshness drawn 30-100, lifecycle drain and immediate
 * injuries, auto-swap policies paired against `off` on the same squads,
 * Freshness and seeds (counterfactual pairs, sides mirrored), best-of-3 and
 * every fourth matchup best-of-5. Reserve value: threshold 50 with 2
 * reserves against the same club with none.
 */
import type { ContentDB } from '../content';
import { createGameEngine, playMatchAuto, realGamePorts, type GamePorts, type LockedSquads } from '../game';
import { asId, type AutoSwapRules, type ClubId, type Fixture, type FixtureId, type GameState, type MatchResult, type MatchSquad, type StartingRow } from '../model';
import { Rng, STREAM, type Seed } from '../rng';
import { cloneJson } from '../util';

/** Policies: threshold50 swaps below 50 (the Tired tier), threshold75 below 75 (any penalty tier); the +10 lost-round bonus applies on top. */
export type SquadPolicy = 'off' | 'injured_only' | 'threshold50' | 'threshold75';

export interface SquadMatchRow {
  /** The policy side (the other side plays `off`); 'reserves2v0': threshold 50 with 2 reserves against 0. */
  id: SquadPolicy | 'reserves2v0';
  matches: number;
  winRate: number;
  ci: { low: number; high: number };
  /** P(win the match | lost round 1) of the policy side, and of the same side with `off` on the same matchups. */
  comebackRate: number | null;
  offComebackRate: number | null;
  swapsPerMatch: number;
  target: { min: number; max: number } | null;
  inTarget: boolean;
}

export interface SquadMatchReport {
  matchups: number;
  matches: number;
  rows: SquadMatchRow[];
  /** All matches: swaps (both sides), forced replacements and emergency entrants per 100 matches, fighter-rounds started Tired / Spent, rounds per match, time-capped rounds. */
  swapsPerMatch: number;
  forcedPer100: number;
  emergencyPer100: number;
  /** Share of fighter-rounds started in each tier: Winded 50-74, Tired 25-49, Spent below 25 (levels.json freshness.labels). */
  windedShare: number;
  tiredShare: number;
  spentShare: number;
  roundsPerMatch: number;
  timeCapShare: number;
  flags: string[];
}

/** combat-skills.md §8 squad-match targets (PROPOSED · TUNABLE). */
export const SQUAD_MATCH_TARGETS = {
  policyVsOffMax: 0.56,
  threshold50VsOff: { min: 0.51, max: 0.55 },
  comebackDeltaPts: { min: -3, max: 5 },
  reserveValue: { min: 0.52, max: 0.58 },
  swapsPerMatch: { min: 0.6, max: 1.4 },
  timeCapMax: 0.02,
} as const;

/**
 * Scenario: each fighter's starting Freshness is drawn uniformly from this range, in tenths (0-1000). Drawn from 0-100 (it was
 * 50-100, KI-21): from a 50 floor nobody can reach the Tired tier inside a best-of-3 under the old thresholds, so the swap
 * threshold never fired and four rows replayed the same matches. 0-100 reproduces the AI round-start shares the 10-season soak
 * measures in the same tiers (soak: Winded not reported, Tired 24.0%, Spent 10.8%; here Winded 39%, Tired 24%, Spent 7%): the
 * full range is the closest a uniform draw gets. A 30-100 draw (Tired 17%, Spent 0%) gives more swaps and a better threshold
 * result (05 sec. 12 KI-21 has both).
 */
export const START_FRESHNESS10 = { min: 0, max: 1000 } as const;

const POLICIES: readonly SquadPolicy[] = ['off', 'injured_only', 'threshold50', 'threshold75'];

function rulesFor(content: ContentDB, policy: SquadPolicy): AutoSwapRules {
  const d = content.combat.match.autoSwapDefaults;
  // The shipped lost-round bonus (levels.json aiSubstitution.lostRoundThresholdBonus, +10 in D-V) applies to every policy, as in play.
  const base: AutoSwapRules = { ...d, lostRoundBonus: content.levels.aiSubstitution.lostRoundThresholdBonus };
  if (policy === 'off') return { ...base, mode: 'off' };
  if (policy === 'injured_only') return { ...base, mode: 'injured_only' };
  return { ...base, mode: 'threshold', freshnessBelow: policy === 'threshold50' ? 50 : 75 };
}

/** A small state with the two clubs, their fighters (cloned) and the fixture: matches never touch the rest. */
function miniState(world: GameState, clubs: readonly ClubId[], fixture: Fixture): GameState {
  const fighters: GameState['fighters'] = {};
  for (const f of Object.values(world.fighters)) if (f.clubId !== null && clubs.includes(f.clubId) && f.status === 'active') fighters[f.id] = cloneJson(f);
  const cl: GameState['clubs'] = {};
  for (const c of clubs) cl[c] = cloneJson(world.clubs[c]!);
  return { ...world, clubs: cl, fighters, fixtures: { [fixture.id]: fixture }, results: {}, news: [], ids: { ...world.ids }, rng: cloneJson(world.rng), liveMatch: null };
}

function squadOf(ports: GamePorts, state: GameState, clubId: ClubId, reserves: boolean, content: ContentDB): MatchSquad {
  const choice = ports.ai.chooseLineup(state, clubId, content);
  const club = state.clubs[clubId]!;
  for (const [id, t] of Object.entries(choice.tactics)) club.lineup.tactics[id as keyof typeof club.lineup.tactics] = t;
  const rows = {} as Record<string, StartingRow>;
  for (const e of choice.fighters) rows[e.fighterId] = e.row;
  const res = reserves ? choice.reserves : [];
  for (const id of res) rows[id] = content.classes.require(state.fighters[id]!.classId).startingRow;
  return { starters: choice.fighters.map((e) => e.fighterId), reserves: [...res], rows, captainId: club.captainId, viceCaptainId: club.viceCaptainId };
}

interface Tally {
  /** Distinct matches played. */
  matches: number;
  /** Perspectives counted: one per match, two for the shared off-against-off matches (each is both clubs' `off` match). */
  perspectives: number;
  wins: number;
  lostR1: number;
  comebacks: number;
  swaps: number;
}

const tally = (): Tally => ({ matches: 0, perspectives: 0, wins: 0, lostR1: 0, comebacks: 0, swaps: 0 });

export function runSquadMatch(options: { seed: Seed; fights: number; content: ContentDB; ports?: GamePorts; startFreshness10?: { min: number; max: number } }): SquadMatchReport {
  const { seed, content } = options;
  const start = options.startFreshness10 ?? START_FRESHNESS10;
  const ports = options.ports ?? realGamePorts;
  const engine = createGameEngine(ports);
  const w = engine.createWorld(content, { rootSeed: seed });
  if (!w.ok) throw new Error(`squad-match: ${w.error.message}`);
  const world = w.value;
  const clubs = Object.keys(world.clubs).sort() as ClubId[];
  const rowIds: SquadMatchRow['id'][] = [...POLICIES, 'reserves2v0'];
  // Per matchup: 2 distinct off-against-off matches (club a home, club a away) plus 4 matches for each of the 4 other rows.
  const matchups = Math.max(1, Math.floor(options.fights / (2 + (rowIds.length - 1) * 4)));
  const tallies = new Map<string, Tally>(rowIds.map((id) => [id, tally()]));
  const offTallies = new Map<string, Tally>(rowIds.map((id) => [id, tally()]));
  const all = { matches: 0, swaps: 0, forced: 0, emergency: 0, starts: 0, winded: 0, tired: 0, spent: 0, rounds: 0, capped: 0 };
  // Tier boundaries (levels.json freshness.labels = combat.json freshness.tiers): Fresh >= 75, Winded 50-74, Tired 25-49, Spent < 25.
  const minOf = (id: string): number => content.levels.freshness.labels.find((l) => l.id === id)!.min;
  const freshFrom = minOf('fresh');
  const windedFrom = minOf('ready');
  const tiredFrom = minOf('tired');

  /**
   * Record one played match. `mirrored`: the match is both clubs' `off` match (off against off, the same match seen from either
   * club), so it is counted once as a match and read from both sides: exactly one side wins, which is why the `off` row is 50% by
   * construction and carries no information; comeback (the side that lost round 1) and swaps use both sides.
   */
  const record = (r: MatchResult, policySide: 'home' | 'away', targets: Tally[], counted: boolean, mirrored = false): void => {
    const sides: ('home' | 'away')[] = mirrored ? ['home', 'away'] : [policySide];
    for (const t of targets) {
      t.matches++;
      for (const side of sides) {
        t.perspectives++;
        const won = (side === 'home' ? r.homeClubId : r.awayClubId) === r.winnerClubId;
        if (won) t.wins++;
        if (r.rounds[0]!.winner !== side) {
          t.lostR1++;
          if (won) t.comebacks++;
        }
        for (const bt of r.betweenRounds ?? []) t.swaps += bt[side].length;
      }
    }
    if (!counted) return;
    all.matches++;
    all.rounds += r.rounds.length;
    all.capped += r.rounds.filter((x) => x.endReason === 'time-limit').length;
    for (const b of r.betweenRounds ?? []) {
      for (const s of [...b.home, ...b.away]) {
        all.swaps++;
        if (s.reason === 'injury' || s.reason === 'emergency') all.forced++;
        if (s.reason === 'emergency') all.emergency++;
      }
    }
    for (const rl of r.roundLineups ?? []) {
      for (const f of [...rl.home.freshness, ...rl.away.freshness]) {
        all.starts++;
        if (f < tiredFrom) all.spent++;
        else if (f < windedFrom) all.tired++;
        else if (f < freshFrom) all.winded++;
      }
    }
  };

  for (let j = 0; j < matchups; j++) {
    const rng = Rng.create(seed, STREAM.balance, 'squad-match', j);
    const a = clubs[rng.int(0, clubs.length - 1)]!;
    let b = clubs[rng.int(0, clubs.length - 2)]!;
    if (b === a) b = clubs[clubs.length - 1]!;
    const fresh = new Map<string, number>();
    for (const f of Object.values(world.fighters)) if (f.clubId === a || f.clubId === b) fresh.set(f.id, rng.int(start.min, start.max));
    const bestOf = j % 4 === 3 ? 5 : 3;
    // Mirrored on both axes: each policy row is played with the policy on club `a`, then on club `b` (the two clubs are rarely equal,
    // and a one-sided pairing would put their strength gap into every win rate), and with the policy club at home, then away.
    // The counterfactual is `off` against `off`, both with reserves: the same two matches for every row (club a home / away; with
    // the policy on b they are the same matches again), so each is played once and shared.
    const play = (policyClub: ClubId, otherClub: ClubId, policySide: 'home' | 'away', policyRules: AutoSwapRules, otherRules: AutoSwapRules, policyReserves: boolean, otherReserves: boolean): MatchResult => {
      const home = policySide === 'home' ? policyClub : otherClub;
      const away = policySide === 'home' ? otherClub : policyClub;
      const fixture: Fixture = {
        id: asId<FixtureId>(`sm:${j}`),
        competitionId: asId('sm'),
        season: world.calendar.season,
        tierId: world.clubs[home]!.tierId,
        weekIndex: world.calendar.weekIndex,
        weekId: world.calendar.weekId!,
        stage: 'league',
        matchweek: null,
        wing: null,
        homeClubId: home,
        awayClubId: away,
        bestOf,
        venueId: null,
        status: 'scheduled',
      };
      const s = miniState(world, [a, b], fixture);
      for (const [fid, v] of fresh) if (s.fighters[fid as keyof typeof s.fighters]) s.fighters[fid as keyof typeof s.fighters]!.freshness10 = v;
      s.clubs[policyClub]!.autoSwap = policyRules;
      s.clubs[otherClub]!.autoSwap = otherRules;
      const squads: LockedSquads = {
        home: squadOf(ports, s, home, home === policyClub ? policyReserves : otherReserves, content),
        away: squadOf(ports, s, away, away === policyClub ? policyReserves : otherReserves, content),
      };
      return playMatchAuto(ports, s, fixture, squads, content);
    };
    const off = rulesFor(content, 'off');
    for (const side of ['home', 'away'] as const) {
      const cf = play(a, b, side, off, off, true, true);
      record(cf, side, [...rowIds.map((id) => offTallies.get(id)!), tallies.get('off')!], true, true);
    }
    for (const [policyClub, otherClub] of [[a, b], [b, a]] as const) {
      for (const policySide of ['home', 'away'] as const) {
        for (const id of rowIds) {
          if (id === 'off') continue;
          const r =
            id === 'reserves2v0'
              ? play(policyClub, otherClub, policySide, rulesFor(content, 'threshold50'), rulesFor(content, 'threshold50'), true, false)
              : play(policyClub, otherClub, policySide, rulesFor(content, id), off, true, true);
          record(r, policySide, [tallies.get(id)!], true);
        }
      }
    }
  }

  const flags: string[] = [];
  const T = SQUAD_MATCH_TARGETS;
  const rows: SquadMatchRow[] = rowIds.map((id) => {
    const t = tallies.get(id)!;
    const o = offTallies.get(id)!;
    const winRate = t.perspectives ? t.wins / t.perspectives : 0;
    const target = id === 'reserves2v0' ? T.reserveValue : id === 'threshold50' ? T.threshold50VsOff : id === 'off' ? null : { min: 0, max: T.policyVsOffMax };
    const comebackRate = t.lostR1 ? t.comebacks / t.lostR1 : null;
    const offComebackRate = o.lostR1 ? o.comebacks / o.lostR1 : null;
    const inTarget = target === null || (winRate >= target.min && winRate <= target.max);
    if (!inTarget) flags.push(`${id}: wins ${(winRate * 100).toFixed(1)}% (target ${target!.min * 100}-${target!.max * 100}%)`);
    if (id !== 'off' && id !== 'reserves2v0' && comebackRate !== null && offComebackRate !== null) {
      const d = (comebackRate - offComebackRate) * 100;
      if (d < T.comebackDeltaPts.min || d > T.comebackDeltaPts.max) flags.push(`${id}: comeback ${d.toFixed(1)} points against off (target ${T.comebackDeltaPts.min} to +${T.comebackDeltaPts.max})`);
    }
    return { id, matches: t.matches, winRate, ci: wilsonCi(Math.round(winRate * t.matches), t.matches), comebackRate, offComebackRate, swapsPerMatch: t.perspectives ? t.swaps / t.perspectives : 0, target, inTarget };
  });
  const thresholdSwaps = rows.filter((r) => r.id === 'threshold50' || r.id === 'threshold75');
  const meanSwaps = thresholdSwaps.reduce((n, r) => n + r.swapsPerMatch, 0) / Math.max(1, thresholdSwaps.length);
  if (meanSwaps < T.swapsPerMatch.min || meanSwaps > T.swapsPerMatch.max) flags.push(`swaps per match (threshold policies) ${meanSwaps.toFixed(2)} (target ${T.swapsPerMatch.min}-${T.swapsPerMatch.max})`);
  const timeCapShare = all.rounds ? all.capped / all.rounds : 0;
  if (timeCapShare > T.timeCapMax) flags.push(`time-capped rounds ${(timeCapShare * 100).toFixed(1)}% (max ${T.timeCapMax * 100}%)`);
  return {
    matchups,
    matches: all.matches,
    rows,
    swapsPerMatch: all.matches ? all.swaps / all.matches : 0,
    forcedPer100: all.matches ? (all.forced * 100) / all.matches : 0,
    emergencyPer100: all.matches ? (all.emergency * 100) / all.matches : 0,
    windedShare: all.starts ? all.winded / all.starts : 0,
    tiredShare: all.starts ? all.tired / all.starts : 0,
    spentShare: all.starts ? all.spent / all.starts : 0,
    roundsPerMatch: all.matches ? all.rounds / all.matches : 0,
    timeCapShare,
    flags,
  };
}

function wilsonCi(wins: number, n: number): { low: number; high: number } {
  if (n === 0) return { low: 0, high: 1 };
  const z = 1.96;
  const p = wins / n;
  const denom = 1 + (z * z) / n;
  const center = (p + (z * z) / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
  return { low: center - half, high: center + half };
}
