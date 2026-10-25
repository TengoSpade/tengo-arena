/**
 * After a match (week processing step 3, per result): XP for rounds started
 * only (O3, D-A), injury rolls per round with at most one new injury per
 * match (applied at match end), career and season counters, Still tender,
 * Back from the Brink, Green Nerves fading, Title-Tested.
 *
 * Inputs come from the committed MatchResult (03 boundary contract 2). In M1
 * a fielded fighter starts every round of the match (open-010), so a
 * fighter's rounds started are rounds 1..roundsPlayed. Per-round damage
 * taken and max HP are exact for rounds in which the fighter was downed
 * (DownRecord); for the other rounds the remaining match damage is spread
 * evenly and max HP is recomputed from the fight input with the combat.json
 * maxHp formula (internal adapter; CHANGE REQUEST: per-round damage and max
 * HP in FighterMatchStats).
 */
import type { ContentDB } from '../content';
import {
  idNumber,
  type ClubId,
  type Fighter,
  type FighterId,
  type FighterMatchStats,
  type FightFighterInput,
  type GameState,
  type MatchResult,
  type NewsId,
} from '../model';
import { Rng, STREAM } from '../rng';
import { checkThresholds, gainTrait, pickScar } from './acquired';
import { CAREER_ENDING_WEEKS } from './captaincy';
import { effectSources, multFactorsBp } from './effects';
import { BP, bp, truncN } from './fixed';
import {
  SEVERITY_ORDER,
  careerEndingGivenSeriousBp,
  isAtRisk,
  rollWeeksOut,
  roundInjuryChanceBp,
  scarChanceBp,
  severityWeights,
  seriousShareBp,
  type RoundExposure,
  type Severity,
} from './injury';
import { pushNews } from './news';
import { effectiveStatsOf } from './stats';
import { tables } from './tables';

/** Event-keyed storied traits (traits.json gain.rule 'event'; structural content request 3). */
export const EVENT_TRAIT_IDS = {
  titleTested: 'title_tested',
  backFromBrink: 'back_from_brink',
  painTempered: 'pain_tempered',
} as const;

export const STILL_TENDER = 'still_tender';
export const CAPTAIN_DEPARTED = 'captain_departed';

export interface MatchInjury {
  fighterId: FighterId;
  severity: Severity;
  weeksOut: number;
}

export interface MatchLifecycleResult {
  xp: Record<FighterId, number>;
  injuries: MatchInjury[];
  newsIds: NewsId[];
}

/** combat.json maxHp: trunc(base.hp × max(minFactor, 1 + perTgh·d(TGH) + perStr·d(STR)) × hpMult). */
export function maxHpOf(input: FightFighterInput, content: ContentDB): number {
  const klass = content.classes.require(input.classId);
  const c = content.combat.derived.maxHp;
  const stats = input.stats as Record<string, number>;
  const tgh = stats['tgh'] ?? 10;
  const str = stats['str'] ?? 10;
  let factor = BP + bp(c.perTgh) * (tgh - 10) + bp(c.perStr) * (str - 10);
  const minF = bp(c.minFactor);
  if (factor < minF) factor = minF;
  const hpMult = bp(input.combatMods?.hpMult ?? content.combat.combatModsDefaults.hpMult);
  const hp = truncN((((klass.base.hp * factor) / BP) * hpMult) / BP);
  return hp < 1 ? 1 : hp;
}

function sortedIds(ids: readonly string[]): FighterId[] {
  return (ids as FighterId[]).slice().sort((a, b) => idNumber(a) - idNumber(b) || (a < b ? -1 : a > b ? 1 : 0));
}

interface RoundFacts {
  won: boolean;
  credits: number;
  exposure: RoundExposure;
  byFighterId: FighterId | null;
}

