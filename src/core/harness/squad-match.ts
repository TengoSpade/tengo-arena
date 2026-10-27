/**
 * Balance mode `squad-match` (combat-skills.md §8 mode 5; wired by the M1.1
 * integrator, WP-C): full matches through core/game's orchestrator
 * (`playMatchAuto`) with the real modules: 7-fighter squads chosen by the AI
 * rule, starting Freshness drawn 50-100, lifecycle drain and immediate
 * injuries, auto-swap policies paired against `off` on the same squads,
 * Freshness and seeds (counterfactual pairs, sides mirrored), best-of-3 and
 * every fourth matchup best-of-5. Reserve value: threshold 40 with 2
 * reserves against the same club with none.
 */
import type { ContentDB } from '../content';
import { createGameEngine, playMatchAuto, realGamePorts, type GamePorts, type LockedSquads } from '../game';
import { asId, type AutoSwapRules, type ClubId, type Fixture, type FixtureId, type GameState, type MatchResult, type MatchSquad, type StartingRow } from '../model';
import { Rng, STREAM, type Seed } from '../rng';
import { cloneJson } from '../util';

export type SquadPolicy = 'off' | 'injured_only' | 'threshold40' | 'threshold60';

export interface SquadMatchRow {
  /** The policy side (the other side plays `off`); 'reserves2v0': threshold 40 with 2 reserves against 0. */
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
  tiredShare: number;
  spentShare: number;
  roundsPerMatch: number;
  timeCapShare: number;
  flags: string[];
}

/** combat-skills.md §8 squad-match targets (PROPOSED · TUNABLE). */
export const SQUAD_MATCH_TARGETS = {
  policyVsOffMax: 0.56,
  threshold40VsOff: { min: 0.51, max: 0.55 },
  comebackDeltaPts: { min: -3, max: 5 },
  reserveValue: { min: 0.52, max: 0.58 },
  swapsPerMatch: { min: 0.6, max: 1.4 },
  timeCapMax: 0.02,
} as const;

const POLICIES: readonly SquadPolicy[] = ['off', 'injured_only', 'threshold40', 'threshold60'];

function rulesFor(content: ContentDB, policy: SquadPolicy): AutoSwapRules {
  const d = content.combat.match.autoSwapDefaults;
  const base: AutoSwapRules = { ...d, lostRoundBonus: 0 };
  if (policy === 'off') return { ...base, mode: 'off' };
  if (policy === 'injured_only') return { ...base, mode: 'injured_only' };
  return { ...base, mode: 'threshold', freshnessBelow: policy === 'threshold40' ? 40 : 60 };
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
  matches: number;
  wins: number;
  lostR1: number;
  comebacks: number;
  swaps: number;
}

const tally = (): Tally => ({ matches: 0, wins: 0, lostR1: 0, comebacks: 0, swaps: 0 });

