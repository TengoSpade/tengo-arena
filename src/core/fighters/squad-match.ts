/**
 * Test tooling (not exported from index.ts): an abstract M1.1 match between
 * two clubs that drives the real lifecycle hooks round by round, standing in
 * for combat's orchestrator (WP-C) in the population harness.
 *
 *   squad      AI rotation at the lock (levels.json aiRotation): best five by rating (with
 *              economy.json ai.youthMinutes), tired starters rested, a Spent floor, two reserves;
 *   rounds     win chance from the active fives' rating gap less a Freshness penalty
 *              (levels.json simAssumptions.tiredRatingPenalty × combat's penalty share);
 *              downed 30% for winners and 85% for losers; damage and duration drawn uniformly;
 *              hooks freshnessAfterRound -> xpAfterRound -> injuriesAfterRound after each round;
 *   between    forced injury replacement (a reserve, else an emergency entrant), threshold swaps
 *              (levels.json aiSubstitution by personality, +lostRoundThresholdBonus for the loser,
 *              reserve margin, rating gap, keepOneForInjury), then freshnessBetweenRounds;
 *   end        a MatchResult with squads and round lineups, then matchEndProgression.
 * Randomness of the stand-ins comes from STREAM.soak; the lifecycle draws its own streams.
 */
import type { ContentDB } from '../content';
import {
  clubRoster,
  idNumber,
  type Club,
  type ClubId,
  type Fighter,
  type FighterId,
  type FighterMatchStats,
  type FightFighterInput,
  type FixtureId,
  type GameState,
  type MatchResult,
  type MatchSideState,
  type MatchState,
  type RoundAftermath,
  type RoundLineups,
  type RoundResult,
  type RoundSideLineup,
  type StartingRow,
  type TacticsPresetId,
  type WeekId,
} from '../model';
import { Rng, STREAM } from '../rng';
import { isFitFighter, lineupCaptainOf } from './captaincy';
import { roundN } from './fixed';
import { freshnessOf } from './levels';
import { maxHpOf } from './match';
import { freshnessAfterRound, freshnessBetweenRounds, injuriesAfterRound, matchEndProgression, typicalRoundDrain10, xpAfterRound, type MatchProgressionOutcome } from './progression';
import { effectiveStatsOf, fighterHumanAge100, potentialOf, ratingOf } from './stats';
import { lockLineup } from './weekly';

export interface SquadMatchReport {
  result: MatchResult;
  progression: MatchProgressionOutcome;
  injured: FighterId[];
  /** Fighter-rounds started per fighter (for injury rates). */
  roundStarts: Map<FighterId, number>;
  swaps: number;
}

function byRating(content: ContentDB): (a: Fighter, b: Fighter) => number {
  return (a, b) => ratingOf(b, content) - ratingOf(a, content) || idNumber(a.id) - idNumber(b.id) || (a.id < b.id ? -1 : 1);
}

function row(f: Fighter, content: ContentDB): StartingRow {
  return content.classes.require(f.classId).startingRow as StartingRow;
}