function roundFacts(result: MatchResult, fid: FighterId, stats: FighterMatchStats, input: FightFighterInput | null, content: ContentDB, credits: Map<string, number>): RoundFacts[] {
  const side = stats.clubId === result.homeClubId ? 'home' : 'away';
  const n = Math.min(stats.roundsPlayed, result.rounds.length);
  const downs = new Map<number, (typeof stats.downs)[number]>();
  for (const d of stats.downs) if (!downs.has(d.round)) downs.set(d.round, d);
  let downedDamage = 0;
  let downedRounds = 0;
  for (const [r, d] of downs) {
    if (r >= 1 && r <= n) {
      downedDamage += d.damageTakenRound;
      downedRounds++;
    }
  }
  const knownMaxHp = stats.downs[0]?.maxHp;
  const maxHp = knownMaxHp && knownMaxHp > 0 ? knownMaxHp : input ? maxHpOf(input, content) : 1000;
  const others = n - downedRounds;
  const perOther = others > 0 ? Math.max(0, stats.damageTaken - downedDamage) / others : 0;
  const out: RoundFacts[] = [];
  for (let r = 1; r <= n; r++) {
    const d = downs.get(r);
    // Exact per-round values from the sim (v2); older results fall back to the estimate.
    const exactDamage = stats.roundDamageTaken?.[r - 1];
    const exactHp = stats.roundMaxHp?.[r - 1];
    const damage = exactDamage ?? (d ? d.damageTakenRound : perOther);
    const hp = exactHp !== undefined && exactHp > 0 ? exactHp : d && d.maxHp > 0 ? d.maxHp : maxHp;
    out.push({
      won: result.rounds[r - 1]?.winner === side,
      credits: credits.get(`${fid}|${r}`) ?? 0,
      exposure: { damageRatioBp: truncN((damage * BP) / hp), downed: d !== undefined },
      byFighterId: d?.byFighterId ?? null,
    });
  }
  return out;
}

function inputsById(result: MatchResult): Map<string, FightFighterInput> {
  const m = new Map<string, FightFighterInput>();
  for (const f of result.input.home.fighters) m.set(f.fighterId, f);
  for (const f of result.input.away.fighters) m.set(f.fighterId, f);
  return m;
}

/** XP of one round started (development.json xp), floored once after the multipliers. */
export function roundXp(fighter: Fighter, content: ContentDB, facts: { won: boolean; credits: number; downed: boolean }, tournament: boolean): number {
  const x = content.development.xp;
  const raw = x.perRoundStarted + (facts.won ? x.winBonus : 0) + Math.min(x.downCreditMax, facts.credits) * x.downCreditEach + (facts.downed ? 0 : x.surviveBonus);
  let v = raw;
  const factors = [tournament ? bp(x.tournamentMult) : BP, ...multFactorsBp(effectSources(fighter, content), 'xp')];
  for (const f of factors) v = (v * f) / BP;
  return truncN(v);
}

