/**
 * sys-captaincy and sys-chemistry (O6, D-D, D-I; development.json captaincy, chemistry).
 *
 *   CQ = round(0.45 L + 0.25 C + 0.10 E + 0.10 S + 0.10 St) + youth + trait and status adds, clamp 1-100
 *   L = eff ldr × 5, C = eff cmp × 5, E = min(100, careerRounds × 100 / 500),
 *   S = min(100, matchweeksAtClub × 100 / 95), St = clamp(50 + 3 × (rating − top-5 mean), 0, 100)
 *
 * Chemistry (M1, D-D: trait and captain lineup modifiers only) = Σ trait terms
 * (club captain's own per-fighter terms × captainTraitChemistryMult) + the club
 * captain's grade term + captaincy status terms, clamped to [min, max].
 */
import type { CaptaincyGradeDef, ContentDB } from '../content';
import { idNumber, type ClubId, type Fighter, type FighterId, type GameState } from '../model';
import { effectSources, hasEffect, sumAdds } from './effects';
import { BP, bp, roundN } from './fixed';
import { effectiveStatsOf, fighterHumanAge100, ratingOf } from './stats';

export interface CaptaincyBreakdown {
  cq: number;
  grade: CaptaincyGradeDef;
  leadership: number;
  composure: number;
  experience: number;
  seniority: number;
  standing: number;
  youth: number;
  traits: number;
  statuses: number;
}

export function isCareerEnded(fighter: Fighter): boolean {
  return fighter.injury !== null && fighter.injury.weeksOut >= CAREER_ENDING_WEEKS;
}

/**
 * A career-ending injury is stored as a serious injury with weeksOut =
 * CAREER_ENDING_WEEKS (the Injury model has no flag; CHANGE REQUEST in the
 * README). The fighter is unavailable for the rest of the season and retires
 * at season end.
 */
export const CAREER_ENDING_WEEKS = 999;

export function isFitFighter(fighter: Fighter): boolean {
  if (fighter.status === 'retired') return false;
  return fighter.injury === null || fighter.injury.weeksOut === 0;
}

export function gradeFor(cq: number, content: ContentDB): CaptaincyGradeDef {
  const grades = content.development.captaincy.grades.slice().sort((a, b) => b.minCq - a.minCq);
  for (const g of grades) if (cq >= g.minCq) return g;
  const last = grades[grades.length - 1];
  if (!last) throw new RangeError('development.json captaincy.grades is empty');
  return last;
}