/** AI squad at the lock (levels.json aiRotation; youth minutes for the fifth slot). */
export function pickSquad(state: GameState, club: Club, content: ContentDB): void {
  const rot = content.levels.aiRotation;
  const threshold10 = content.levels.freshness.threshold * 10;
  const fit = clubRoster(state, club.id).filter(isFitFighter).slice().sort(byRating(content));
  const five = fit.slice(0, 5);
  const ym = content.economy.ai.youthMinutes;
  const fifth = five[4];
  if (fifth) {
    const prospect = fit.slice(5).find(
      (f) =>
        fighterHumanAge100(f, content) <= ym.maxHumanAge * 100 &&
        potentialOf(f, content) - ratingOf(f, content) >= ym.minPotentialGap &&
        ratingOf(fifth, content) - ratingOf(f, content) <= ym.maxRatingBelowFifthStarter,
    );
    if (prospect) five[4] = prospect;
  }
  const bench = (): Fighter[] => fit.filter((f) => !five.includes(f));
  // 1. Projected rest: a starter who would start round 2 Tired, replaced by a rested fighter within the rating gap.
  let rests = 0;
  const tiredFirst = five.slice().sort((a, b) => a.freshness10 - b.freshness10 || idNumber(a.id) - idNumber(b.id));
  for (const s of tiredFirst) {
    if (rests >= rot.maxRestsPerMatch) break;
    if (s.freshness10 >= threshold10 + typicalRoundDrain10(s, content)) continue;
    const below = Math.max(0, content.levels.freshness.threshold - freshnessOf(s));
    const minRating = ratingOf(s, content) - (rot.leagueMaxRatingGap + rot.extraGapPerPointBelow * below);
    const sub = bench().find((f) => f.freshness10 >= threshold10 && ratingOf(f, content) >= minRating);
    if (!sub) continue;
    five[five.indexOf(s)] = sub;
    rests++;
  }
  // 2. Spent floor.
  for (const s of five.slice()) {
    if (freshnessOf(s) >= rot.spentFloorAtLock) continue;
    const sub = bench().find((f) => freshnessOf(f) >= rot.spentFloorAltMin);
    if (sub) five[five.indexOf(s)] = sub;
  }
  // 3. Reserves: the two best remaining with Freshness >= threshold, one front and one back row when available.
  const rested = bench().filter((f) => f.freshness10 >= threshold10);
  const front = rested.find((f) => row(f, content) === 'front');
  const back = rested.find((f) => row(f, content) === 'back');
  const reserves: Fighter[] = [];
  for (const r of [front, back]) if (r && !reserves.includes(r)) reserves.push(r);
  for (const r of rested) if (reserves.length < 2 && !reserves.includes(r)) reserves.push(r);
  club.lineup.fighters = five.map((f) => ({ fighterId: f.id, row: row(f, content) }));
  club.lineup.reserves = reserves.map((f) => f.id);
}

function fightInput(state: GameState, clubId: ClubId, f: Fighter, slot: number, content: ContentDB, cq: number): FightFighterInput {
  return {
    fighterId: f.id,
    classId: f.classId,
    raceId: f.raceId,
    row: row(f, content),
    slot,
    stats: effectiveStatsOf(f, content),
    captainQuality: cq,
    traitIds: f.traits.map((t) => t.id),
    tactics: state.clubs[clubId]?.lineup.tactics[f.id] ?? { kind: 'preset', presetId: content.classes.require(f.classId).defaultPresetId as TacticsPresetId },
    rating: ratingOf(f, content),
  };
}

function emptyStats(clubId: ClubId): FighterMatchStats {
  return {
    clubId,
    roundsPlayed: 0,
    roundsSurvived: 0,
    ticksOnArena: 0,
    damageDealt: 0,
    damageToShields: 0,
    damageTaken: 0,
    healingDone: 0,
    shieldingDone: 0,
    overheal: 0,
    ccAppliedTicks: 0,
    ccReceivedTicks: 0,
    downsInflicted: 0,
    downsSuffered: 0,
    assists: 0,
    focusSpent: 0,
    casts: {},
    ruleFires: [],
    ruleCommittedTicks: [],
    rulesNeverFired: [],
    downs: [],
    opponentIds: [],
  };
}

function sideState(state: GameState, club: Club): MatchSideState {
  const starters = club.lineup.fighters.map((e) => e.fighterId);
  const rows: Record<FighterId, StartingRow> = {};
  for (const e of club.lineup.fighters) rows[e.fighterId] = e.row;
  return {
    clubId: club.id,
    squad: { starters, reserves: [...club.lineup.reserves], rows, captainId: club.captainId, viceCaptainId: club.viceCaptainId },
    active: [...starters],
    rows: club.lineup.fighters.map((e) => e.row),
    withdrawn: [],
    unusedReserves: [...club.lineup.reserves],
    swapsUsed: 0,
    injured: [],
    emergencyEntrants: [],
    actingCaptainId: club.captainId,
    entering: [],
  };
  void state;
}