export function applyMatch(draft: GameState, result: MatchResult, content: ContentDB): MatchLifecycleResult {
  const root = draft.rng.root;
  const tournament = result.stage !== 'league';
  const inputs = inputsById(result);
  const credits = new Map<string, number>();
  for (const s of Object.values(result.fighterStats)) {
    for (const d of s.downs) {
      if (!d.byFighterId) continue;
      const key = `${d.byFighterId}|${d.round}`;
      credits.set(key, (credits.get(key) ?? 0) + 1);
    }
  }
  const out: MatchLifecycleResult = { xp: {}, injuries: [], newsIds: [] };
  const since = { season: result.season, weekIndex: result.weekIndex };

  for (const fid of sortedIds(Object.keys(result.fighterStats))) {
    const stats = result.fighterStats[fid];
    const f = draft.fighters[fid];
    if (!stats || !f) continue;
    const input = inputs.get(fid) ?? null;
    const facts = roundFacts(result, fid, stats, input, content, credits);
    const n = facts.length;
    if (n === 0) {
      out.xp[fid] = 0;
      continue;
    }

    // Returning from an injury: the healed record is cleared at the next match started.
    if (f.injury && f.injury.weeksOut === 0) {
      if (f.injury.severity === 'serious' && content.traits.has(EVENT_TRAIT_IDS.backFromBrink)) {
        for (const c of gainTrait(f, EVENT_TRAIT_IDS.backFromBrink, 'event', result.season, content, root)) {
          out.newsIds.push(pushNews(draft, { key: c.change === 'skipped' ? 'fighter.trait_skipped' : `fighter.trait_${c.change}`, clubId: f.clubId, fighterId: fid, params: { traitId: c.traitId } }));
        }
      }
      f.injury = null;
    }

    // Injury odds use the pre-match state (traits, statuses, At risk at lineup lock).
    const atRisk = isAtRisk(f, content);
    const tgh = input ? (input.stats as Record<string, number>)[content.development.injury.durability.stat] : undefined;
    const chances = facts.map((r) => roundInjuryChanceBp(f, content, r.exposure, tgh));
    const weights = facts.map((r) => severityWeights(f, content, r.exposure));
    let seriousMatch = 0;
    for (let i = 0; i < n; i++) seriousMatch += ((chances[i] ?? 0) * seriousShareBp(weights[i]!)) / BP;
    seriousMatch = truncN(seriousMatch);

    let injury: { round: number; severity: Severity; rng: Rng } | null = null;
    if (f.status !== 'retired') {
      for (let i = 0; i < n; i++) {
        const rng = Rng.create(root, STREAM.injury, result.season, result.fixtureId, i + 1, fid);
        if (rng.chanceBp(chances[i] ?? 0)) {
          const w = weights[i]!;
          const severity = SEVERITY_ORDER[rng.weightedIndex(SEVERITY_ORDER.map((s) => w[s]))]!;
          injury = { round: i + 1, severity, rng };
          break;
        }
      }
    }

    // XP and counters.
    let xp = 0;
    let roundsWon = 0;
    for (const r of facts) {
      xp += roundXp(f, content, { won: r.won, credits: r.credits, downed: r.exposure.downed }, tournament);
      if (r.won) roundsWon++;
    }
    out.xp[fid] = xp;
    f.season.xp += xp;
    f.season.roundsStarted += n;
    f.season.matchesStarted += 1;
    f.career.matches += 1;
    f.career.roundsStarted += n;
    f.career.roundsWon += roundsWon;
    f.career.downsInflicted += stats.downsInflicted;
    f.career.downsSuffered += stats.downsSuffered;
    f.career.damageDealt += stats.damageDealt;
    f.career.healingDone += stats.healingDone;
    f.career.xpTotal += xp;

    // Still tender counts down per match started.
    for (const s of f.statuses) if (s.id === STILL_TENDER && s.remainingMatches !== null) s.remainingMatches -= 1;
    f.statuses = f.statuses.filter((s) => !(s.id === STILL_TENDER && s.remainingMatches !== null && s.remainingMatches <= 0));

    // Match-end trait thresholds (Green Nerves fades at 120 career rounds) and Title-Tested.
    const traitChanges = checkThresholds(f, 'matchEnd', result.season, content, root);
    if (result.stage === 'final' && result.winnerClubId === stats.clubId && content.traits.has(EVENT_TRAIT_IDS.titleTested)) {
      traitChanges.push(...gainTrait(f, EVENT_TRAIT_IDS.titleTested, 'event', result.season, content, root));
    }
    for (const c of traitChanges) {
      out.newsIds.push(pushNews(draft, { key: c.change === 'skipped' ? 'fighter.trait_skipped' : `fighter.trait_${c.change}`, clubId: f.clubId, fighterId: fid, params: { traitId: c.traitId } }));
    }

    if (injury) out.newsIds.push(...applyInjury(draft, f, injury, facts[injury.round - 1]!, { atRisk, seriousMatch, result, since }, content, out));
  }
  return out;
}

function applyInjury(
  draft: GameState,
  f: Fighter,
  injury: { round: number; severity: Severity; rng: Rng },
  facts: RoundFacts,
  ctx: { atRisk: boolean; seriousMatch: number; result: MatchResult; since: { season: number; weekIndex: number } },
  content: ContentDB,
  out: MatchLifecycleResult,
): NewsId[] {
  const news: NewsId[] = [];
  const root = draft.rng.root;
  const { severity, rng } = injury;
  let weeksOut = rollWeeksOut(rng, f, severity, content);
  let careerEnded = false;
  if (severity === content.development.injury.careerEnding.onlyOnSeverity && ctx.atRisk) {
    careerEnded = rng.derive('career-ending').chanceBp(careerEndingGivenSeriousBp(ctx.seriousMatch, content));
    if (careerEnded) weeksOut = CAREER_ENDING_WEEKS;
  }
  f.injury = {
    severity,
    weeksOut,
    fixtureId: ctx.result.fixtureId,
    round: injury.round,
    causeFighterId: facts.byFighterId,
    damageBp: facts.exposure.damageRatioBp,
    since: ctx.since,
    careerEnding: careerEnded,
  };
  f.season.injuries += 1;
  out.injuries.push({ fighterId: f.id, severity, weeksOut });
  news.push(pushNews(draft, { key: 'fighter.injured', clubId: f.clubId, fighterId: f.id, fixtureId: ctx.result.fixtureId, params: { severity, weeksOut, round: injury.round }, importance: 'urgent' }));

  if (severity === 'moderate' || severity === 'serious') {
    f.statuses = f.statuses.filter((s) => s.id !== STILL_TENDER);
    f.statuses.push({ id: STILL_TENDER, remainingWeeks: null, remainingMatches: 2, since: ctx.since });
  }

  // Scar roll (moderate and serious only), Pain-Tempered alongside a scar.
  const scarRng = rng.derive('scar');
  if (scarRng.chanceBp(scarChanceBp(f, severity, content))) {
    const scar = pickScar(scarRng, f, content);
    if (scar) {
      const changes = gainTrait(f, scar, 'scar', ctx.result.season, content, root);
      const gained = changes.some((c) => c.traitId === scar && c.change === 'gained');
      for (const c of changes) {
        news.push(pushNews(draft, { key: c.change === 'skipped' ? 'fighter.trait_skipped' : c.traitId === scar ? 'fighter.scarred' : `fighter.trait_${c.change}`, clubId: f.clubId, fighterId: f.id, params: { traitId: c.traitId } }));
      }
      if (gained && content.traits.has(EVENT_TRAIT_IDS.painTempered) && scarRng.chanceBp(bp(content.development.injury.scar.painTemperedChance))) {
        for (const c of gainTrait(f, EVENT_TRAIT_IDS.painTempered, 'event', ctx.result.season, content, root)) {
          news.push(pushNews(draft, { key: c.change === 'skipped' ? 'fighter.trait_skipped' : `fighter.trait_${c.change}`, clubId: f.clubId, fighterId: f.id, params: { traitId: c.traitId } }));
        }
      }
    }
  }

  if (careerEnded) {
    news.push(pushNews(draft, { key: 'fighter.career_ended', clubId: f.clubId, fighterId: f.id, fixtureId: ctx.result.fixtureId, importance: 'urgent' }));
    const club = f.clubId ? draft.clubs[f.clubId] : undefined;
    if (club && club.captainId === f.id) news.push(...captainLeft(draft, club.id, content));
  }
  return news;
}

