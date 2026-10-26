/**
 * STAND-IN for core/fighters (WP2). Deliberately simple, deterministic and
 * rule-light: it exists so the season engine, AI and soak can run end to end
 * in tests before (and independently of) the real module. It is NOT the
 * game's lifecycle; never wire it into the shipped game.
 */
import { combatRating, type CaptaincyGradeDef, type ContentDB } from '../../content';
import type { CaptaincyValue, FighterSpec, MatchLifecycleOutcome, StatContext } from '../../fighters';
import {
  putFighter,
  setMembership,
  allocateId,
  asId,
  blankProgression,
  emptyCareerStats,
  emptySeasonCounters,
  type ClassId,
  type ClubId,
  type Fighter,
  type FighterId,
  type GameState,
  type MatchResult,
  type PaceId,
  type RaceId,
  type RetirementRecord,
  type StatId,
} from '../../model';
import { Rng, STREAM } from '../../rng';
import { clamp, notImplemented } from '../../util';
import type { GamePorts } from '../ports';

type Port = GamePorts['fighters'];

function statIds(content: ContentDB): StatId[] {
  return content.stats.list.map((s) => s.id as StatId);
}

function humanAge100(f: Fighter, content: ContentDB): number {
  return Math.trunc((f.age * 8000) / content.races.require(f.raceId).lifespan);
}

function createFighter(draft: GameState, spec: FighterSpec, content: ContentDB): FighterId {
  const id = allocateId(draft.ids, 'fighter');
  const rng = Rng.create(draft.rng.root, STREAM.rookies, 'stand-in', id);
  const race = spec.raceId ? content.races.require(spec.raceId) : rng.pick(content.races.list);
  const klass = spec.classId ? content.classes.require(spec.classId) : rng.pick(content.classes.list);
  const band =
    spec.humanAge ??
    (spec.kind === 'rookie' ? null : spec.kind === 'journeyman' || spec.kind === 'hired-blade' ? { min: 24, max: 33 } : { min: 18, max: 35 });
  const age = band === null ? rng.int(race.debutAge.min, race.debutAge.max) : Math.max(race.debutAge.min, Math.trunc((rng.int(band.min, band.max) * race.lifespan) / 80));
  const base = (spec.kind === 'hired-blade' && spec.ratingTarget ? spec.ratingTarget * 20 : 900) + spec.potentialShift * 30 + rng.int(-100, 300);
  const per = (f: (i: number) => number): Record<StatId, number> => Object.fromEntries(statIds(content).map((s, i) => [s, f(i)])) as Record<StatId, number>;
  const cap100 = per(() => clamp(base + rng.int(-250, 250), 200, 2000));
  const f: Fighter = {
    id,
    name: { given: `Stand${idNum(id)}`, family: null, epithet: null, full: `Stand ${idNum(id)}` },
    raceId: asId<RaceId>(race.id),
    classId: asId<ClassId>(klass.id),
    originRegionId: spec.regionId,
    age,
    debutSeason: draft.calendar.season,
    clubId: null,
    status: spec.kind === 'hired-blade' ? 'hired-blade' : 'free-agent',
    contract: null,
    contractProfile: { greedBp: 0 },
    freeAgency: spec.kind === 'hired-blade' ? null : { unsignedSeasonEnds: 0, formerClubId: null, releasedByClubId: null, releasedSeason: null },
    potentialRoll: clamp(Math.trunc(base / 20) + rng.int(0, 15), 1, 100),
    paceId: asId<PaceId>(content.development.pace.levels[0]!.id),
    cap100,
    bloom: per(() => 0),
    dev100: { physical: 2400, mental: 2400 },
    wear100: per(() => 0),
    traits: [],
    statuses: [],
    injury: null,
    trainingEmphasis: 'balanced',
    finalSeason: false,
    career: emptyCareerStats(),
    season: emptySeasonCounters(),
    history: [],
    learnedAbilityIds: [],
    academy: null,
    // Stand-in stats are cap − wear: the trained value is the cap.
    ...blankProgression(cap100),
  };
  putFighter(draft, f);
  return id;
}

function idNum(id: string): number {
  return Number(id.slice(id.indexOf('-') + 1));
}

