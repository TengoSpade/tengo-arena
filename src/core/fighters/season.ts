/**
 * Season-end steps owned by core/fighters (leagues.json calendar.seasonEndOrder):
 * aging_and_development (step 6), retirements (7), offseason_injury_recovery (9),
 * the rookie part of next_season_setup (13), and P1 final-season announcements.
 */
import type { ContentDB } from '../content';
import {
  emptySeasonCounters,
  idNumber,
  setMembership,
  trimHistoryStats,
  type ClubId,
  type Fighter,
  type FighterId,
  type GameState,
  type NewsId,
  type RegionId,
  type RetirementRecord,
  type SeasonRecord,
  type StatId,
  type TraitId,
} from '../model';
import { Rng, STREAM } from '../rng';
import { checkThresholds, type TraitChange } from './acquired';
import { captaincyBreakdown, isCareerEnded, topFiveMean } from './captaincy';
import { applySeasonWear, usageBpOf } from './development';
import { levelMentorMult, xpNeededFor } from './levels';
import { resolveAllPending } from './progression';
import { setFreshness10 } from './freshness';
import { effectSources } from './effects';
import { BP, bp, roundN } from './fixed';
import { createFighterOn } from './generation';
import { pushNews } from './news';
import { retirementChanceWith } from './retirement';
import { effectiveStatsOf, fighterHumanAge100, potentialOf, ratingOf } from './stats';
import { tables } from './tables';
import { removeTrait } from './traits';

const FINAL_SEASON = 'final_season';

