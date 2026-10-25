/**
 * AI club manager (03 sys-ai-manager, §5.2; D-I captain timing; D-A training
 * emphasis). Pure: reads the committed state through AiPorts and returns
 * Commands, which core/game validates exactly like the player's (P-04).
 *
 * Never reads another club's pending offers (in particular the player's),
 * never tanks, never draws randomness: every tie is broken by stable keys
 * (rating, CQ, fighter id), so the plan is a pure function of the state.
 */
import { PHYSICAL_STAT_IDS, type AiPersonalityDef, type ClassDef, type ContentDB } from '../content';
import {
  asId,
  idNumber,
  type Club,
  type ClubId,
  type Command,
  type Fighter,
  type FighterId,
  type GameState,
  type LineupEntry,
  type TacticsAssignment,
  type TacticsPresetId,
  type TrainingEmphasis,
} from '../model';
import type { AiPorts } from './ports';

export interface LineupChoice {
  fighters: LineupEntry[];
  matchCaptainId: FighterId | null;
  tactics: Record<FighterId, TacticsAssignment>;
}

export interface CaptainChoice {
  captainId: FighterId | null;
  viceCaptainId: FighterId | null;
}

/** Role families used by the AI's need and lineup rules (hybrids count for both of theirs). */
export type RoleFamily = 'tank' | 'healer' | 'controller' | 'dps';

export interface AiApi {
  planWeek(state: GameState, clubId: ClubId, content: ContentDB): Command[];
  planSeasonEnd(state: GameState, clubId: ClubId, content: ContentDB): Command[];
  chooseLineup(state: GameState, clubId: ClubId, content: ContentDB): LineupChoice;
  valueFighter(state: GameState, clubId: ClubId, fighterId: FighterId, content: ContentDB): number;
  /**
   * Captain and vice-captain by the AI rule (D-I) among the projected starters.
   * mode 'season-end': best CQ, replacing an incumbent only by >= hysteresis.
   * mode 'week': keep the incumbent unless vacant or injured >= 4 weeks.
   * Also used by core/game to name an interim captain on a vacancy.
   */
  chooseCaptains(state: GameState, clubId: ClubId, content: ContentDB, mode: 'season-end' | 'week'): CaptainChoice;
  /** Start of an AI action phase (the engine calls it before planning every club on one draft). */
  beginPhase(): void;
  /** Captain, vice, training emphasis, presets and lineup only (no market actions): new-world setup. */
  planRoster(state: GameState, clubId: ClubId, content: ContentDB): Command[];
}

// ---- provisional constants (03 names the rule; content has no field yet) -----------------------------------
// OPEN (content request to economy.json aiPersonalities / ai): see core/ai README.

/** 03 sys-ai-manager: Seedbed avoids human-age > 27, Old hands < 24, unless the fighter would start. */
export const PROVISIONAL_AGE_RULES: Readonly<Record<string, { maxHumanAgeUnlessStarter?: number; minHumanAgeUnlessStarter?: number }>> = {
  youth_focused: { maxHumanAgeUnlessStarter: 27 },
  veteran: { minHumanAgeUnlessStarter: 24 },
};
/** 03 sys-ai-manager: voluntary releases only if the payout is <= 10% of SB. */
export const PROVISIONAL_VOLUNTARY_RELEASE_MAX_PAYOUT_BP = 1000;
/** 03 sys-ai-manager procedure 5: Seedbed signs any trials rookie with potential - rating >= 15. */
export const PROVISIONAL_SEEDBED_ROOKIE_MIN_GAP = 15;
/** 03 sys-ai-manager procedure 3: Glory-hunters rank free agents by surplus, not surplus per gold. */
export const PROVISIONAL_RANK_BY_SURPLUS: readonly string[] = ['star_chasing'];
/** 03 sys-captaincy (D-I): an AI captain injured with >= 4 weeks left may be replaced (exempt change). */
export const PROVISIONAL_CAPTAIN_INJURY_WEEKS = 4;

/** 03 sys-tactics "Preset selection in M1": club tacticsStyle -> preset style. */
export const PRESET_STYLE_FOR_TACTICS_STYLE: Readonly<Record<Club['tacticsStyle'], string>> = {
  aggressive: 'aggressive',
  steady: 'balanced',
  cautious: 'protective',
};

/** 03 §5.2 training rule 1: this trait sends the fighter to Mind. */
const WANDERING_MIND_TRAIT = 'wandering_mind';
/** development.json statuses id used by the at-risk resting rule. */
const AT_RISK_STATUS = 'at_risk';

const BP = 10000;

function floor5(x: number): number {
  return Math.floor(x / 5) * 5;
}