function effectiveStats(f: Fighter, content: ContentDB, context?: StatContext): Record<StatId, number> {
  const out = {} as Record<StatId, number>;
  for (const s of statIds(content)) out[s] = clamp(Math.trunc(((f.cap100[s] ?? 1000) - (f.wear100[s] ?? 0)) / 100), 1, 20);
  const cmp = 'cmp' as StatId;
  if (context?.chemistry) out[cmp] = clamp((out[cmp] ?? 10) + Math.trunc(context.chemistry / 2), 1, 20);
  return out;
}

function rating(f: Fighter, content: ContentDB): number {
  return combatRating(content, f.classId, effectiveStats(f, content));
}

function grade(content: ContentDB, cq: number): CaptaincyGradeDef {
  const grades = content.development.captaincy.grades;
  return grades.find((g) => cq >= g.minCq) ?? grades[grades.length - 1]!;
}

function captaincy(state: GameState, fighterId: FighterId, _clubId: ClubId, content: ContentDB): CaptaincyValue {
  const f = state.fighters[fighterId]!;
  const s = effectiveStats(f, content);
  const cq = clamp(Math.trunc(((s['ldr' as StatId] ?? 10) * 5 * 45 + (s['cmp' as StatId] ?? 10) * 5 * 25 + 50 * 30) / 100), 1, 100);
  return { cq, grade: grade(content, cq) };
}

function isFit(f: Fighter): boolean {
  return f.status !== 'retired' && (f.injury === null || f.injury.weeksOut <= 0);
}

function applyMatchLifecycle(draft: GameState, result: MatchResult, content: ContentDB): MatchLifecycleOutcome {
  const out: MatchLifecycleOutcome = { xp: {}, injuries: [], newsIds: [] };
  for (const [id, st] of Object.entries(result.fighterStats)) {
    const fid = id as FighterId;
    const f = draft.fighters[fid];
    if (!f) continue;
    const xp = st.roundsPlayed * content.development.xp.perRoundStarted;
    out.xp[fid] = xp;
    f.season.xp += xp;
    f.season.roundsStarted += st.roundsPlayed;
    f.season.matchesStarted += 1;
    f.career.matches += 1;
    f.career.roundsStarted += st.roundsPlayed;
    f.career.xpTotal += xp;
    const rng = Rng.create(draft.rng.root, STREAM.injury, result.season, result.fixtureId, fid);
    if (f.status === 'active' && rng.chanceBp(150)) {
      f.injury = { severity: 'knock', weeksOut: 1, fixtureId: result.fixtureId, round: 1, causeFighterId: null, damageBp: 0, since: { season: result.season, weekIndex: result.weekIndex } };
      f.season.injuries += 1;
      out.injuries.push({ fighterId: fid, severity: 'knock', weeksOut: 1 });
    }
  }
  return out;
}

function weeklyLifecycle(draft: GameState): [] {
  for (const f of Object.values(draft.fighters)) {
    if (f.injury === null) continue;
    if (f.injury.since.season === draft.calendar.season && f.injury.since.weekIndex === draft.calendar.weekIndex) continue;
    f.injury.weeksOut -= 1;
    if (f.injury.weeksOut <= 0) f.injury = null;
  }
  return [];
}

function seasonEndDevelopment(draft: GameState, content: ContentDB): [] {
  for (const f of Object.values(draft.fighters)) {
    if (f.status === 'retired') continue;
    const r = rating(f, content);
    f.history.push({
      season: draft.calendar.season,
      age: f.age,
      clubId: f.clubId,
      rating: r,
      potential: f.potentialRoll,
      stats: effectiveStats(f, content),
      xp: f.season.xp,
      usageBp: clamp(Math.trunc((f.season.xp * 10000) / content.development.xp.seasonTarget), 0, 10000),
      injuries: f.season.injuries,
      traitsGained: [],
      traitsLost: [],
      levelStart: f.level,
      levelEnd: f.level,
      stamina: null,
      benchXp: f.season.benchXp,
      tiredRoundStarts: 0,
    });
    if (f.clubId !== null) f.career.proSeasons += 1;
    f.career.peakRating = Math.max(f.career.peakRating, r);
    f.age += 1;
    f.season = emptySeasonCounters();
  }
  return [];
}