function byId(a: Fighter, b: Fighter): number {
  return idNumber(a.id) - idNumber(b.id) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

interface ClubMentoring {
  /** Captain part of the mentor multiplier (pro-rated by matchweeks held), excluding a given captain. */
  captains: { fighterId: FighterId; weeks: number; mult: number; letter: string }[];
  /** Trait mentors on the roster: youngDevMult per fighter. */
  traitMentors: { fighterId: FighterId; mult: number }[];
}

function clubMentoring(state: GameState, content: ContentDB): Map<string, ClubMentoring> {
  const out = new Map<string, ClubMentoring>();
  for (const clubId of Object.keys(state.clubs).sort()) out.set(clubId, { captains: [], traitMentors: [] });
  const means = new Map<string, number>();
  const meanOf = (clubId: string): number => {
    let m = means.get(clubId);
    if (m === undefined) {
      m = topFiveMean(state, clubId as ClubId, content);
      means.set(clubId, m);
    }
    return m;
  };
  for (const f of Object.values(state.fighters).sort(byId)) {
    for (const [clubId, weeks] of Object.entries(f.season.captainWeeksByClub)) {
      const entry = out.get(clubId);
      if (!entry || !weeks) continue;
      const grade = captaincyBreakdown(f, content, meanOf(clubId)).grade;
      entry.captains.push({ fighterId: f.id, weeks, mult: grade.mentorDevMult, letter: grade.letter });
    }
    if (f.clubId && f.status === 'active') {
      const entry = out.get(f.clubId);
      if (!entry) continue;
      for (const s of effectSources(f, content)) {
        if (s.kind !== 'trait') continue;
        for (const e of s.effects) if (e.type === 'mentor') entry.traitMentors.push({ fighterId: f.id, mult: e.youngDevMult });
      }
    }
  }
  return out;
}

/** Mentor multiplier for a young fighter (human-age ≤ youngHumanAgeAtMost), capped. */
export function mentorMultiplier(f: Fighter, info: ClubMentoring | undefined, content: ContentDB): number {
  const cfg = content.development.captaincy.mentoring;
  if (!info || fighterHumanAge100(f, content) > cfg.youngHumanAgeAtMost * 100) return 1;
  const mw = tables(content).matchweekIndexes.length;
  let covered = 0;
  let weighted = 0;
  for (const c of info.captains) {
    if (c.fighterId === f.id) continue;
    const w = Math.min(c.weeks, mw - covered);
    if (w <= 0) continue;
    covered += w;
    weighted += w * (bp(c.mult) / BP);
  }
  const captainPart = mw > 0 ? (weighted + (mw - covered)) / mw : 1;
  const mentors = info.traitMentors
    .filter((m) => m.fighterId !== f.id)
    .map((m) => m.mult)
    .sort((a, b) => b - a)
    .slice(0, cfg.traitMentorsCounted);
  let total = captainPart;
  for (const m of mentors) total *= bp(m) / BP;
  const cap = bp(cfg.totalMentorMultCap) / BP;
  return total > cap ? cap : total;
}

/** Share of the season's matchweeks covered by club captains whose grade letter is in `letters`. */
function captainCoverage(f: Fighter, info: ClubMentoring | undefined, letters: readonly string[], content: ContentDB): number {
  if (!info) return 0;
  const mw = tables(content).matchweekIndexes.length;
  let weeks = 0;
  for (const c of info.captains) if (letters.includes(c.letter) && c.fighterId !== f.id) weeks += c.weeks;
  return mw > 0 ? Math.min(1, weeks / mw) : 0;
}

/**
 * Season-end loss rolls (traits.json loss.rule 'seasonEndChance'). The
 * `requires` conditions are free text in content, so they are keyed on the
 * trait id here (structural content request 3).
 */
function seasonEndLosses(f: Fighter, info: ClubMentoring | undefined, usageBp: number, content: ContentDB, root: string, season: number): TraitChange[] {
  const changes: TraitChange[] = [];
  const weeks = tables(content).weeksPerSeason;
  for (const held of f.traits.slice()) {
    const def = content.traits.get(held.id);
    const loss = def?.loss;
    if (!def || !loss || loss.rule !== 'seasonEndChance') continue;
    let eligible = true;
    if (loss.humanAgeAtLeast !== undefined && fighterHumanAge100(f, content) < loss.humanAgeAtLeast * 100) eligible = false;
    if (loss.requires !== undefined) {
      if (def.id === 'idle_hands') eligible &&= captainCoverage(f, info, ['A'], content) >= 1 && usageBp >= 5_000;
      else if (def.id === 'flinches') eligible &&= captainCoverage(f, info, ['A', 'B'], content) >= 1 && usageBp >= 5_000;
      else if (def.id === 'wandering_mind') eligible &&= f.season.emphasisWeeks.mind * 2 >= weeks;
      else eligible = false;
    }
    if (!eligible) continue;
    const rng = Rng.create(root, STREAM.traits, season, f.id, 'season-loss', def.id);
    if (rng.chanceBp(bp(loss.chance)) && removeTrait(f, def.id, content)) changes.push({ traitId: def.id, change: 'lost' });
  }
  return changes;
}

/**
 * Season-end step 6, M1.1 "Aging" (progression.md; the M1 development step is removed):
 *   1. auto-resolve every pending level-up (oldest first, by the fighter's policy; manual -> auto);
 *   2. wear (physical table from human-age 31, Stamina included; mental from human-age 60, D-B);
 *   3. trait gain and loss checks; usage for the retirement modifiers = min(1, round XP ÷ 360);
 *   4. history row (the age held during the season), age +1, then xpNeeded recomputed
 *      (xpIntoLevel kept: a full bar triggers at the next match end); peak rating updated.
 */
export function seasonEndDevelopmentOn(draft: GameState, content: ContentDB): NewsId[] {
  const news: NewsId[] = [];
  const season = draft.calendar.season;
  const root = draft.rng.root;
  const mentoring = clubMentoring(draft, content);
  // Titles: the ending season's Reckoning champions (archived before this step); their rosters at season end.
  const champions = new Set<string>();
  const ending = latestRecord(draft);
  if (ending && ending.season === season) for (const t of ending.tiers) if (t.reckoningChampionId) champions.add(t.reckoningChampionId);
  const aged: Fighter[] = [];
  for (const f of Object.values(draft.fighters).sort(byId)) {
    if (f.status === 'retired') continue;
    if (f.status === 'active' && f.clubId !== null && champions.has(f.clubId)) f.career.titles += 1;
    const info = f.clubId ? mentoring.get(f.clubId) : undefined;
    resolveAllPending(draft, f, content);
    applySeasonWear(f, content);
    const usageBp = usageBpOf(f.season.roundXp, content);
    if (f.season.roundsStarted > 0 || (f.clubId !== null && f.status === 'active')) f.career.proSeasons += 1;
    const changes = [
      ...seasonEndLosses(f, info, usageBp, content, root, season),
      ...checkThresholds(f, 'seasonEnd', season, content, root),
    ];
    for (const c of changes) {
      news.push(pushNews(draft, { key: c.change === 'skipped' ? 'fighter.trait_skipped' : `fighter.trait_${c.change}`, clubId: f.clubId, fighterId: f.id, params: { traitId: c.traitId } }));
    }
    const rating = ratingOf(f, content);
    if (rating > f.career.peakRating) f.career.peakRating = rating;
    const stats = effectiveStatsOf(f, content);
    const levelsThisSeason = f.season.levelLog.filter((l) => l.season === season).length;
    f.history.push({
      season,
      age: f.age,
      clubId: f.clubId,
      rating,
      potential: potentialOf(f, content),
      stats,
      xp: f.season.xp,
      usageBp,
      injuries: f.season.injuries,
      traitsGained: [
        ...f.traits.filter((t) => t.gainedSeason === season && (t.source === 'event' || t.source === 'scar' || t.source === 'level')).map((t) => t.id),
      ],
      traitsLost: changes.filter((c) => c.change === 'lost').map((c) => c.traitId as TraitId),
      levelStart: f.level - levelsThisSeason,
      levelEnd: f.level,
      stamina: stats['stamina' as StatId] ?? null,
      benchXp: f.season.benchXp,
      tiredRoundStarts: f.season.tiredRoundStarts + f.season.spentRoundStarts,
    });
    trimHistoryStats(f.history);
    f.season = emptySeasonCounters();
    f.age += 1;
    aged.push(f);
  }
  // XP per level after age +1 (the mentor term reads club-mates' new ages and grades).
  for (const f of aged) f.xpNeeded = xpNeededFor(f, content, { mentor: levelMentorMult(draft, f, content) });
  return news;
}

function latestRecord(state: GameState): SeasonRecord | undefined {
  return state.history[state.history.length - 1];
}

export function seasonEndRetirementsOn(draft: GameState, content: ContentDB): RetirementRecord[] {
  const season = draft.calendar.season;
  const root = draft.rng.root;
  const records: RetirementRecord[] = [];
  for (const f of Object.values(draft.fighters).sort(byId)) {
    if (f.status === 'retired') continue;
    const row = f.history.find((r) => r.season === season);
    const ageDuring = row ? row.age : f.age;
    const usageBp = row ? row.usageBp : usageBpOf(f.season.roundXp, content);
    const careerEnded = isCareerEnded(f);
    let retire = careerEnded || f.finalSeason;
    if (!retire) {
      const chance = retirementChanceWith(f, content, { age: ageDuring, usageBp, season, enabled: draft.options.retirement });
      if (chance > 0) retire = Rng.create(root, STREAM.retirement, season, f.id).chanceBp(chance);
    }
    if (!retire) continue;
    const record: RetirementRecord = {
      fighterId: f.id,
      age: ageDuring,
      lastClubId: f.clubId,
      proSeasons: f.career.proSeasons,
      peakRating: f.career.peakRating,
      cause: careerEnded ? 'career-ending-injury' : 'age',
    };
    records.push(record);
    pushNews(draft, { key: 'fighter.retired', clubId: f.clubId, fighterId: f.id, params: { age: ageDuring, cause: record.cause } });
    // Contracts end without payout (index.ts contract); the fighter leaves every roster.
    setMembership(draft, f, null, 'retired');
    f.contract = null;
    f.freeAgency = null;
    f.finalSeason = false;
    f.statuses = [];
    f.injury = null;
  }
  const rec = latestRecord(draft);
  if (rec && rec.season === season) rec.retirements.push(...records);
  return records;
}

export function offseasonRecoveryOn(draft: GameState, content: ContentDB): void {
  const weeks = content.development.time.offseasonRecoveryWeeks;
  const fr = content.levels.freshness;
  for (const f of Object.values(draft.fighters).sort(byId)) {
    // M1.1 (frs-010): the off-season resets Freshness to seasonEndReset.
    if (f.status !== 'retired') setFreshness10(f, Math.round(fr.seasonEndReset * fr.storageUnitsPerPoint));
    if (f.status === 'retired' || !f.injury || isCareerEnded(f)) continue;
    f.injury.weeksOut = Math.max(0, f.injury.weeksOut - weeks);
    if (f.injury.weeksOut === 0 && f.injury.severity !== 'serious') f.injury = null;
  }
}

/** Retirements this season counted for intake: retirements and career-ending injuries, never leavers (D-H). */
export function retirementsForIntake(state: GameState): number {
  const rec = latestRecord(state);
  if (rec) return rec.retirements.filter((r) => r.cause !== 'left-unsigned').length;
  // No season record yet: fighters retired in the step-7 roll of this season carry its history row.
  const season = state.calendar.season;
  return Object.values(state.fighters).filter((f) => f.status === 'retired' && f.history[f.history.length - 1]?.season === season).length;
}

export function rookieCount(state: GameState, content: ContentDB): number {
  const clubs = Object.keys(state.clubs).length;
  const intake = content.development.generation.intake;
  const base = roundN(clubs * (bp(intake.basePerClub) / BP));
  const lo = roundN(clubs * (bp(intake.minPerClub) / BP));
  const hi = roundN(clubs * (bp(intake.maxPerClub) / BP));
  const n = base + retirementsForIntake(state);
  return n < lo ? lo : n > hi ? hi : n;
}

/** Talent-pool region of a rookie: uniform over content regions (open-027: every region supplies fighters). */
function regionFor(state: GameState, content: ContentDB, i: number): RegionId {
  const regions = content.regions.list;
  const rng = Rng.create(state.rng.root, STREAM.rookies, state.calendar.season, 'intake-region', i);
  return rng.pick(regions).id as RegionId;
}

export function generateRookiesOn(draft: GameState, content: ContentDB, count?: number): FighterId[] {
  const n = count ?? rookieCount(draft, content);
  const shift = content.leagues.generationShifts.rookieIntake;
  const ids: FighterId[] = [];
  for (let i = 0; i < n; i++) ids.push(createFighterOn(draft, { kind: 'rookie', potentialShift: shift, regionId: regionFor(draft, content, i) }, content));
  const rec = latestRecord(draft);
  if (rec && (rec.season === draft.calendar.season || rec.season === draft.calendar.season - 1)) rec.rookieIds.push(...ids);
  return ids;
}

/** Live retirement chance (fighter card): current age, season usage so far, current contract. */
export function liveRetirementChance(state: GameState, f: Fighter, content: ContentDB, usageBp?: number): number {
  return retirementChanceWith(f, content, {
    age: f.age,
    usageBp: usageBp ?? usageBpOf(f.season.roundXp, content),
    season: state.calendar.season,
    enabled: state.options.retirement,
  });
}

export function announceFinalSeasonsOn(draft: GameState, content: ContentDB): NewsId[] {
  const news: NewsId[] = [];
  const threshold = bp(content.development.retirement.finalSeasonAnnounceAtLeast);
  for (const f of Object.values(draft.fighters).sort(byId)) {
    if (f.status === 'retired' || f.finalSeason || isCareerEnded(f)) continue;
    if (liveRetirementChance(draft, f, content, BP) < threshold) continue;
    f.finalSeason = true;
    f.statuses = f.statuses.filter((s) => s.id !== FINAL_SEASON);
    f.statuses.push({ id: FINAL_SEASON, remainingWeeks: null, remainingMatches: null, since: { season: draft.calendar.season, weekIndex: draft.calendar.weekIndex } });
    news.push(pushNews(draft, { key: 'fighter.final_season', clubId: f.clubId, fighterId: f.id, params: { age: f.age }, importance: 'notable' }));
  }
  return news;
}

/**
 * Trend (M1): RETIRED in M1.1 (progression.md: replaced by the level, the XP bar and
 * "next level in ≈ N matches", levelEtaMatches). Kept only so the M1 contract and its callers
 * compile until they switch (CHANGE REQUEST to WP-C / WP-D): always 0 / 'holding', reading
 * nothing from development.json trend.
 */
export function trendDelta(f: Fighter, content: ContentDB): number {
  void f;
  void content;
  return 0;
}

export function trendId(f: Fighter, content: ContentDB): string {
  void f;
  void content;
  return 'holding';
}