function byIdNumber(a: { id: string }, b: { id: string }): number {
  return idNumber(a.id) - idNumber(b.id) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/** Step table lookup [[fromKey, value], ...] (ascending keys): value of the last key <= x. */
function stepLookup(table: readonly (readonly number[])[], x: number): number {
  let v = table[0]?.[1] ?? 0;
  for (const row of table) if ((row[0] ?? 0) <= x) v = row[1] ?? v;
  return v;
}

export function roleFamilies(klass: ClassDef): RoleFamily[] {
  const out: RoleFamily[] = [];
  for (const a of klass.archetypes) {
    const f: RoleFamily = a === 'tank' ? 'tank' : a === 'healer' ? 'healer' : a === 'controller' ? 'controller' : 'dps';
    if (!out.includes(f)) out.push(f);
  }
  return out;
}

/** The first preset of the class with the club's mapped style (presetIds order), else the class default. */
export function stylePreset(klass: ClassDef, tacticsStyle: Club['tacticsStyle'], content: ContentDB): TacticsAssignment {
  const style = PRESET_STYLE_FOR_TACTICS_STYLE[tacticsStyle];
  for (const pid of klass.presetIds) {
    if (content.presets.get(pid)?.style === style) return { kind: 'preset', presetId: asId<TacticsPresetId>(pid) };
  }
  return { kind: 'preset', presetId: asId<TacticsPresetId>(klass.defaultPresetId) };
}

/** Training emphasis by the first matching rule of 03 §5.2 (D-A). */
export function emphasisFor(f: Fighter, content: ContentDB): TrainingEmphasis {
  if (f.traits.some((t) => t.id === WANDERING_MIND_TRAIT)) return 'mind';
  // D_physical >= 28 human-years (dev100 is hundredths of a human-year).
  if (f.dev100.physical >= 2800) return 'mind';
  const klass = content.classes.require(f.classId);
  const physical = new Set<string>(PHYSICAL_STAT_IDS);
  let phys = 0;
  let ment = 0;
  for (const [stat, w] of Object.entries(klass.ratingWeights)) {
    if (physical.has(stat)) phys += w;
    else ment += w;
  }
  const total = phys + ment;
  if (total > 0 && ment * 2 > total) return 'mind';
  if (total > 0 && phys * 2 > total) return 'body';
  return 'balanced';
}

/**
 * Per-call memo of derived fighter values (rating and friends are pure but
 * not free), so one plan evaluates each fighter once.
 */
/** Club-independent fighter values, shared by every club planned on the same state object. */
interface FighterMemo {
  ratings: Map<string, number>;
  potentials: Map<string, number>;
  ages: Map<string, number>;
}

function freshMemo(): FighterMemo {
  return { ratings: new Map(), potentials: new Map(), ages: new Map() };
}

class Ctx {
  private ratings: Map<string, number>;
  private potentials: Map<string, number>;
  private ages: Map<string, number>;
  private cqs = new Map<string, number>();
  private familyCache = new Map<string, RoleFamily[]>();
  private leagueNext: boolean | null = null;
  readonly club: Club;
  readonly personality: AiPersonalityDef;
  readonly cap: number;
  readonly tierLevel: number;
  readonly weekCount: number;

  constructor(
    readonly state: GameState,
    readonly clubId: ClubId,
    readonly content: ContentDB,
    readonly ports: AiPorts,
    memo: FighterMemo,
  ) {
    this.ratings = memo.ratings;
    this.potentials = memo.potentials;
    this.ages = memo.ages;
    const club = state.clubs[clubId];
    if (!club) throw new RangeError(`ai: unknown club "${clubId}"`);
    this.club = club;
    this.personality = content.aiPersonalities.get(club.aiPersonalityId) ?? content.aiPersonalities.list[0]!;
    const tier = content.tiers.require(club.tierId);
    this.cap = tier.rosterCap;
    this.tierLevel = tier.level;
    this.weekCount = content.leagues.calendar.weeks.length;
  }

  fighter(id: FighterId): Fighter {
    const f = this.state.fighters[id];
    if (!f) throw new RangeError(`ai: unknown fighter "${id}"`);
    return f;
  }

  rating(f: Fighter): number {
    let v = this.ratings.get(f.id);
    if (v === undefined) this.ratings.set(f.id, (v = this.ports.fighters.rating(f, this.content)));
    return v;
  }

  potential(f: Fighter): number {
    let v = this.potentials.get(f.id);
    if (v === undefined) this.potentials.set(f.id, (v = this.ports.fighters.potential(f, this.content)));
    return v;
  }

  /** Whole human-years (table lookups use floor(human-age), 03 §1). */
  humanAge(f: Fighter): number {
    let v = this.ages.get(f.id);
    if (v === undefined) this.ages.set(f.id, (v = Math.floor(this.ports.fighters.humanAge100(f, this.content) / 100)));
    return v;
  }

  cq(f: Fighter): number {
    let v = this.cqs.get(f.id);
    if (v === undefined) this.cqs.set(f.id, (v = this.ports.fighters.captaincy(this.state, f.id, this.clubId, this.content).cq));
    return v;
  }

  fit(f: Fighter): boolean {
    return f.status === 'active' && this.ports.fighters.isFit(f);
  }

  families(f: Fighter): RoleFamily[] {
    let v = this.familyCache.get(f.classId);
    if (v === undefined) this.familyCache.set(f.classId, (v = roleFamilies(this.content.classes.require(f.classId))));
    return v;
  }

  /** Active roster fighters in id order. */
  roster(): Fighter[] {
    const out: Fighter[] = [];
    for (const f of Object.values(this.state.fighters)) if (f.clubId === this.clubId && f.status === 'active') out.push(f);
    return out.sort(byIdNumber);
  }

  byRating = (a: Fighter, b: Fighter): number => this.rating(b) - this.rating(a) || this.cq(b) - this.cq(a) || byIdNumber(a, b);

  // ---- money ---------------------------------------------------------------------------------------------
  get finance(): Club['finance'] {
    return this.club.finance;
  }

  rich(): boolean {
    return this.finance.balance * BP > this.finance.seasonBudget * this.personality.richThresholdBp;
  }

  /** Spendable weekly wages: WB × wageUse (100% when rich or below the roster minimum). */
  wageCeiling(rosterCount: number): number {
    const full = rosterCount < this.content.economy.ai.rosterMinimum || this.rich();
    return full ? this.finance.wageBudgetPerWeek : Math.trunc((this.finance.wageBudgetPerWeek * this.personality.wageUseBp) / BP);
  }

  reserveFloor(rosterCount: number): number {
    if (rosterCount < this.content.economy.ai.rosterMinimum) return 0;
    return Math.trunc((this.finance.seasonBudget * this.personality.reserveFloorBp) / BP);
  }

  rosterTarget(): number {
    return Math.min(this.cap, Math.max(this.content.economy.ai.rosterMinimum, this.cap - this.personality.rosterSlack));
  }

  replacementRating(): number {
    return this.content.economy.ai.replacementRatingByTier[String(this.tierLevel)] ?? 0;
  }

  tierMinWage(): number {
    return this.content.tierProfile(this.tierLevel).tierMinWage;
  }

  /** Contract length by personality; 'fighter' = his preferred length (economy). */
  lengthFor(f: Fighter): number {
    const pref = this.personality.preferredLength;
    if (typeof pref === 'number') return pref;
    if (pref === 'young3_else1') return this.humanAge(f) <= this.content.economy.ai.youthMinutes.maxHumanAge ? 3 : 1;
    return this.ports.economy.preferredLength(this.state, f.id, this.content);
  }

  // ---- value ---------------------------------------------------------------------------------------------
  /** aiValue (03 sys-ai-manager), integer, against a given roster (the fighter himself excluded from the counts). */
  value(f: Fighter, roster: readonly Fighter[]): number {
    const ai = this.content.economy.ai;
    const r = this.rating(f);
    const gap = Math.min(Math.max(0, this.potential(f) - r), this.content.economy.wage.potentialGapCap);
    const potBonusBp = gap * stepLookup(this.content.economy.wage.potentialWeightBpByHumanAge, this.humanAge(f));
    const vet = ai.veteranPenaltyPerHumanYearOver;
    let v = r * BP + Math.trunc((potBonusBp * this.personality.potentialWeightBp) / BP);
    v -= Math.max(0, this.humanAge(f) - vet.humanAge) * vet.points * this.personality.veteranPenaltyBp;
    const others = roster.filter((o) => o.id !== f.id);
    if (this.needs(f, others)) v += ai.needBonus * BP;
    if (this.wouldStart(f, others)) v += ai.starterBonus * BP;
    return Math.trunc(v / BP);
  }

  needs(f: Fighter, others: readonly Fighter[]): boolean {
    const targets = this.content.economy.ai.roleTargets;
    for (const fam of this.families(f)) {
      const target = targets[fam];
      const count = others.filter((o) => this.families(o).includes(fam)).length;
      if (count < target) return true;
    }
    return false;
  }

  wouldStart(f: Fighter, others: readonly Fighter[]): boolean {
    const r = this.rating(f);
    let better = 0;
    for (const o of others) {
      const ro = this.rating(o);
      if (ro > r || (ro === r && byIdNumber(o, f) < 0)) better++;
    }
    return better < 5;
  }

  surplus(f: Fighter, roster: readonly Fighter[]): number {
    return this.value(f, roster) - this.replacementRating();
  }

  ageRuleAllows(f: Fighter, roster: readonly Fighter[]): boolean {
    const rule = PROVISIONAL_AGE_RULES[this.personality.id];
    if (!rule) return true;
    const ha = this.humanAge(f);
    const tooOld = rule.maxHumanAgeUnlessStarter !== undefined && ha > rule.maxHumanAgeUnlessStarter;
    const tooYoung = rule.minHumanAgeUnlessStarter !== undefined && ha < rule.minHumanAgeUnlessStarter;
    if (!tooOld && !tooYoung) return true;
    return this.wouldStart(f, roster.filter((o) => o.id !== f.id));
  }

  // ---- calendar ------------------------------------------------------------------------------------------
  /** The club's next unplayed fixture is a league match (at-risk resting applies), else the Reckoning / none. */
  nextIsLeagueMatch(): boolean {
    if (this.leagueNext === null) this.leagueNext = this.computeNextIsLeagueMatch();
    return this.leagueNext;
  }

  private computeNextIsLeagueMatch(): boolean {
    const w = this.state.calendar.weekIndex;
    let best: { weekIndex: number; stage: string } | null = null;
    for (const x of Object.values(this.state.fixtures)) {
      if (x.status !== 'scheduled' || x.weekIndex < w) continue;
      if (x.homeClubId !== this.clubId && x.awayClubId !== this.clubId) continue;
      if (!best || x.weekIndex < best.weekIndex) best = x;
    }
    if (best) return best.stage === 'league';
    const next = Math.min(w + 1, this.weekCount);
    return next >= 1 && this.content.weekByIndex(next).phase === 'regular';
  }
}

// ---- lineup --------------------------------------------------------------------------------------------------

function lineupFrom(ctx: Ctx, roster: readonly Fighter[]): LineupChoice {
  const ai = ctx.content.economy.ai;
  const pool = roster.filter((f) => ctx.fit(f)).sort(ctx.byRating);
  const chosen: Fighter[] = [];
  const reserved = new Set<string>();
  const take = (f: Fighter | undefined): void => {
    if (f && !chosen.includes(f) && chosen.length < 5) {
      chosen.push(f);
    }
  };
  const tank = pool.find((f) => ctx.families(f).includes('tank'));
  take(tank);
  if (tank) reserved.add(tank.id);
  const healer = pool.find((f) => !chosen.includes(f) && ctx.families(f).includes('healer'));
  take(healer);
  if (healer) reserved.add(healer.id);
  for (const f of pool) take(f);

  // Seedbed: a prospect replaces the lowest non-Tank, non-Healer starter.
  if (ctx.personality.youthMinutes && chosen.length === 5) {
    const ym = ai.youthMinutes;
    const fifth = Math.min(...chosen.map((f) => ctx.rating(f)));
    const prospect = pool.find(
      (f) =>
        !chosen.includes(f) &&
        ctx.humanAge(f) <= ym.maxHumanAge &&
        ctx.potential(f) - ctx.rating(f) >= ym.minPotentialGap &&
        ctx.rating(f) >= fifth - ym.maxRatingBelowFifthStarter,
    );
    const swappable = chosen.filter((f) => !reserved.has(f.id)).sort(ctx.byRating);
    const out = swappable[swappable.length - 1];
    if (prospect && out) chosen[chosen.indexOf(out)] = prospect;
  }

  // At-risk resting: league matches only; a fit reserve of the same family within 3 rating.
  if (ctx.nextIsLeagueMatch()) {
    for (let i = 0; i < chosen.length; i++) {
      const f = chosen[i]!;
      if (!f.statuses.some((s) => s.id === AT_RISK_STATUS)) continue;
      const fam = ctx.families(f);
      const sub = pool.find(
        (o) =>
          !chosen.includes(o) &&
          !o.statuses.some((s) => s.id === AT_RISK_STATUS) &&
          ctx.families(o).some((x) => fam.includes(x)) &&
          ctx.rating(o) >= ctx.rating(f) - 3,
      );
      if (sub) chosen[i] = sub;
    }
  }

  // Slot order: front row first, then by rating (stable keys).
  const rowOf = (f: Fighter): 'front' | 'back' => ctx.content.classes.require(f.classId).startingRow;
  chosen.sort((a, b) => (rowOf(a) === rowOf(b) ? ctx.byRating(a, b) : rowOf(a) === 'front' ? -1 : 1));
  const tactics: Record<FighterId, TacticsAssignment> = {};
  for (const f of chosen) tactics[f.id] = stylePreset(ctx.content.classes.require(f.classId), ctx.club.tacticsStyle, ctx.content);
  return { fighters: chosen.map((f) => ({ fighterId: f.id, row: rowOf(f) })), matchCaptainId: null, tactics };
}

function captainsFrom(ctx: Ctx, roster: readonly Fighter[], starters: readonly FighterId[], mode: 'season-end' | 'week'): CaptainChoice {
  const onRoster = new Set(roster.map((f) => f.id));
  const byCq = (a: Fighter, b: Fighter): number =>
    ctx.cq(b) - ctx.cq(a) || b.career.matchweeksAtClub - a.career.matchweeksAtClub || ctx.rating(b) - ctx.rating(a) || byIdNumber(a, b);
  const projected = starters.map((id) => ctx.fighter(id)).sort(byCq);
  // With no projected starters (empty roster or all injured), fall back to the whole roster.
  const pool = projected.length > 0 ? projected : [...roster].sort(byCq);
  const best = pool[0] ?? null;
  const current = ctx.club.captainId !== null && onRoster.has(ctx.club.captainId) ? ctx.fighter(ctx.club.captainId) : null;
  let captain: Fighter | null;
  if (current === null) captain = best;
  else if (mode === 'season-end') {
    captain = best && best.id !== current.id && ctx.cq(best) >= ctx.cq(current) + ctx.content.economy.ai.captainHysteresis ? best : current;
  } else {
    const injured = current.injury !== null && current.injury.weeksOut >= PROVISIONAL_CAPTAIN_INJURY_WEEKS;
    captain = injured && best && best.id !== current.id ? best : current;
  }
  const vice = pool.find((f) => f.id !== captain?.id) ?? null;
  return { captainId: captain?.id ?? null, viceCaptainId: vice?.id ?? null };
}

function sameLineup(club: Club, choice: LineupChoice): boolean {
  const a = club.lineup.fighters;
  const b = choice.fighters;
  return (
    a.length === b.length &&
    a.every((e, i) => e.fighterId === b[i]!.fighterId && e.row === b[i]!.row) &&
    club.lineup.matchCaptainId === choice.matchCaptainId
  );
}

function sameTactics(a: TacticsAssignment | undefined, b: TacticsAssignment): boolean {
  return a !== undefined && a.kind === 'preset' && b.kind === 'preset' && a.presetId === b.presetId;
}

/** Captain, training emphasis, tactics and lineup commands for a projected roster. */
function rosterCommands(ctx: Ctx, roster: readonly Fighter[], mode: 'season-end' | 'week'): Command[] {
  const cmds: Command[] = [];
  const clubId = ctx.clubId;
  const choice = lineupFrom(ctx, roster);
  const caps = captainsFrom(ctx, roster, choice.fighters.map((e) => e.fighterId), mode);
  if (caps.captainId !== ctx.club.captainId || caps.viceCaptainId !== ctx.club.viceCaptainId) {
    cmds.push({ type: 'captaincy.set', clubId, captainId: caps.captainId, viceCaptainId: caps.viceCaptainId });
  }
  if (ctx.state.options.trainingEmphasis) {
    for (const f of roster) {
      const e = emphasisFor(f, ctx.content);
      if (e !== f.trainingEmphasis) cmds.push({ type: 'training.set', clubId, fighterId: f.id, emphasis: e });
    }
  }
  for (const e of choice.fighters) {
    const t = choice.tactics[e.fighterId]!;
    if (!sameTactics(ctx.club.lineup.tactics[e.fighterId], t)) cmds.push({ type: 'tactics.assign', clubId, fighterId: e.fighterId, tactics: t });
  }
  if (!sameLineup(ctx.club, choice)) cmds.push({ type: 'lineup.set', clubId, fighters: choice.fighters, matchCaptainId: choice.matchCaptainId });
  return cmds;
}

// ---- market procedures -----------------------------------------------------------------------------------------

function renewals(ctx: Ctx, roster: readonly Fighter[]): Command[] {
  const { state, content, clubId } = ctx;
  const fromIndex = content.weeks.get(content.economy.ai.renewalWeeksFrom)?.index ?? Number.POSITIVE_INFINITY;
  if (state.calendar.weekIndex < fromIndex) return [];
  const season = state.calendar.season;
  const target = ctx.rosterTarget();
  const ranked = [...roster].sort((a, b) => ctx.value(b, roster) - ctx.value(a, roster) || byIdNumber(a, b));
  const embargo = ctx.finance.status === 'embargo';
  let bill = ctx.ports.economy.wageBill(state, clubId) + ctx.ports.economy.pendingWages(state, clubId);
  const ceiling = ctx.wageCeiling(roster.length);
  const cmds: Command[] = [];
  ranked.forEach((f, rank) => {
    const c = f.contract;
    if (!c || c.endSeason !== season || f.finalSeason) return;
    if (ctx.ports.economy.agreedRenewal(state, f.id) !== null) return; // already renewed
    if (rank >= target || !ctx.ageRuleAllows(f, roster)) return;
    const nego = state.market.negotiations.find((n) => n.fighterId === f.id && n.clubId === clubId && n.season === season && n.kind === 'renewal');
    if (nego && nego.patienceLeft <= 0) return;
    const seasons = ctx.lengthFor(f);
    const ask = ctx.ports.economy.ask(state, f.id, clubId, seasons, content);
    let wage: number;
    if (embargo) wage = ctx.tierMinWage();
    else if (nego && nego.counterWage !== null && nego.validUntilWeek !== null && nego.validUntilWeek >= state.calendar.weekIndex) wage = nego.counterWage;
    else if (nego) wage = ask; // after a refusal: the full ask
    else wage = floor5((ask * (BP - ctx.personality.renewalHaggleBp)) / BP);
    if (bill - c.wagePerWeek + wage > ceiling) return;
    const check = ctx.ports.economy.checkOffer(state, { clubId, fighterId: f.id, wagePerWeek: wage, seasons, kind: 'renewal' }, content);
    if (!check.ok) return;
    bill += wage - c.wagePerWeek;
    cmds.push({ type: 'contract.renew', clubId, fighterId: f.id, wagePerWeek: wage, seasons });
  });
  return cmds;
}

function releases(ctx: Ctx, roster: readonly Fighter[]): FighterId[] {
  if (ctx.state.calendar.phase !== 'preseason') return [];
  const ranked = [...roster].sort((a, b) => ctx.value(a, roster) - ctx.value(b, roster) || byIdNumber(b, a));
  const over = roster.length - ctx.cap;
  if (over > 0) return ranked.slice(0, over).map((f) => f.id); // cap relief, lowest aiValue first
  const memory = ctx.state.ai[ctx.clubId];
  let allowance = ctx.personality.maxVoluntaryReleasesPerSeason - (memory?.voluntaryReleasesThisSeason ?? 0);
  const out: FighterId[] = [];
  let balance = ctx.finance.balance;
  for (const f of ranked) {
    if (allowance <= 0 || roster.length - out.length <= ctx.content.economy.ai.rosterMinimum) break;
    if (ctx.surplus(f, roster) >= 0) break;
    const payout = ctx.ports.economy.releasePayout(ctx.state, ctx.clubId, f.id, ctx.content);
    if (payout * BP > ctx.finance.seasonBudget * PROVISIONAL_VOLUNTARY_RELEASE_MAX_PAYOUT_BP) continue;
    if (balance - payout < ctx.reserveFloor(roster.length)) continue;
    balance -= payout;
    allowance--;
    out.push(f.id);
  }
  return out;
}

function freeAgentOffers(ctx: Ctx, roster: readonly Fighter[], extraRostered: number, extraBill: number): Command[] {
  const { state, content, clubId } = ctx;
  const econ = ctx.ports.economy;
  const own = state.market.offers.filter((o) => o.clubId === clubId);
  const ownIds = new Set(own.map((o) => o.fighterId));
  const rosterCount = roster.length + extraRostered;
  const ceiling = ctx.wageCeiling(rosterCount);
  const reserve = ctx.reserveFloor(rosterCount);
  let bill = econ.wageBill(state, clubId) + econ.pendingWages(state, clubId) + extraBill;
  let cash = ctx.finance.balance;
  const cmds: Command[] = [];
  const season = state.calendar.season;
  const week = state.calendar.weekIndex;

  // 4. Counters received: accept when within wage room.
  for (const n of state.market.negotiations) {
    if (n.clubId !== clubId || n.kind !== 'free-agent' || n.season !== season) continue;
    if (n.counterWage === null || n.validUntilWeek === null || n.validUntilWeek < week || ownIds.has(n.fighterId)) continue;
    const f = state.fighters[n.fighterId];
    if (!f || f.status !== 'free-agent') continue;
    const seasons = ctx.lengthFor(f);
    if (bill + n.counterWage > ceiling) continue;
    const check = econ.checkOffer(state, { clubId, fighterId: f.id, wagePerWeek: n.counterWage, seasons, kind: 'free-agent' }, content);
    if (!check.ok || cash - check.value.signingCost < reserve) continue;
    bill += n.counterWage;
    cash -= check.value.signingCost;
    ownIds.add(f.id);
    cmds.push({ type: 'offer.make', clubId, fighterId: f.id, wagePerWeek: n.counterWage, seasons, acceptCounter: true });
  }

  // 3. New offers while roster + pending < target.
  const pending = own.length + cmds.length;
  let slots = Math.min(ctx.rosterTarget() - (rosterCount + pending), ctx.personality.maxNewOffersPerWeek);
  if (slots <= 0) return cmds;
  const embargo = ctx.finance.status === 'embargo';
  if (embargo && roster.filter((f) => ctx.fit(f)).length >= 5) return cmds;

  const trials = new Set<string>();
  for (const ids of Object.values(state.market.trialsRookies)) for (const id of ids) trials.add(id);
  const released = new Set(state.market.releasedThisSeason.filter((r) => r.clubId === clubId).map((r) => r.fighterId));
  const refused = new Set(
    state.market.negotiations.filter((n) => n.clubId === clubId && n.season === season && n.patienceLeft <= 0).map((n) => n.fighterId),
  );
  const pool: Fighter[] = [];
  for (const f of Object.values(state.fighters)) {
    if (f.status !== 'free-agent' || trials.has(f.id) || released.has(f.id) || refused.has(f.id) || ownIds.has(f.id)) continue;
    pool.push(f);
  }
  if (pool.length === 0) return cmds;
  // Stars: the top share of the pool by rating get the star overbid.
  const byRating = [...pool].sort((a, b) => ctx.rating(b) - ctx.rating(a) || byIdNumber(a, b));
  const starCount = Math.trunc((pool.length * content.economy.ai.starFreeAgentTopShareBp) / BP);
  const stars = new Set(byRating.slice(0, starCount).map((f) => f.id));

  interface Cand {
    f: Fighter;
    seasons: number;
    ask: number;
    surplus: number;
  }
  const cands: Cand[] = [];
  for (const f of pool) {
    const surplus = ctx.surplus(f, roster);
    if (surplus <= 0 || !ctx.ageRuleAllows(f, roster)) continue;
    const seasons = embargo ? 1 : ctx.lengthFor(f);
    const ask = embargo ? ctx.tierMinWage() : econ.ask(state, f.id, clubId, seasons, content);
    if (ask <= 0) continue;
    cands.push({ f, seasons, ask, surplus });
  }
  const starChasing = PROVISIONAL_RANK_BY_SURPLUS.includes(ctx.personality.id); // Glory-hunters: best first
  cands.sort((a, b) => {
    const ka = starChasing ? a.surplus : Math.trunc((a.surplus * 1e6) / a.ask);
    const kb = starChasing ? b.surplus : Math.trunc((b.surplus * 1e6) / b.ask);
    return kb - ka || byIdNumber(a.f, b.f);
  });
  for (const c of cands) {
    if (slots <= 0) break;
    const overbid = embargo ? 0 : stars.has(c.f.id) ? ctx.personality.starOverbidBp : ctx.personality.overbidBp;
    const wage = embargo ? c.ask : floor5((c.ask * (BP + overbid)) / BP);
    if (bill + wage > ceiling) continue;
    const check = econ.checkOffer(state, { clubId, fighterId: c.f.id, wagePerWeek: wage, seasons: c.seasons, kind: 'free-agent' }, content);
    if (!check.ok || cash - check.value.signingCost < reserve) continue;
    bill += wage;
    cash -= check.value.signingCost;
    slots--;
    cmds.push({ type: 'offer.make', clubId, fighterId: c.f.id, wagePerWeek: wage, seasons: c.seasons, acceptCounter: false });
  }
  return cmds;
}

function trialsSignings(ctx: Ctx, roster: readonly Fighter[]): { cmds: Command[]; signed: number; wages: number } {
  const { state, content, clubId } = ctx;
  const ids = state.market.trialsRookies[clubId] ?? [];
  if (ids.length === 0 || ctx.finance.status === 'embargo') return { cmds: [], signed: 0, wages: 0 };
  const rookies = ids.map((id) => state.fighters[id]).filter((f): f is Fighter => f !== undefined && f.status === 'free-agent');
  const scored = rookies
    .map((f) => ({ f, surplus: ctx.surplus(f, roster), gap: ctx.potential(f) - ctx.rating(f) }))
    .sort((a, b) => b.surplus - a.surplus || b.gap - a.gap || byIdNumber(a.f, b.f));
  let room = ctx.cap - roster.length - state.market.offers.filter((o) => o.clubId === clubId).length;
  let bill = ctx.ports.economy.wageBill(state, clubId) + ctx.ports.economy.pendingWages(state, clubId);
  const ceiling = ctx.wageCeiling(roster.length);
  const cmds: Command[] = [];
  let wages = 0;
  for (const { f, surplus, gap } of scored) {
    if (room <= 0) break;
    const wanted = surplus > 0 || (ctx.personality.youthMinutes && gap >= PROVISIONAL_SEEDBED_ROOKIE_MIN_GAP);
    if (!wanted) continue;
    const seasons = ctx.lengthFor(f);
    const wage = ctx.ports.economy.ask(state, f.id, clubId, seasons, content);
    if (bill + wage > ceiling) continue;
    const check = ctx.ports.economy.checkOffer(state, { clubId, fighterId: f.id, wagePerWeek: wage, seasons, kind: 'trials' }, content);
    if (!check.ok) continue;
    bill += wage;
    wages += wage;
    room--;
    cmds.push({ type: 'trials.sign', clubId, fighterId: f.id, wagePerWeek: wage, seasons });
  }
  return { cmds, signed: cmds.length, wages };
}

// ---- the API ---------------------------------------------------------------------------------------------------

export function createAi(ports: AiPorts): AiApi {
  // An AI action phase plans every club on one draft: rating, potential and human-age do not depend on
  // the club and no AI command changes them, so planWeek / planSeasonEnd share them within a phase
  // (beginPhase starts a new one; a different state object always does). Other calls use a fresh memo.
  let memoState: GameState | null = null;
  let memo: FighterMemo = freshMemo();
  const phaseMemo = (state: GameState): FighterMemo => {
    if (state !== memoState) {
      memoState = state;
      memo = freshMemo();
    }
    return memo;
  };
  return {
    beginPhase() {
      memoState = null;
    },

    planWeek(state, clubId, content) {
      if (state.calendar.phase === 'season-end') return [];
      const ctx = new Ctx(state, clubId, content, ports, phaseMemo(state));
      const roster = ctx.roster();
      const cmds: Command[] = [];
      cmds.push(...renewals(ctx, roster));
      const out = releases(ctx, roster);
      for (const fighterId of out) cmds.push({ type: 'roster.release', clubId, fighterId });
      const kept = roster.filter((f) => !out.includes(f.id));
      cmds.push(...freeAgentOffers(ctx, kept, 0, 0));
      cmds.push(...rosterCommands(ctx, kept, 'week'));
      return cmds;
    },

    planSeasonEnd(state, clubId, content) {
      const ctx = new Ctx(state, clubId, content, ports, phaseMemo(state));
      const roster = ctx.roster();
      const cmds: Command[] = [];
      const trials = trialsSignings(ctx, roster);
      cmds.push(...trials.cmds);
      const over = roster.length + trials.signed - ctx.cap;
      if (over > 0) {
        const ranked = [...roster].sort((a, b) => ctx.value(a, roster) - ctx.value(b, roster) || byIdNumber(b, a));
        for (const f of ranked.slice(0, over)) cmds.push({ type: 'roster.release', clubId, fighterId: f.id });
      }
      const released = new Set(cmds.filter((c) => c.type === 'roster.release').map((c) => (c as { fighterId: FighterId }).fighterId));
      const kept = roster.filter((f) => !released.has(f.id));
      cmds.push(...freeAgentOffers(ctx, kept, trials.signed, trials.wages));
      cmds.push(...rosterCommands(ctx, kept, 'season-end'));
      return cmds;
    },

    chooseLineup(state, clubId, content) {
      const ctx = new Ctx(state, clubId, content, ports, freshMemo());
      return lineupFrom(ctx, ctx.roster());
    },

    valueFighter(state, clubId, fighterId, content) {
      const ctx = new Ctx(state, clubId, content, ports, freshMemo());
      const roster = ctx.roster();
      return ctx.value(ctx.fighter(fighterId), roster);
    },

    chooseCaptains(state, clubId, content, mode) {
      const ctx = new Ctx(state, clubId, content, ports, freshMemo());
      const roster = ctx.roster();
      const choice = lineupFrom(ctx, roster);
      return captainsFrom(ctx, roster, choice.fighters.map((e) => e.fighterId), mode);
    },

    planRoster(state, clubId, content) {
      const ctx = new Ctx(state, clubId, content, ports, freshMemo());
      return rosterCommands(ctx, ctx.roster(), 'season-end');
    },
  };
}
