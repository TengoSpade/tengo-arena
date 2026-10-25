/**
 * Seeded multi-season population harness for the lifecycle (05 §9.2 WP2
 * acceptance; 03 §8.3 soak targets). Test tooling only: it is not exported
 * from index.ts and plays the parts of other modules with deliberately
 * crude stand-ins (a static 3-tier league, "best five" lineups, AI captains
 * per D-I, contracts of 1-3 seasons renewed for the top of the roster, a
 * free-agent pool where the unsigned leave after two season ends). With
 * `matches` on, fights are abstract (round win chance from the lineup rating
 * gap; downed 30% for winners and 85% for losers; damage drawn uniformly),
 * like the lifecycle designer's scratch model, so the real fighters
 * pipeline (XP, injuries, development) runs on synthetic MatchResults.
 * Randomness of the stand-ins comes from STREAM.soak.
 */
import type { ContentDB } from '../content';
import {
  setMembership,
  createEmptyGameState,
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
  type RegionId,
  type RoundResult,

  type TacticsPresetId,
  type TierId,
  type WeekId,
} from '../model';
import { Rng, STREAM } from '../rng';
import { captaincyBreakdown, isFitFighter, lineupCaptainOf, topFiveMean } from './captaincy';
import { BP, bp, roundN } from './fixed';
import { createFighterOn } from './generation';
import { isCareerEnded } from './captaincy';
import { applyMatch, maxHpOf } from './match';
import {
  announceFinalSeasonsOn,
  generateRookiesOn,
  offseasonRecoveryOn,
  seasonEndDevelopmentOn,
  seasonEndRetirementsOn,
} from './season';
import { effectiveStatsOf, fighterHumanAge100, potentialOf, ratingOf } from './stats';
import { tables } from './tables';
import { rolledPolarity } from './traits';
import { lockLineup, weekly } from './weekly';

export interface PopulationOptions {
  seed: string;
  seasons: number;
  content: ContentDB;
  /** Synthetic matches every regular matchweek (default false: usage stays at the floor). */
  matches?: boolean;
  trainingEmphasis?: boolean;
}

export interface SeasonSample {
  season: number;
  population: number;
  rostered: number;
  freeAgents: number;
  medianHumanAge: number;
  shareAtMost22: number;
  shareAtLeast31: number;
  leagueMeanRating: number;
  topFiveMean: number;
  maxRating: number;
  retirements: number;
  rookies: number;
  leavers: number;
  captainMeanCq: number;
  captainShareA: number;
  captainShareBelow40: number;
}

export interface PopulationReport {
  samples: SeasonSample[];
  injuries: Record<string, { injuries: number; rounds: number }>;
  severities: Record<string, number>;
  careerEndings: number;
  scars: number;
  rolled: { positive: number; negative: number; fighters: number };
  retirementAges: Record<string, number[]>;
  /** peakRating ÷ potential of retired fighters with ≥ 200 career rounds. */
  starterPeakOverPotential: number[];
  finalState: GameState;
}