function seasonEndRetirements(draft: GameState, content: ContentDB): RetirementRecord[] {
  const out: RetirementRecord[] = [];
  for (const f of Object.values(draft.fighters).sort((a, b) => idNum(a.id) - idNum(b.id))) {
    if (f.status === 'retired' || f.status === 'hired-blade') continue;
    if (humanAge100(f, content) < 3600) continue;
    const rec: RetirementRecord = { fighterId: f.id, age: f.age, lastClubId: f.clubId, proSeasons: f.career.proSeasons, peakRating: f.career.peakRating, cause: 'age' };
    out.push(rec);
    draft.history[draft.history.length - 1]?.retirements.push(rec);
    setMembership(draft, f, null, 'retired');
    f.contract = null;
    f.freeAgency = null;
  }
  return out;
}

function generateRookies(draft: GameState, content: ContentDB, n?: number): FighterId[] {
  const clubs = Object.keys(draft.clubs).length;
  const prev = draft.history[draft.history.length - 1];
  const retired = prev ? prev.retirements.filter((r) => r.cause !== 'left-unsigned').length : 0;
  const count = n ?? Math.round(clubs * 0.6) + retired;
  const ids: FighterId[] = [];
  const region = content.regions.list[0]!.id;
  for (let i = 0; i < count; i++) ids.push(createFighter(draft, { kind: 'rookie', potentialShift: 0, regionId: asId(region) }, content));
  return ids;
}

export function standInFighters(): Port {
  return {
    createFighter,
    humanAge100,
    effectiveStats,
    rating,
    potential: (f) => f.potentialRoll,
    captaincy,
    lineupChemistry: () => 0,
    isFit,
    injuryChanceBp: () => 150,
    retirementChanceBp: (state, id, content) => (humanAge100(state.fighters[id]!, content) >= 3600 ? 10000 : 0),
    trend: (_f, content) => content.development.trend.levels[2]?.id ?? 'holding',
    lineupCaptain: (state, clubId, ids, content) => {
      if (ids.length === 0) return null;
      const club = state.clubs[clubId];
      let index = club?.captainId ? ids.indexOf(club.captainId) : -1;
      const viceIndex = club?.viceCaptainId ? ids.indexOf(club.viceCaptainId) : -1;
      if (index < 0) index = viceIndex;
      if (index < 0 && club?.lineup.matchCaptainId) index = ids.indexOf(club.lineup.matchCaptainId);
      if (index < 0) index = 0;
      const fighterId = ids[index]!;
      const isClubCaptain = club?.captainId === fighterId;
      const cq = captaincy(state, fighterId, clubId, content).cq - (isClubCaptain ? 0 : content.development.captaincy.actingCaptainCqPenalty);
      return { fighterId, index, cqForFight: Math.max(0, cq), isClubCaptain, viceIndex: viceIndex >= 0 && viceIndex !== index ? viceIndex : null };
    },
    captainChangeConsequences: () => ({ snubbedId: null, snubExemption: null, passedOverIds: [] }),
    lineupLock: () => [],
    applyMatchLifecycle,
    weeklyLifecycle,
    seasonEndDevelopment,
    seasonEndRetirements,
    offseasonRecovery: (draft) => {
      for (const f of Object.values(draft.fighters)) if (f.injury) f.injury = null;
    },
    generateRookies,
    announceFinalSeasons: () => [],
    // ---- M1.1: reads as the real module; hooks are stubs until WP-C needs them in stand-in runs ----
    freshnessOf: (f) => Math.floor((f.freshness10 ?? 1000) / 10),
    freshnessLabel: (v) => (v >= 80 ? 'fresh' : v >= 60 ? 'ready' : v >= 40 ? 'tired' : 'spent'),
    effectiveLevelUpMode: () => 'auto',
    autoPickChoice: (_f, offer) => ({ optionIndex: offer.options.length > 0 ? 0 : null, traitIndex: null }),
    typicalRoundDrain10: () => 60,
    freshnessAfterRound: (...a) => notImplemented('stand-in fighters.freshnessAfterRound (M1.1 WP-C)', ...a),
    xpAfterRound: (...a) => notImplemented('stand-in fighters.xpAfterRound (M1.1 WP-C)', ...a),
    injuriesAfterRound: (...a) => notImplemented('stand-in fighters.injuriesAfterRound (M1.1 WP-C)', ...a),
    freshnessBetweenRounds: (...a) => notImplemented('stand-in fighters.freshnessBetweenRounds (M1.1 WP-C)', ...a),
    matchEndProgression: (...a) => notImplemented('stand-in fighters.matchEndProgression (M1.1 WP-C)', ...a),
    resolveLevelUp: (...a) => notImplemented('stand-in fighters.resolveLevelUp (M1.1 WP-C)', ...a),
  };
}