/** Fighters on a club's roster (status active), in id order. */
export function clubFighters(state: GameState, clubId: ClubId): Fighter[] {
  return Object.values(state.fighters)
    .filter((f) => f.clubId === clubId && f.status === 'active')
    .sort((a, b) => idNumber(a.id) - idNumber(b.id) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Mean rating of the club's five best fit fighters (St reference). */
export function topFiveMean(state: GameState, clubId: ClubId, content: ContentDB): number {
  const ratings = clubFighters(state, clubId)
    .filter(isFitFighter)
    .map((f) => ratingOf(f, content))
    .sort((a, b) => b - a)
    .slice(0, 5);
  if (ratings.length === 0) return 0;
  let s = 0;
  for (const r of ratings) s += r;
  return s / ratings.length;
}

export function captaincyBreakdown(fighter: Fighter, content: ContentDB, top5Mean: number | null): CaptaincyBreakdown {
  const cfg = content.development.captaincy;
  const stats = effectiveStatsOf(fighter, content);
  const leadership = (stats['ldr' as keyof typeof stats] ?? 0) * 5;
  const composure = (stats['cmp' as keyof typeof stats] ?? 0) * 5;
  const experience = Math.min(100, (fighter.career.roundsStarted * 100) / cfg.experienceCareerRoundsFor100);
  const seniority = Math.min(100, (fighter.career.matchweeksAtClub * 100) / cfg.seniorityMatchweeksFor100);
  const rating = ratingOf(fighter, content);
  const ref = top5Mean ?? rating;
  const rawStanding = cfg.standing.pivot + cfg.standing.perRatingPointVsTopFiveAvg * (rating - ref);
  const standing = rawStanding < 0 ? 0 : rawStanding > 100 ? 100 : rawStanding;
  const w = cfg.weights;
  const weighted =
    (bp(w.leadership) * leadership +
      bp(w.composure) * composure +
      bp(w.experience) * experience +
      bp(w.seniority) * seniority +
      bp(w.standing) * standing) /
    BP;
  const youth = fighterHumanAge100(fighter, content) < cfg.youthPenalty.humanAgeBelow * 100 ? cfg.youthPenalty.add : 0;
  const sources = effectSources(fighter, content);
  const traits = sumAdds(sources.filter((s) => s.kind !== 'status'), 'captaincy');
  const statuses = sumAdds(sources.filter((s) => s.kind === 'status'), 'captaincy');
  const raw = roundN(weighted) + youth + traits + statuses;
  const cq = raw < 1 ? 1 : raw > 100 ? 100 : raw;
  return { cq, grade: gradeFor(cq, content), leadership, composure, experience, seniority, standing, youth, traits, statuses };
}

export function captaincyAt(state: GameState, fighterId: FighterId, clubId: ClubId, content: ContentDB): CaptaincyBreakdown {
  const f = state.fighters[fighterId];
  if (!f) throw new RangeError(`Unknown fighter ${fighterId}`);
  return captaincyBreakdown(f, content, topFiveMean(state, clubId, content));
}

export interface LineupCaptain {
  fighterId: FighterId;
  /** Index into the lineup's fighter list. */
  index: number;
  /** CQ the sim receives: the fighter's CQ, minus actingCaptainCqPenalty unless he is the club captain. */
  cqForFight: number;
  isClubCaptain: boolean;
  viceIndex: number | null;
}

/**
 * The lineup captain at lock (sys-captaincy procedure 1): club captain if
 * fielded, else the vice-captain, else the match-captain override, else the
 * highest-CQ fielded fighter (ties: seniority, rating, fighter id).
 */
export function lineupCaptainOf(state: GameState, clubId: ClubId, fighterIds: readonly FighterId[], content: ContentDB): LineupCaptain | null {
  if (fighterIds.length === 0) return null;
  const club = state.clubs[clubId];
  const mean = topFiveMean(state, clubId, content);
  const cqOf = (fid: FighterId): number => {
    const f = state.fighters[fid];
    return f ? captaincyBreakdown(f, content, mean).cq : 1;
  };
  const viceIndex = club?.viceCaptainId ? fighterIds.indexOf(club.viceCaptainId) : -1;
  let index = club?.captainId ? fighterIds.indexOf(club.captainId) : -1;
  if (index < 0) index = viceIndex;
  if (index < 0 && club?.lineup.matchCaptainId) index = fighterIds.indexOf(club.lineup.matchCaptainId);
  if (index < 0) {
    const ranked = fighterIds
      .map((fid, i) => {
        const f = state.fighters[fid];
        return { i, fid, cq: cqOf(fid), seniority: f?.career.matchweeksAtClub ?? 0, rating: f ? ratingOf(f, content) : 0 };
      })
      .sort((a, b) => b.cq - a.cq || b.seniority - a.seniority || b.rating - a.rating || idNumber(a.fid) - idNumber(b.fid) || (a.fid < b.fid ? -1 : 1));
    index = ranked[0]!.i;
  }
  const fighterId = fighterIds[index]!;
  const isClubCaptain = club?.captainId === fighterId;
  const penalty = isClubCaptain ? 0 : content.development.captaincy.actingCaptainCqPenalty;
  const cq = cqOf(fighterId) - penalty;
  return { fighterId, index, cqForFight: cq < 0 ? 0 : cq, isClubCaptain, viceIndex: viceIndex >= 0 && viceIndex !== index ? viceIndex : null };
}

/** Trait chemistry terms of one lineup (no captain grade, no statuses). */
function traitChemistry(fielded: readonly Fighter[], clubCaptainId: FighterId | null, content: ContentDB): number {
  const mult = content.development.captaincy.captainTraitChemistryMult;
  let total = 0;
  const holders = (traitId: string): number => fielded.filter((f) => f.traits.some((t) => t.id === traitId)).length;
  const pairDone = new Set<string>();
  for (const f of fielded) {
    const m = f.id === clubCaptainId ? mult : 1;
    for (const t of f.traits) {
      const def = content.traits.get(t.id);
      if (!def) continue;
      for (const e of def.effects) {
        if (e.type === 'chemistry') total += e.add * m;
        else if (e.type === 'chemistrySameRace') {
          const same = fielded.filter((o) => o.id !== f.id && o.raceId === f.raceId).length;
          const v = same === 0 ? e.ifNone : Math.min(e.max, same * e.perTeammate);
          total += v * m;
        } else if (e.type === 'chemistryClash') {
          // Once per lineup and trait: -add per clashing pair (two Glory-Hungry fighters = one pair).
          const key = `clash:${def.id}:${e.withTrait}`;
          if (pairDone.has(key)) continue;
          pairDone.add(key);
          const a = holders(def.id);
          const pairs = def.id === e.withTrait ? (a * (a - 1)) / 2 : a * holders(e.withTrait);
          total += pairs * e.add;
        } else if (e.type === 'chemistryPair') {
          const key = `pair:${def.id}:${e.withTrait}`;
          if (pairDone.has(key)) continue;
          pairDone.add(key);
          if (holders(e.withTrait) >= e.minHolders) total += e.add;
        }
      }
    }
  }
  return total;
}

export interface ChemistryBreakdown {
  total: number;
  traits: number;
  captainGrade: number;
  statuses: number;
}

export function chemistryBreakdown(
  state: GameState,
  clubId: ClubId,
  fighterIds: readonly FighterId[],
  captainId: FighterId | null,
  content: ContentDB,
): ChemistryBreakdown {
  const fielded = fighterIds.map((id) => state.fighters[id]).filter((f): f is Fighter => f !== undefined);
  const traits = traitChemistry(fielded, captainId, content);
  let captainGrade = 0;
  if (captainId && state.fighters[captainId]) captainGrade = captaincyAt(state, captainId, clubId, content).grade.chemistry;
  let statuses = 0;
  for (const f of fielded) {
    for (const s of effectSources(f, content)) if (s.kind === 'status') for (const e of s.effects) if (e.type === 'chemistry') statuses += e.add;
  }
  const club = state.clubs[clubId];
  if (club) {
    for (const st of club.statuses) {
      const def = content.development.statuses.find((d) => d.id === st.id);
      if (def) for (const e of def.effects) if (e.type === 'chemistry') statuses += e.add;
    }
  }
  const { min, max } = content.development.chemistry;
  const raw = traits + captainGrade + statuses;
  return { total: raw < min ? min : raw > max ? max : raw, traits, captainGrade, statuses };
}

export function isChemistryImmune(fighter: Fighter, content: ContentDB): boolean {
  return hasEffect(effectSources(fighter, content), 'chemistryImmune');
}
