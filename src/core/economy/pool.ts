/**
 * Free-agent pool, Trials Day, hired blades and contract temperament
 * (03-league-economy sys-transfers, sys-roster; D-H rookie counts and pool
 * floors). New fighters come from core/fighters.createFighter; economy fills
 * contractProfile and the market fields.
 */
import type { ContentDB } from '../content';
import type { ClassId, ClubId, Fighter, FighterId, GameState, RegionId } from '../model';
import { asId } from '../model';
import { Rng, STREAM } from '../rng';
import { fighterIsFit, generateFighter, type FighterSpec } from './fighter-values';
import { clubsInOrder, compareFighterIds, poolFighters, profileOf, roleFamiliesOf, rosterOf, tierOf } from './queries';
import { processingStamp } from './time';

/**
 * PROVISIONAL: human-age band of pool-floor journeymen (03-league-economy
 * sys-transfers "humanAge 26-33"). OPEN: not in content yet; CHANGE REQUEST
 * development.json generation.journeyman {humanAgeMin, humanAgeMax}.
 */
export const PROVISIONAL_JOURNEYMAN_HUMAN_AGE = { min: 26, max: 33 } as const;

/** Roll greed (contractProfile.greedBp) once per fighter on STREAM.market; order-independent. */
export function rollContractProfileImpl(draft: GameState, fighterId: FighterId, content: ContentDB): void {
  const f = draft.fighters[fighterId];
  if (!f) return;
  const g = content.economy.ask.greed;
  const steps = Math.trunc((g.maxBp - g.minBp) / g.stepBp);
  const rng = Rng.create(draft.rng.root, STREAM.market, 'greed', fighterId);
  f.contractProfile = { greedBp: g.minBp + g.stepBp * rng.int(0, steps) };
}

function freeAgencyBlank(): NonNullable<Fighter['freeAgency']> {
  return { unsignedSeasonEnds: 0, formerClubId: null, releasedByClubId: null, releasedSeason: null };
}

/** Mark a fighter as an unattached free agent (pool or trials rookie). */
export function makeFreeAgent(f: Fighter): void {
  f.clubId = null;
  f.contract = null;
  f.status = 'free-agent';
  if (!f.freeAgency) f.freeAgency = freeAgencyBlank();
}

// ---- Trials Day (P-18, D-H) -------------------------------------------------------------------------------

/**
 * Assign the season's rookies for Trials Day: each club floor(n / clubs) of a
 * shuffled list; the remainder one each to clubs drawn by lot (stream
 * rookies). Independent of standings (no tanking incentive).
 */
export function assignTrialsRookies(draft: GameState, rookieIds: readonly FighterId[], season: number, content: ContentDB): void {
  const clubs = clubsInOrder(draft, content).map((c) => c.id);
  draft.market.trialsRookies = {};
  if (clubs.length === 0) return;
  const valid = rookieIds.filter((id) => draft.fighters[id] !== undefined).slice().sort(compareFighterIds);
  for (const id of valid) {
    const f = draft.fighters[id]!;
    makeFreeAgent(f);
    rollContractProfileImpl(draft, id, content);
  }
  const rng = Rng.create(draft.rng.root, STREAM.rookies, season, 'trials-day');
  const shuffled = rng.shuffle(valid);
  const each = Math.trunc(shuffled.length / clubs.length);
  let next = 0;
  for (const clubId of clubs) {
    draft.market.trialsRookies[clubId] = shuffled.slice(next, next + each);
    next += each;
  }
  const lotClubs = rng.shuffle(clubs);
  for (const clubId of lotClubs) {
    if (next >= shuffled.length) break;
    draft.market.trialsRookies[clubId]!.push(shuffled[next]!);
    next += 1;
  }
}

/** Week processing step 7 (P1): unsigned trials rookies enter the free-agent pool. */
export function releaseTrialsRookiesImpl(draft: GameState): void {
  draft.market.trialsRookies = {};
}

// ---- hired blades (open-006) ------------------------------------------------------------------------------

function pickClass(rng: Rng, archetype: string, content: ContentDB): ClassId {
  const base = content.classes.list.filter((k) => k.archetypes.length === 1 && k.archetypes[0] === archetype);
  const any = content.classes.list.filter((k) => (k.archetypes as readonly string[]).includes(archetype));
  const pool = base.length > 0 ? base : any.length > 0 ? any : content.classes.list;
  return asId<ClassId>(rng.pick(pool).id);
}

/**
 * Lineup lock: a club with a fixture this week and fewer than 5 fit roster
 * fighters gets generated hired blades at its tier band minimum: first a
 * missing Tank, then a missing Healer, then Melee DPS. Idempotent: blades
 * already assigned this week count. They sit outside the cap and are paid the
 * tier minimum at this week's processing (weeklyCosts), then leave.
 */