export function runSquadMatch(options: { seed: Seed; fights: number; content: ContentDB; ports?: GamePorts }): SquadMatchReport {
  const { seed, content } = options;
  const ports = options.ports ?? realGamePorts;
  const engine = createGameEngine(ports);
  const w = engine.createWorld(content, { rootSeed: seed });
  if (!w.ok) throw new Error(`squad-match: ${w.error.message}`);
  const world = w.value;
  const clubs = Object.keys(world.clubs).sort() as ClubId[];
  const rowIds: SquadMatchRow['id'][] = [...POLICIES, 'reserves2v0'];
  const matchups = Math.max(1, Math.floor(options.fights / (rowIds.length * 2)));
  const tallies = new Map<string, Tally>(rowIds.map((id) => [id, tally()]));
  const offTallies = new Map<string, Tally>(rowIds.map((id) => [id, tally()]));
  const all = { matches: 0, swaps: 0, forced: 0, emergency: 0, starts: 0, tired: 0, spent: 0, rounds: 0, capped: 0 };

  const record = (r: MatchResult, policySide: 'home' | 'away', t: Tally): void => {
    t.matches++;
    const won = (policySide === 'home' ? r.homeClubId : r.awayClubId) === r.winnerClubId;
    if (won) t.wins++;
    if (r.rounds[0]!.winner !== policySide) {
      t.lostR1++;
      if (won) t.comebacks++;
    }
    for (const b of r.betweenRounds ?? []) t.swaps += b[policySide].length;
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
        if (f < 40) all.spent++;
        else if (f < 60) all.tired++;
      }
    }
  };

  for (let j = 0; j < matchups; j++) {
    const rng = Rng.create(seed, STREAM.balance, 'squad-match', j);
    const a = clubs[rng.int(0, clubs.length - 1)]!;
    let b = clubs[rng.int(0, clubs.length - 2)]!;
    if (b === a) b = clubs[clubs.length - 1]!;
    const fresh = new Map<string, number>();
    for (const f of Object.values(world.fighters)) if (f.clubId === a || f.clubId === b) fresh.set(f.id, rng.int(500, 1000));
    const bestOf = j % 4 === 3 ? 5 : 3;
    for (const id of rowIds) {
      for (const policySide of ['home', 'away'] as const) {
        for (const counterfactual of [false, true]) {
          // The policy club is `a`; mirrored: it plays home, then away. The counterfactual plays `off` on the same matchup.
          const home = policySide === 'home' ? a : b;
          const away = policySide === 'home' ? b : a;
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
          const policy: SquadPolicy = counterfactual ? 'off' : id === 'reserves2v0' ? 'threshold40' : id;
          s.clubs[a]!.autoSwap = rulesFor(content, policy);
          s.clubs[b]!.autoSwap = rulesFor(content, id === 'reserves2v0' && !counterfactual ? 'threshold40' : 'off');
          const reservesA = true;
          const reservesB = id !== 'reserves2v0' || counterfactual;
          const squads: LockedSquads = {
            home: squadOf(ports, s, home, home === a ? reservesA : reservesB, content),
            away: squadOf(ports, s, away, away === a ? reservesA : reservesB, content),
          };
          const result = playMatchAuto(ports, s, fixture, squads, content);
          record(result, policySide, (counterfactual ? offTallies : tallies).get(id)!);
        }
      }
    }
  }

  const flags: string[] = [];
  const T = SQUAD_MATCH_TARGETS;
  const rows: SquadMatchRow[] = rowIds.map((id) => {
    const t = tallies.get(id)!;
    const o = offTallies.get(id)!;
    const winRate = t.matches ? t.wins / t.matches : 0;
    const target = id === 'reserves2v0' ? T.reserveValue : id === 'threshold40' ? T.threshold40VsOff : id === 'off' ? null : { min: 0, max: T.policyVsOffMax };
    const comebackRate = t.lostR1 ? t.comebacks / t.lostR1 : null;
    const offComebackRate = o.lostR1 ? o.comebacks / o.lostR1 : null;
    const inTarget = target === null || (winRate >= target.min && winRate <= target.max);
    if (!inTarget) flags.push(`${id}: wins ${(winRate * 100).toFixed(1)}% (target ${target!.min * 100}-${target!.max * 100}%)`);
    if (id !== 'off' && id !== 'reserves2v0' && comebackRate !== null && offComebackRate !== null) {
      const d = (comebackRate - offComebackRate) * 100;
      if (d < T.comebackDeltaPts.min || d > T.comebackDeltaPts.max) flags.push(`${id}: comeback ${d.toFixed(1)} points against off (target ${T.comebackDeltaPts.min} to +${T.comebackDeltaPts.max})`);
    }
    return { id, matches: t.matches, winRate, ci: wilsonCi(t.wins, t.matches), comebackRate, offComebackRate, swapsPerMatch: t.matches ? t.swaps / t.matches : 0, target, inTarget };
  });
  const thresholdSwaps = rows.filter((r) => r.id === 'threshold40' || r.id === 'threshold60');
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