/** Combat's penalty share (combat.json freshness.tiers): the tier's rank among the penalty tiers, 0 (no penalty) to 1 (the last tier). */
function penaltyShare(f: Fighter, content: ContentDB): number {
  const tiers = [...content.combat.freshness.tiers].sort((x, y) => y.minFreshness - x.minFreshness);
  const v = freshnessOf(f);
  const i = tiers.findIndex((t) => v >= t.minFreshness);
  return (i === -1 ? tiers.length - 1 : i) / Math.max(1, tiers.length - 1);
}

function sideRating(state: GameState, ids: readonly FighterId[], content: ContentDB): number {
  if (ids.length === 0) return 0;
  const raw = content.levels.simAssumptions['tiredRatingPenalty'];
  const pen = typeof raw === 'number' ? raw : 0;
  let sum = 0;
  for (const id of ids) {
    const f = state.fighters[id]!;
    sum += ratingOf(f, content) - pen * penaltyShare(f, content);
  }
  return sum / ids.length;
}

function lineupOf(state: GameState, side: MatchSideState, content: ContentDB, entered: Set<string>): RoundSideLineup {
  return {
    fighterIds: [...side.active],
    rows: [...side.rows],
    captainIndex: 0,
    viceCaptainIndex: null,
    captainQuality: 50,
    freshness: side.active.map((id) => freshnessOf(state.fighters[id]!)),
    entered: side.active.map((id) => entered.has(id)),
  };
  void content;
}

/** Best-fit emergency entrant: a fit roster fighter outside the squad, never withdrawn or injured (higher rating, then Freshness, then id). */
function emergencyEntrant(state: GameState, side: MatchSideState, content: ContentDB): FighterId | null {
  const used = new Set<string>([...side.squad.starters, ...side.squad.reserves, ...side.emergencyEntrants, ...side.withdrawn, ...side.injured]);
  const c = clubRoster(state, side.clubId)
    .filter((f) => !used.has(f.id) && isFitFighter(f))
    .slice()
    .sort((a, b) => ratingOf(b, content) - ratingOf(a, content) || b.freshness10 - a.freshness10 || idNumber(a.id) - idNumber(b.id));
  return c[0]?.id ?? null;
}

/** Between-round step for one side (auto-swap procedure). */
function betweenRounds(state: GameState, side: MatchSideState, lostRound: boolean, lastStep: boolean, personality: string, content: ContentDB, entered: Set<string>): number {
  const sub = content.levels.aiSubstitution;
  const maxSwaps = content.levels.matchSquad.maxSwapsPerMatch;
  let swaps = 0;
  const swapIn = (out: FighterId, inn: FighterId, costs: boolean): void => {
    const i = side.active.indexOf(out);
    side.active[i] = inn;
    side.withdrawn.push(out);
    side.unusedReserves = side.unusedReserves.filter((x) => x !== inn);
    if (costs) side.swapsUsed += 1;
    entered.add(inn);
    swaps++;
  };
  // 1. Forced injury replacement.
  for (const out of side.active.filter((id) => side.injured.includes(id))) {
    const reserve = side.unusedReserves.find((id) => isFitFighter(state.fighters[id]!));
    if (reserve && side.swapsUsed < maxSwaps) swapIn(out, reserve, true);
    else {
      const e = emergencyEntrant(state, side, content);
      if (e) {
        side.emergencyEntrants.push(e);
        swapIn(out, e, false);
      } else {
        side.active = side.active.filter((id) => id !== out); // no fit fighter at all (hired blade in the real game)
      }
    }
  }
  // 2. Threshold swaps, lowest first; 3. keepOneForInjury.
  const below = (sub.freshnessBelowByPersonality[personality] ?? sub.freshnessBelow) + (lostRound ? sub.lostRoundThresholdBonus : 0);
  const tired = side.active
    .filter((id) => freshnessOf(state.fighters[id]!) < below)
    .sort((a, b) => state.fighters[a]!.freshness10 - state.fighters[b]!.freshness10 || idNumber(a) - idNumber(b));
  for (const out of tired) {
    const left = maxSwaps - side.swapsUsed;
    if (left <= 0) break;
    if (sub.keepOneForInjury && left === 1 && !lastStep) break;
    const f = state.fighters[out]!;
    const reserve = side.unusedReserves.find((id) => {
      const r = state.fighters[id]!;
      return isFitFighter(r) && freshnessOf(r) >= freshnessOf(f) + sub.reserveMargin && ratingOf(r, content) >= ratingOf(f, content) - sub.maxRatingGap;
    });
    if (reserve) swapIn(out, reserve, true);
  }
  return swaps;
}