export function assignHiredBladesImpl(draft: GameState, content: ContentDB): Record<ClubId, FighterId[]> {
  const out: Record<ClubId, FighterId[]> = {};
  const now = processingStamp(draft);
  const playing = new Set<ClubId>();
  for (const fx of Object.values(draft.fixtures)) {
    if (fx.season !== now.season || fx.weekIndex !== now.weekIndex || fx.status !== 'scheduled') continue;
    playing.add(fx.homeClubId);
    playing.add(fx.awayClubId);
  }
  for (const club of clubsInOrder(draft, content)) {
    if (!playing.has(club.id)) continue;
    const fit = rosterOf(draft, club.id).filter((f) => fighterIsFit(f));
    const blades = Object.values(draft.fighters)
      .filter((f) => f.status === 'hired-blade' && f.clubId === club.id)
      .sort((a, b) => compareFighterIds(a.id, b.id));
    const missing = 5 - fit.length - blades.length;
    if (missing <= 0) {
      if (blades.length > 0) out[club.id] = blades.map((b) => b.id);
      continue;
    }
    const present = [...fit, ...blades];
    const has = (arch: string): boolean => present.some((f) => (content.classes.require(f.classId).archetypes as readonly string[]).includes(arch));
    const tier = tierOf(club, content);
    const wage = profileOf(club, content).tierMinWage;
    const rng = Rng.create(draft.rng.root, STREAM.market, now.season, now.weekIndex, club.id, 'hired-blade');
    const ids = blades.map((b) => b.id);
    for (let i = 0; i < missing; i++) {
      const archetype = !has('tank') ? 'tank' : !has('healer') ? 'healer' : 'melee';
      const spec: FighterSpec = {
        kind: 'hired-blade',
        potentialShift: content.leagues.generationShifts.generatedFreeAgent,
        regionId: club.regionId,
        classId: pickClass(rng, archetype, content),
        humanAge: { min: content.development.generation.hiredBlade.humanAgeMin, max: content.development.generation.hiredBlade.humanAgeMax },
        ratingTarget: tier.ratingBand.min,
      };
      const id = generateFighter(draft, spec, content);
      const blade = draft.fighters[id]!;
      rollContractProfileImpl(draft, id, content);
      blade.status = 'hired-blade';
      blade.clubId = club.id;
      blade.freeAgency = null;
      // One-week record outside the roster (03 sys-contracts); charged at this week's processing.
      blade.contract = {
        clubId: club.id,
        wagePerWeek: wage,
        startSeason: now.season,
        endSeason: now.season,
        signedAt: { season: now.season, weekIndex: now.weekIndex },
        dropClauseApplied: false,
      };
      present.push(blade);
      ids.push(id);
    }
    out[club.id] = ids;
  }
  return out;
}

// ---- pool floors (week processing step 10) ------------------------------------------------------------------

const FAMILIES = ['tank', 'dps', 'controller', 'healer'] as const;

/** Pool size and per-role-family counts (hybrids count for both families). */
export function poolCounts(state: GameState, content: ContentDB): { total: number; byFamily: Record<string, number> } {
  const byFamily: Record<string, number> = { tank: 0, dps: 0, controller: 0, healer: 0 };
  const pool = poolFighters(state);
  for (const f of pool) for (const fam of roleFamiliesOf(f.classId, content)) byFamily[fam] = (byFamily[fam] ?? 0) + 1;
  return { total: pool.length, byFamily };
}

function familyClasses(family: string, content: ContentDB): ClassId[] {
  return content.classes.list
    .filter((k) => roleFamiliesOf(k.id, content).has(family))
    .map((k) => asId<ClassId>(k.id));
}

/** Top the pool up with journeymen until both floors (in-season total, per role family) are met. */
export function topUpFreeAgentPoolImpl(draft: GameState, content: ContentDB): FighterId[] {
  const p = content.economy.market.pool;
  const now = processingStamp(draft);
  const rng = Rng.create(draft.rng.root, STREAM.market, now.season, now.weekIndex, 'journeymen');
  const lowest = [...content.tiers.list].sort((a, b) => b.level - a.level)[0];
  const regions = content.regions.list.map((r) => asId<RegionId>(r.id));
  const created: FighterId[] = [];
  const make = (classId?: ClassId): void => {
    const spec: FighterSpec = {
      kind: 'journeyman',
      potentialShift: content.leagues.generationShifts.generatedFreeAgent,
      regionId: rng.pick(regions),
      humanAge: { min: PROVISIONAL_JOURNEYMAN_HUMAN_AGE.min, max: PROVISIONAL_JOURNEYMAN_HUMAN_AGE.max },
    };
    if (classId !== undefined) spec.classId = classId;
    if (lowest) spec.ratingTarget = rng.int(lowest.ratingBand.min, lowest.ratingBand.max);
    const id = generateFighter(draft, spec, content);
    const f = draft.fighters[id]!;
    makeFreeAgent(f);
    rollContractProfileImpl(draft, id, content);
    created.push(id);
  };
  const counts = poolCounts(draft, content);
  for (const family of FAMILIES) {
    const classes = familyClasses(family, content);
    if (classes.length === 0) continue;
    while ((counts.byFamily[family] ?? 0) < p.roleFloor) {
      const classId = rng.pick(classes);
      make(classId);
      counts.total += 1;
      for (const fam of roleFamiliesOf(classId, content)) counts.byFamily[fam] = (counts.byFamily[fam] ?? 0) + 1;
    }
  }
  while (counts.total < p.inSeasonFloor) {
    make();
    counts.total += 1;
  }
  return created;
}

// ---- season end step 12 ------------------------------------------------------------------------------------

/** Free agents unsigned at N consecutive season ends leave the league (status 'retired', freeAgency kept). */
export function poolMaintenanceImpl(draft: GameState, content: ContentDB): FighterId[] {
  const limit = content.development.retirement.unsignedSeasonEndsBeforeLeaving;
  const leavers: FighterId[] = [];
  for (const f of poolFighters(draft)) {
    const fa = f.freeAgency ?? freeAgencyBlank();
    fa.unsignedSeasonEnds += 1;
    f.freeAgency = fa;
    if (fa.unsignedSeasonEnds >= limit) {
      f.status = 'retired';
      f.clubId = null;
      f.contract = null;
      leavers.push(f.id);
    }
  }
  const gone = new Set<string>(leavers);
  draft.market.offers = draft.market.offers.filter((o) => !gone.has(o.fighterId));
  return leavers.sort(compareFighterIds);
}