/** A club captain who held the role >= 19 matchweeks leaves mid-season: club status captain_departed. */
export function captainLeft(draft: GameState, clubId: ClubId, content: ContentDB): NewsId[] {
  const club = draft.clubs[clubId];
  if (!club || !club.captainSince) return [];
  if (draft.calendar.phase === 'season-end') return [];
  const held = matchweeksBetween(club.captainSince, { season: draft.calendar.season, weekIndex: draft.calendar.weekIndex }, content);
  if (held < PROVISIONAL_CAPTAIN_DEPARTED_MIN_MATCHWEEKS) return [];
  const weeks = PROVISIONAL_CAPTAIN_DEPARTED_WEEKS;
  club.statuses = club.statuses.filter((s) => s.id !== CAPTAIN_DEPARTED);
  club.statuses.push({ id: CAPTAIN_DEPARTED, remainingWeeks: weeks, since: { season: draft.calendar.season, weekIndex: draft.calendar.weekIndex } });
  return [pushNews(draft, { key: 'captaincy.departed', clubId, importance: 'notable' })];
}

/**
 * PROVISIONAL (OPEN, content request): development.json gives these only as
 * text (captaincy.captainDeparted.appliesWhen "held the role >= 19
 * matchweeks"; statuses captain_departed duration "4 matchweeks"; snubbed and
 * passed_over "6 matchweeks"; strip.appliesWhen "held the role >= 4 matchweeks";
 * exemption "injured with >= 4 weeks remaining").
 */
export const PROVISIONAL_CAPTAIN_DEPARTED_MIN_MATCHWEEKS = 19;
export const PROVISIONAL_CAPTAIN_DEPARTED_WEEKS = 4;
export const PROVISIONAL_SNUBBED_WEEKS = 6;
export const PROVISIONAL_PASSED_OVER_WEEKS = 6;
export const PROVISIONAL_STRIP_MIN_MATCHWEEKS = 4;
export const PROVISIONAL_STRIP_INJURY_EXEMPT_WEEKS = 4;

/** Matchweeks (regular + tournament weeks) from `from` (inclusive) to `to` (exclusive). */
export function matchweeksBetween(from: { season: number; weekIndex: number }, to: { season: number; weekIndex: number }, content: ContentDB): number {
  const idx = tables(content).matchweekIndexes;
  const before = (w: number): number => idx.filter((i) => i < w).length;
  return (to.season - from.season) * idx.length + before(to.weekIndex) - before(from.weekIndex);
}

/** Effective tgh used for injury odds outside a match. */
export function durabilityStat(f: Fighter, content: ContentDB): number {
  return (effectiveStatsOf(f, content) as Record<string, number>)[content.development.injury.durability.stat] ?? 10;
}