/** Play an abstract match between two clubs through the lifecycle hooks; returns the result and the progression outcome. */
export function playSquadMatch(state: GameState, home: Club, away: Club, fixtureId: FixtureId, content: ContentDB): SquadMatchReport {
  pickSquad(state, home, content);
  pickSquad(state, away, content);
  lockLineup(state, home.id, content);
  lockLineup(state, away.id, content);
  const rng = Rng.create(state.rng.root, STREAM.soak, 'squad-match', fixtureId);
  const h = sideState(state, home);
  const a = sideState(state, away);
  const inputsById: Record<FighterId, FightFighterInput> = {};
  const capOf = (club: Club) => lineupCaptainOf(state, club.id, club.lineup.fighters.map((e) => e.fighterId), content);
  const hc = capOf(home);
  const ac = capOf(away);
  for (const [club, side, cap] of [[home, h, hc], [away, a, ac]] as const) {
    const ids = [...side.squad.starters, ...side.squad.reserves];
    ids.forEach((id, slot) => {
      inputsById[id] = fightInput(state, club.id, state.fighters[id]!, slot, content, cap && cap.fighterId === id ? cap.cqForFight : 50);
    });
  }
  const sideInput = (club: Club, side: MatchSideState) => ({
    clubId: club.id,
    fighters: side.squad.starters.map((id) => inputsById[id]!),
    captainIndex: 0,
    viceCaptainIndex: null,
    chemistry: 0,
  });
  const ms: MatchState = {
    fixtureId,
    seed: 'synthetic',
    bestOf: 3,
    phase: 'round_pending',
    score: { home: 0, away: 0 },
    rounds: [],
    roundLineups: [],
    betweenRounds: [],
    home: h,
    away: a,
    input: { seed: 'synthetic', bestOf: 3, home: sideInput(home, h), away: sideInput(away, a) },
    inputsById,
    fighterStats: {},
    hiredBladeIds: [],
    playerDecisions: null,
  };
  const stats: Record<FighterId, FighterMatchStats> = {};
  const roundStarts = new Map<FighterId, number>();
  const injured: FighterId[] = [];
  let swaps = 0;
  const entered = new Set<string>();
  const need = Math.floor(ms.bestOf / 2) + 1;
  for (let r = 1; ms.score.home < need && ms.score.away < need; r++) {
    const rl: RoundLineups = { round: r, home: lineupOf(state, h, content, entered), away: lineupOf(state, a, content, entered) };
    entered.clear();
    ms.roundLineups.push(rl);
    const gap = sideRating(state, h.active, content) - sideRating(state, a.active, content);
    const pHome = Math.max(1_000, Math.min(9_000, roundN(5_000 + 300 * gap)));
    const homeWins = rng.chanceBp(pHome);
    const winner = homeWins ? 'home' : 'away';
    const durationS = rng.int(20, 45);
    const aftermath: RoundAftermath[] = [];
    const credits = new Map<string, number>();
    const downs = { home: 0, away: 0 };
    for (const [sideName, side, opp] of [['home', h, a], ['away', a, h]] as const) {
      const won = sideName === winner;
      for (const id of side.active) {
        const f = state.fighters[id]!;
        const hp = maxHpOf(inputsById[id] ?? fightInput(state, side.clubId, f, 0, content, 50), content);
        const downed = rng.chanceBp(won ? 3_000 : 8_500);
        const dmg = Math.trunc((hp * (downed ? rng.int(10_000, 16_000) : rng.int(2_000, 9_000))) / 10_000);
        const by = downed && opp.active.length > 0 ? rng.pick(opp.active) : null;
        if (by) credits.set(by, (credits.get(by) ?? 0) + 1);
        if (downed) downs[sideName]++;
        aftermath.push({
          fighterId: id,
          side: sideName,
          damageTaken: dmg,
          maxHp: hp,
          downed,
          largestHit: Math.trunc(dmg / 3),
          downCause: downed ? { round: r, tick: 0, byFighterId: by, abilityId: null, hit: 0, overkill: 0, damageTakenRound: dmg, maxHp: hp } : null,
          downsInflicted: 0,
        });
        const s = (stats[id] ??= emptyStats(side.clubId));
        s.roundsPlayed += 1;
        s.damageTaken += dmg;
        if (downed) {
          s.downsSuffered += 1;
          s.downs.push({ round: r, tick: 0, byFighterId: by, abilityId: null, hit: 0, overkill: 0, damageTakenRound: dmg, maxHp: hp });
        } else s.roundsSurvived += 1;
        roundStarts.set(id, (roundStarts.get(id) ?? 0) + 1);
      }
    }
    for (const x of aftermath) {
      x.downsInflicted = credits.get(x.fighterId) ?? 0;
      stats[x.fighterId]!.downsInflicted += x.downsInflicted;
    }
    const result: RoundResult = {
      round: r,
      seed: 'synthetic',
      winner,
      endReason: 'elimination',
      tiebreakStep: null,
      durationTicks: durationS * 20,
      survivors: { home: 0, away: 0 },
      downs,
      finalHp: [],
      checksum: '0',
      eventHash: null,
    };
    ms.rounds.push(result);
    if (homeWins) ms.score.home++;
    else ms.score.away++;
    const outcome = { result, aftermath };
    freshnessAfterRound(state, ms, outcome, content);
    xpAfterRound(state, ms, outcome, content);
    const hurt = injuriesAfterRound(state, ms, outcome, content);
    for (const id of hurt) {
      injured.push(id);
      (h.active.includes(id) ? h : a).injured.push(id);
    }
    if (ms.score.home >= need || ms.score.away >= need) break;
    const lastStep = ms.score.home === need - 1 && ms.score.away === need - 1;
    swaps += betweenRounds(state, h, winner !== 'home', lastStep, home.aiPersonalityId, content, entered);
    swaps += betweenRounds(state, a, winner !== 'away', lastStep, away.aiPersonalityId, content, entered);
    freshnessBetweenRounds(state, ms, content);
  }
  const weekId = (state.calendar.weekId ?? 'MW1') as WeekId;
  const result: MatchResult = {
    fixtureId,
    competitionId: `lg:${state.calendar.season}:${home.tierId}` as MatchResult['competitionId'],
    stage: 'league',
    season: state.calendar.season,
    weekIndex: state.calendar.weekIndex,
    weekId,
    homeClubId: home.id,
    awayClubId: away.id,
    engineVersion: 0,
    contentHash: 'synthetic',
    input: ms.input,
    rounds: ms.rounds,
    score: { ...ms.score },
    winnerClubId: ms.score.home > ms.score.away ? home.id : away.id,
    fighterStats: stats,
    mvpFighterId: null,
    hiredBladeIds: [],
    squads: { home: h.squad, away: a.squad },
    roundLineups: ms.roundLineups,
    betweenRounds: [],
    emergencyEntrants: [...h.emergencyEntrants, ...a.emergencyEntrants],
  };
  const progression = matchEndProgression(state, result, content);
  return { result, progression, injured, roundStarts, swaps };
}