function byId<T extends { id: string }>(a: T, b: T): number {
  return idNumber(a.id) - idNumber(b.id) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = values.slice().sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

function makeClub(content: ContentDB, t: ContentDB['clubs']['list'][number]): Club {
  const tier = content.tierByLevel(t.startTierLevel);
  return {
    id: t.id as ClubId,
    name: t.name,
    shortName: t.shortName,
    code: t.code,
    colors: { ...t.colors },
    regionId: t.regionId as RegionId,
    districtId: t.districtId as Club['districtId'],
    tierId: tier.id as TierId,
    wingId: null,
    aiPersonalityId: t.aiPersonality as Club['aiPersonalityId'],
    tacticsStyle: t.tacticsStyle,
    prestige: t.startPrestige,
    finance: { balance: 0, seasonBudget: 0, wageBudgetPerWeek: 0, status: 'healthy', debtWeeks: 0, registryDebt: 0, parachuteSeasonsLeft: 0, ascensionSeasonsLeft: 0 },
    captainId: null,
    viceCaptainId: null,
    captainAtLastLock: null,
    captainSince: null,
    captainNotFieldedStreak: 0,
    statuses: [],
    lineup: { fighters: [], matchCaptainId: null, tactics: {} },
    shortlist: [],
    history: [],
  };
}

function rosterOf(state: GameState, clubId: ClubId): Fighter[] {
  return Object.values(state.fighters)
    .filter((f) => f.clubId === clubId && f.status === 'active')
    .sort(byId);
}

function capOf(content: ContentDB, club: Club): number {
  return content.tiers.require(club.tierId).rosterCap;
}

function sign(state: GameState, f: Fighter, club: Club, rng: Rng): void {
  setMembership(state, f, club.id, 'active');
  f.freeAgency = null;
  const season = state.calendar.season;
  f.contract = {
    clubId: club.id,
    wagePerWeek: 0,
    startSeason: season,
    endSeason: season + rng.int(0, 2),
    signedAt: { season, weekIndex: state.calendar.weekIndex },
    dropClauseApplied: false,
    next: null,
  };
}

function release(state: GameState, f: Fighter): void {
  f.freeAgency = { unsignedSeasonEnds: 0, formerClubId: f.clubId, releasedByClubId: null, releasedSeason: null, enteredAt: { season: state.calendar.season, weekIndex: state.calendar.weekIndex } };
  setMembership(state, f, null, 'free-agent');
  f.contract = null;
  f.career.matchweeksAtClub = 0;
}

/** Fill every roster to its target (90% of cap at world generation, the cap later) with the best free agents. */
function fillRosters(state: GameState, content: ContentDB, fill: number): void {
  const rng = Rng.create(state.rng.root, STREAM.soak, 'fill', state.calendar.season);
  const clubs = Object.values(state.clubs).sort((a, b) => content.tiers.require(a.tierId).level - content.tiers.require(b.tierId).level || (a.id < b.id ? -1 : 1));
  const pool = Object.values(state.fighters)
    .filter((f) => f.status === 'free-agent')
    .map((f) => ({ f, value: ratingOf(f, content) + Math.trunc(potentialOf(f, content) / 2) }))
    .sort((a, b) => b.value - a.value || byId(a.f, b.f));
  let next = 0;
  // Round-robin by tier order so the best free agents go up the pyramid first.
  for (const club of clubs) {
    const target = Math.floor(capOf(content, club) * fill);
    let have = rosterOf(state, club.id).length;
    while (have < target && next < pool.length) {
      sign(state, pool[next]!.f, club, rng);
      next++;
      have++;
    }
  }
}

function setAiCaptains(state: GameState, content: ContentDB, seasonStart: boolean): void {
  const hysteresis = content.economy.ai.captainHysteresis;
  for (const club of Object.values(state.clubs).sort((a, b) => (a.id < b.id ? -1 : 1))) {
    const mean = topFiveMean(state, club.id, content);
    const starters = rosterOf(state, club.id)
      .filter(isFitFighter)
      .map((f) => ({ f, rating: ratingOf(f, content) }))
      .sort((a, b) => b.rating - a.rating || byId(a.f, b.f))
      .slice(0, 5)
      .map((x) => ({ f: x.f, cq: captaincyBreakdown(x.f, content, mean).cq }))
      .sort((a, b) => b.cq - a.cq || b.f.career.matchweeksAtClub - a.f.career.matchweeksAtClub || byId(a.f, b.f));
    const best = starters[0];
    const current = club.captainId ? state.fighters[club.captainId] : undefined;
    const currentOk = current && current.clubId === club.id && current.status === 'active' && !isCareerEnded(current);
    const injuredLong = currentOk && current.injury !== null && current.injury.weeksOut >= 4;
    if (seasonStart) {
      if (best && (!currentOk || best.cq >= captaincyBreakdown(current, content, mean).cq + hysteresis)) club.captainId = best.f.id;
      if (!currentOk && !best) club.captainId = null;
    } else if (injuredLong && best && best.f.id !== club.captainId) {
      club.captainId = best.f.id;
    }
    const vice = starters.find((s) => s.f.id !== club.captainId);
    club.viceCaptainId = vice ? vice.f.id : null;
  }
}

/** "Best five", with economy.json ai.youthMinutes: a young prospect close to the 5th starter takes the 5th slot. */
function pickLineup(state: GameState, club: Club, content: ContentDB): void {
  const ranked = rosterOf(state, club.id)
    .filter(isFitFighter)
    .map((f) => ({ f, rating: ratingOf(f, content) }))
    .sort((a, b) => b.rating - a.rating || byId(a.f, b.f));
  const fit = ranked.slice(0, 5);
  const ym = content.economy.ai.youthMinutes;
  const fifth = fit[4];
  if (fifth) {
    const prospect = ranked
      .slice(5)
      .find(
        (x) =>
          fighterHumanAge100(x.f, content) <= ym.maxHumanAge * 100 &&
          potentialOf(x.f, content) - x.rating >= ym.minPotentialGap &&
          fifth.rating - x.rating <= ym.maxRatingBelowFifthStarter,
      );
    if (prospect) fit[4] = prospect;
  }
  club.lineup.fighters = fit.map((x) => ({ fighterId: x.f.id, row: content.classes.require(x.f.classId).startingRow }));
}

function sideInput(state: GameState, club: Club, content: ContentDB): { fighters: FightFighterInput[]; captainIndex: number; viceCaptainIndex: number | null } {
  const ids = club.lineup.fighters.map((e) => e.fighterId);
  const cap = lineupCaptainOf(state, club.id, ids, content);
  const fighters = club.lineup.fighters.map((e, slot) => {
    const f = state.fighters[e.fighterId]!;
    const k = content.classes.require(f.classId);
    return {
      fighterId: f.id,
      classId: f.classId,
      raceId: f.raceId,
      row: e.row,
      slot,
      stats: effectiveStatsOf(f, content),
      captainQuality: cap && cap.fighterId === f.id ? cap.cqForFight : 50,
      traitIds: f.traits.map((t) => t.id),
      tactics: { kind: 'preset' as const, presetId: k.defaultPresetId as TacticsPresetId },
      rating: ratingOf(f, content),
    };
  });
  return { fighters, captainIndex: cap?.index ?? 0, viceCaptainIndex: cap?.viceIndex ?? null };
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

/** An abstract match result (scratch model): round win chance from the lineup rating gap. */
export function syntheticMatch(state: GameState, home: Club, away: Club, fixtureId: FixtureId, content: ContentDB): MatchResult {
  const rng = Rng.create(state.rng.root, STREAM.soak, 'match', fixtureId);
  const h = sideInput(state, home, content);
  const a = sideInput(state, away, content);
  const mean = (s: FightFighterInput[]): number => (s.length ? s.reduce((x, f) => x + f.rating, 0) / s.length : 0);
  const pHome = Math.max(1_000, Math.min(9_000, roundN(5_000 + 300 * (mean(h.fighters) - mean(a.fighters)))));
  const stats: Record<FighterId, FighterMatchStats> = {};
  for (const f of h.fighters) stats[f.fighterId] = emptyStats(home.id);
  for (const f of a.fighters) stats[f.fighterId] = emptyStats(away.id);
  const rounds: RoundResult[] = [];
  let hw = 0;
  let aw = 0;
  const maxHp = new Map<string, number>();
  for (const f of [...h.fighters, ...a.fighters]) maxHp.set(f.fighterId, maxHpOf(f, content));
  for (let r = 1; hw < 2 && aw < 2; r++) {
    const homeWins = rng.chanceBp(pHome);
    if (homeWins) hw++;
    else aw++;
    const winners = homeWins ? h.fighters : a.fighters;
    const losers = homeWins ? a.fighters : h.fighters;
    const downs = { home: 0, away: 0 };
    for (const [side, list] of [['w', winners], ['l', losers]] as const) {
      for (const f of list) {
        const s = stats[f.fighterId]!;
        s.roundsPlayed += 1;
        const hp = maxHp.get(f.fighterId) ?? 1000;
        const downed = rng.chanceBp(side === 'w' ? 3_000 : 8_500);
        const ratio = downed ? rng.int(10_000, 16_000) : rng.int(2_000, 9_000);
        const dmg = Math.trunc((hp * ratio) / BP);
        s.damageTaken += dmg;
        if (downed) {
          const others = side === 'w' ? losers : winners;
          const by = others.length ? rng.pick(others).fighterId : null;
          s.downsSuffered += 1;
          if (by) stats[by]!.downsInflicted += 1;
          s.downs.push({ round: r, tick: 0, byFighterId: by, abilityId: null, hit: 0, overkill: 0, damageTakenRound: dmg, maxHp: hp });
          if (list === h.fighters) downs.home++;
          else downs.away++;
        } else s.roundsSurvived += 1;
      }
    }
    rounds.push({
      round: r,
      seed: 'synthetic',
      winner: homeWins ? 'home' : 'away',
      endReason: 'elimination',
      tiebreakStep: null,
      durationTicks: 600,
      survivors: { home: 0, away: 0 },
      downs,
      finalHp: [],
      checksum: '0',
      eventHash: null,
    });
  }
  const week = state.calendar.weekId ?? ('MW1' as WeekId);
  return {
    fixtureId,
    competitionId: `lg:${state.calendar.season}:${home.tierId}` as MatchResult['competitionId'],
    stage: 'league',
    season: state.calendar.season,
    weekIndex: state.calendar.weekIndex,
    weekId: week,
    homeClubId: home.id,
    awayClubId: away.id,
    engineVersion: 0,
    contentHash: 'synthetic',
    input: {
      seed: 'synthetic',
      bestOf: 3,
      home: { clubId: home.id, fighters: h.fighters, captainIndex: h.captainIndex, viceCaptainIndex: h.viceCaptainIndex, chemistry: 0 },
      away: { clubId: away.id, fighters: a.fighters, captainIndex: a.captainIndex, viceCaptainIndex: a.viceCaptainIndex, chemistry: 0 },
    },
    rounds,
    score: { home: hw, away: aw },
    winnerClubId: hw > aw ? home.id : away.id,
    fighterStats: stats,
    mvpFighterId: null,
    hiredBladeIds: [],
  };
}

function sample(state: GameState, content: ContentDB, season: number, counts: { retirements: number; rookies: number; leavers: number }): SeasonSample {
  const living = Object.values(state.fighters).filter((f) => f.status === 'active' || f.status === 'free-agent');
  const ages = living.map((f) => fighterHumanAge100(f, content) / 100);
  const ratings = living.filter((f) => f.status === 'active').map((f) => ratingOf(f, content));
  let top5 = 0;
  let clubs = 0;
  const cqs: number[] = [];
  for (const club of Object.values(state.clubs)) {
    const top = rosterOf(state, club.id)
      .map((f) => ratingOf(f, content))
      .sort((a, b) => b - a)
      .slice(0, 5);
    if (top.length) {
      top5 += top.reduce((x, y) => x + y, 0) / top.length;
      clubs++;
    }
    if (club.captainId && state.fighters[club.captainId]?.clubId === club.id) cqs.push(captaincyBreakdown(state.fighters[club.captainId]!, content, topFiveMean(state, club.id, content)).cq);
  }
  return {
    season,
    population: living.length,
    rostered: living.filter((f) => f.status === 'active').length,
    freeAgents: living.filter((f) => f.status === 'free-agent').length,
    medianHumanAge: median(ages),
    shareAtMost22: ages.filter((a) => Math.floor(a) <= 22).length / Math.max(1, ages.length),
    shareAtLeast31: ages.filter((a) => Math.floor(a) >= 31).length / Math.max(1, ages.length),
    leagueMeanRating: ratings.length ? ratings.reduce((x, y) => x + y, 0) / ratings.length : 0,
    topFiveMean: clubs ? top5 / clubs : 0,
    maxRating: ratings.length ? Math.max(...ratings) : 0,
    ...counts,
    captainMeanCq: cqs.length ? cqs.reduce((x, y) => x + y, 0) / cqs.length : 0,
    captainShareA: cqs.filter((c) => c >= 85).length / Math.max(1, cqs.length),
    captainShareBelow40: cqs.filter((c) => c < 40).length / Math.max(1, cqs.length),
  };
}

export function runPopulation(options: PopulationOptions): PopulationReport {
  const content = options.content;
  const t = tables(content);
  const state = createEmptyGameState({ rootSeed: options.seed, content: content.ref, options: { trainingEmphasis: options.trainingEmphasis ?? true } });
  state.calendar = { season: 1, weekIndex: 1, weekId: content.weekByIndex(1).id as WeekId, phase: 'preseason' };
  for (const tpl of content.clubs.list) {
    const club = makeClub(content, tpl);
    state.clubs[club.id] = club;
  }
  const regions = content.regions.list;
  const gen = content.development.generation.worldGen;
  // World generation: rosters at 90% of cap with the tier's potential shift, plus free agents.
  const clubs = Object.values(state.clubs).sort((a, b) => (a.id < b.id ? -1 : 1));
  const wRng = Rng.create(state.rng.root, STREAM.soak, 'world');
  for (const club of clubs) {
    const tier = content.tiers.require(club.tierId);
    const n = Math.floor(tier.rosterCap * (bp(gen.rosterFillOfCap) / BP));
    for (let i = 0; i < n; i++) {
      const id = createFighterOn(state, { kind: 'worldgen', potentialShift: tier.worldGenPotentialShift, regionId: wRng.pick(regions).id as RegionId }, content);
      sign(state, state.fighters[id]!, club, wRng);
    }
  }
  const freeAgents = Math.floor(clubs.length * (bp(gen.freeAgentsPerClub) / BP));
  for (let i = 0; i < freeAgents; i++) {
    createFighterOn(state, { kind: 'free-agent', potentialShift: content.leagues.generationShifts.generatedFreeAgent, regionId: wRng.pick(regions).id as RegionId }, content);
  }

  const report: PopulationReport = {
    samples: [],
    injuries: {},
    severities: { knock: 0, minor: 0, moderate: 0, serious: 0 },
    careerEndings: 0,
    scars: 0,
    rolled: { positive: 0, negative: 0, fighters: 0 },
    retirementAges: {},
    starterPeakOverPotential: [],
    finalState: state,
  };
  for (const race of content.races.list) {
    report.injuries[race.id] = { injuries: 0, rounds: 0 };
    report.retirementAges[race.id] = [];
  }
  const counted = new Set<string>();
  const countRolled = (): void => {
    for (const f of Object.values(state.fighters)) {
      if (counted.has(f.id)) continue;
      counted.add(f.id);
      const p = rolledPolarity(f, content);
      report.rolled.positive += p.positive;
      report.rolled.negative += p.negative;
      report.rolled.fighters += 1;
    }
  };
  countRolled();
  setAiCaptains(state, content, true);

  for (let season = 1; season <= options.seasons; season++) {
    for (let w = 1; w <= t.weeksPerSeason; w++) {
      const week = content.weekByIndex(w);
      state.calendar = { season, weekIndex: w, weekId: week.id as WeekId, phase: week.phase };
      if (w === 1) announceFinalSeasonsOn(state, content);
      if (options.matches && week.phase === 'regular') {
        setAiCaptains(state, content, false);
        for (const tier of content.tiers.list) {
          const tierClubs = clubs.filter((c) => c.tierId === tier.id);
          const order = Rng.create(state.rng.root, STREAM.soak, 'pairs', season, w, tier.id).shuffle(tierClubs);
          for (let i = 0; i + 1 < order.length; i += 2) {
            const home = order[i]!;
            const away = order[i + 1]!;
            pickLineup(state, home, content);
            pickLineup(state, away, content);
            if (home.lineup.fighters.length === 0 || away.lineup.fighters.length === 0) continue;
            lockLineup(state, home.id, content);
            lockLineup(state, away.id, content);
            const fixtureId = `lg:${season}:${tier.id}:${week.id}:${home.id}:${away.id}` as FixtureId;
            const result = syntheticMatch(state, home, away, fixtureId, content);
            const before = new Map<string, number>();
            for (const fid of Object.keys(result.fighterStats)) before.set(fid, state.fighters[fid as FighterId]!.traits.length);
            const outcome = applyMatch(state, result, content);
            for (const [fid, s] of Object.entries(result.fighterStats)) {
              const f = state.fighters[fid as FighterId]!;
              const bucket = report.injuries[f.raceId];
              if (bucket) bucket.rounds += s.roundsPlayed;
            }
            for (const inj of outcome.injuries) {
              const f = state.fighters[inj.fighterId]!;
              const bucket = report.injuries[f.raceId];
              if (bucket) bucket.injuries += 1;
              report.severities[inj.severity] = (report.severities[inj.severity] ?? 0) + 1;
              if (isCareerEnded(f)) report.careerEndings += 1;
              const scarsNow = f.traits.filter((x) => x.source === 'scar' && x.gainedSeason === season).length;
              const hadBefore = before.get(f.id) ?? 0;
              if (f.traits.length > hadBefore && scarsNow > 0) report.scars += 1;
            }
          }
        }
      }
      weekly(state, content);
    }
    // ---- season end ----
    state.calendar = { season, weekIndex: t.weeksPerSeason + 1, weekId: null, phase: 'season-end' };
    state.history.push({ season, tiers: [], retirements: [], rookieIds: [] });
    seasonEndDevelopmentOn(state, content);
    const retired = seasonEndRetirementsOn(state, content);
    for (const r of retired) {
      const f = state.fighters[r.fighterId]!;
      report.retirementAges[f.raceId]?.push(r.age);
      if (f.career.roundsStarted >= 200) {
        const pot = potentialOf(f, content);
        if (pot > 0) report.starterPeakOverPotential.push(r.peakRating / pot);
      }
    }
    // Contract expiries: renew the top of each roster (cap − 2 by rating), release the rest.
    const xRng = Rng.create(state.rng.root, STREAM.soak, 'expiry', season);
    for (const club of clubs) {
      const roster = rosterOf(state, club.id)
        .map((f) => ({ f, rating: ratingOf(f, content) }))
        .sort((a, b) => b.rating - a.rating || byId(a.f, b.f));
      const keep = capOf(content, club) - 2;
      roster.forEach((x, i) => {
        if (!x.f.contract || x.f.contract.endSeason > season) return;
        if (i < keep) x.f.contract.endSeason = season + 1 + xRng.int(0, 2);
        else release(state, x.f);
      });
    }
    offseasonRecoveryOn(state, content);
    // Pool maintenance: a free agent unsigned at two consecutive season ends leaves (not a retirement for intake).
    let leavers = 0;
    const record = state.history[state.history.length - 1]!;
    for (const f of Object.values(state.fighters).sort(byId)) {
      if (f.status !== 'free-agent') continue;
      const fa = f.freeAgency ?? { unsignedSeasonEnds: 0, formerClubId: null, releasedByClubId: null, releasedSeason: null, enteredAt: { season: state.calendar.season, weekIndex: state.calendar.weekIndex } };
      fa.unsignedSeasonEnds += 1;
      f.freeAgency = fa;
      if (fa.unsignedSeasonEnds >= content.development.retirement.unsignedSeasonEndsBeforeLeaving) {
        setMembership(state, f, null, 'retired');
        record.retirements.push({ fighterId: f.id, age: f.age, lastClubId: null, proSeasons: f.career.proSeasons, peakRating: f.career.peakRating, cause: 'left-unsigned' });
        leavers++;
      }
    }
    // Next-season setup: rookies to the pool, rosters filled, captains for the new season (D-I).
    const rookies = generateRookiesOn(state, content);
    countRolled();
    state.calendar = { season: season + 1, weekIndex: 1, weekId: content.weekByIndex(1).id as WeekId, phase: 'preseason' };
    fillRosters(state, content, 1);
    for (const club of clubs) {
      const capId = club.captainId;
      if (capId && state.fighters[capId]?.clubId !== club.id) {
        club.captainId = null;
        club.captainAtLastLock = null;
        club.captainSince = null;
      }
    }
    setAiCaptains(state, content, true);
    report.samples.push(sample(state, content, season, { retirements: retired.length, rookies: rookies.length, leavers }));
  }
  return report;
}

