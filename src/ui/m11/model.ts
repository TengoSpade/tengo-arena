/**
 * M1.1 reads for the screens (WP-D): Freshness with its forecast, level and XP bar, level-up option
 * texts, perk eligibility, rank summaries. Pure functions over state and content. Core owns the
 * rules (progression.md, combat-skills.md); where a core read is still a stub (WP-B / WP-C not
 * merged) the documented formula is computed here from the same content values, so the screens show
 * the real numbers either way.
 *
 * Lazy-only: imported by screens and the M1.1 dialogs, never by the startup path.
 */
import type { ContentDB } from '../../core/content';
import type { FighterView } from '../../core/game';
import type { AbilityId, Fighter, FreshnessLabel, GameState, LevelOption, PerkId, RankableSlot, StatId } from '../../core/model';
import type { TipContent } from '../components';
import { safeView, type GameEngine } from '../store/engine';
import { fighterViewOf } from '../store/views';

// ---- small helpers ------------------------------------------------------------------------------------------

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/** Step table lookup ([key, value] pairs): the entry with the largest key <= x. */
export function stepValue(table: readonly (readonly [number, number])[], x: number): number {
  let v = table[0]?.[1] ?? 1;
  for (const [k, val] of table) if (x >= k) v = val;
  return v;
}

export function humanAgeOf(fighter: Fighter, content: ContentDB): number {
  const lifespan = content.races.get(fighter.raceId)?.lifespan ?? 80;
  return (fighter.age * 80) / lifespan;
}

/** Effective stats (with wear, traits and statuses) from the engine's fighter view; train100 as a fallback. */
export function effectiveStats(engine: GameEngine, state: GameState, content: ContentDB, fighter: Fighter): Record<string, number> {
  const v = fighterViewOf(engine, state, content, fighter.id);
  if (v) return v.stats;
  const out: Record<string, number> = {};
  for (const [k, x] of Object.entries(fighter.train100 ?? {})) out[k] = Math.max(1, Math.floor(x / 100));
  return out;
}

// ---- Freshness (sys-freshness, sys-fight-freshness) ------------------------------------------------------

export interface FreshInfo {
  /** 0-100. */
  value: number;
  label: FreshnessLabel;
  labelText: string;
  threshold: number;
  /** Points lost in a typical round (intensity 1.0). */
  drain: number;
  /** Points regained in a week with no round started. */
  rest: number;
  /** Typical rounds he can still start at or above the threshold. */
  readyRounds: number;
  /** Freshness after a typical match (2.5 rounds), never below 0. */
  afterMatch: number;
  /** Penalty severity at a round start now (0 = none, 1 = full). */
  severity: number;
  /** Injury chance multiplier at a round start now (1 = none). */
  injuryMult: number;
}

export const ROUNDS_PER_MATCH = 2.5;

export function freshnessValue(fighter: Pick<Fighter, 'freshness10'>): number {
  const v = typeof fighter.freshness10 === 'number' ? fighter.freshness10 : 1000;
  return Math.floor(clamp(v, 0, 1000) / 10);
}

export function labelFor(value: number, content: ContentDB): { id: FreshnessLabel; text: string } {
  const labels = content.levels.freshness.labels;
  for (const l of labels) if (value >= l.min) return { id: l.id, text: l.label };
  const last = labels[labels.length - 1]!;
  return { id: last.id, text: last.label };
}

/** Typical drain per round, points (levels.json freshness; engine.typicalRoundDrain10 when implemented). */
export function typicalDrain(engine: GameEngine, state: GameState, content: ContentDB, fighter: Fighter): number {
  const fromCore = engine.typicalRoundDrain10 ? safeView<number | null>(() => engine.typicalRoundDrain10!(fighter, content), null) : null;
  if (fromCore !== null) return fromCore / 10;
  const fr = content.levels.freshness;
  const sta = effectiveStats(engine, state, content, fighter)['stamina'] ?? 10;
  let d = clamp(fr.drainAt0 + fr.drainPerStaminaPoint * sta, fr.drainMin, fr.drainMax);
  if (humanAgeOf(fighter, content) < fr.youngHumanAgeBelow) d *= fr.youngDrainMult;
  for (const id of fighter.perkIds ?? []) {
    for (const e of content.perks.get(id)?.lifecycleEffects ?? []) if (e.type === 'freshnessDrainMult') d *= e.mult;
  }
  return Math.round(d * 10) / 10;
}

/** Rest per week without a round started, points (engine.weeklyRest10 when implemented). */
export function weeklyRest(engine: GameEngine, state: GameState, content: ContentDB, fighter: Fighter, asSquadReserve = false): number {
  const fromCore = engine.weeklyRest10 ? safeView<number | null>(() => engine.weeklyRest10!(fighter, content, asSquadReserve), null) : null;
  if (fromCore !== null) return fromCore / 10;
  const fr = content.levels.freshness;
  const sta = effectiveStats(engine, state, content, fighter)['stamina'] ?? 10;
  const r = (fr.restAt0 + fr.restPerStaminaPoint * sta) * stepValue(fr.recoveryAgeMult, humanAgeOf(fighter, content)) * (asSquadReserve ? fr.squadReserveRestShare : 1);
  return Math.round(r * 10) / 10;
}

export function severityAt(value: number, content: ContentDB): number {
  const f = content.combat.freshness;
  return clamp((f.thresholdBelow - value) / (f.thresholdBelow - f.fullPenaltyAtOrBelow), 0, 1);
}

export function injuryMultAt(value: number, content: ContentDB): number {
  const fr = content.levels.freshness;
  if (value >= fr.threshold) return 1;
  return Math.min(fr.injuryMultMax, 1 + fr.injuryMultPerPointBelow * (fr.threshold - value));
}

/** Typical rounds started at or above the threshold from `value` with `drain` per round. */
export function readyRoundsFrom(value: number, drain: number, threshold: number): number {
  if (value < threshold) return 0;
  if (drain <= 0) return 99;
  return Math.floor((value - threshold) / drain) + 1;
}

export function freshInfo(engine: GameEngine, state: GameState, content: ContentDB, fighter: Fighter): FreshInfo {
  const value = freshnessValue(fighter);
  const { id, text } = labelFor(value, content);
  const threshold = content.levels.freshness.threshold;
  const drain = typicalDrain(engine, state, content, fighter);
  return {
    value,
    label: id,
    labelText: text,
    threshold,
    drain,
    rest: weeklyRest(engine, state, content, fighter),
    readyRounds: readyRoundsFrom(value, drain, threshold),
    afterMatch: Math.max(0, Math.round(value - ROUNDS_PER_MATCH * drain)),
    severity: severityAt(value, content),
    injuryMult: injuryMultAt(value, content),
  };
}

/** The penalty at a round start from this Freshness, as short words ("−4% attack speed, −3% Power…"). */
export function penaltyText(value: number, content: ContentDB): string | null {
  const s = severityAt(value, content);
  if (s <= 0) return null;
  const p = content.combat.freshness.penaltyAtFull;
  const pct = (x: number) => `${x > 0 ? '+' : '−'}${Math.abs(Math.round(x * s * 1000) / 10)}%`;
  return `${pct(p.attackSpeed)} attack speed · ${pct(p.moveSpeed)} move speed · ${pct(p.power)} Power and Support · ${pct(p.reactionDelay)} reaction delay`;
}

// ---- levels and XP (sys-development) -----------------------------------------------------------------------

export interface LevelInfo {
  level: number;
  xpInto: number;
  xpNeeded: number;
  /** 0..1 of the bar. */
  frac: number;
  /** "Next level in ≈ N matches" (null when nothing is expected). */
  eta: number | null;
  pending: number;
  levelsThisSeason: number;
}

/** Club matches played this season (bench XP accrues per club match). */
function clubMatchesThisSeason(state: GameState, clubId: string | null): number {
  if (!clubId) return 0;
  let n = 0;
  for (const r of Object.values(state.results)) if (r.season === state.calendar.season && (r.homeClubId === clubId || r.awayClubId === clubId)) n++;
  return n;
}

export function levelInfo(engine: GameEngine, state: GameState, content: ContentDB, fighter: Fighter): LevelInfo {
  const xpNeeded = Math.max(1, fighter.xpNeeded ?? 1);
  const xpInto = Math.max(0, fighter.xpIntoLevel ?? 0);
  const remaining = Math.max(0, xpNeeded - xpInto);
  const fromCore = engine.levelEtaMatches ? safeView<number | null | undefined>(() => engine.levelEtaMatches!(fighter, content), undefined) : undefined;
  let eta: number | null;
  if (fromCore !== undefined) eta = fromCore;
  else {
    const club = fighter.clubId ? state.clubs[fighter.clubId] : undefined;
    const starter = !!club?.lineup.fighters.some((e) => e.fighterId === fighter.id);
    const matches = clubMatchesThisSeason(state, fighter.clubId);
    const mean = matches > 0 && (fighter.season?.xp ?? 0) > 0 ? fighter.season.xp / matches : starter ? 32 : 11;
    eta = fighter.status === 'active' && fighter.clubId ? Math.max(1, Math.ceil(remaining / mean)) : null;
  }
  return {
    level: fighter.level ?? 1,
    xpInto,
    xpNeeded,
    frac: clamp(xpInto / xpNeeded, 0, 1),
    eta,
    pending: fighter.pendingLevelUps?.length ?? 0,
    levelsThisSeason: fighter.season?.levelLog?.length ?? 0,
  };
}

// ---- level-up options, ranks and perks -----------------------------------------------------------------------

export function statName(content: ContentDB, stat: StatId | string): string {
  return content.stats.get(stat)?.name ?? stat;
}

export function abilityName(content: ContentDB, abilityId: AbilityId | string, rank?: number): string {
  const base = content.abilities.get(abilityId)?.name ?? abilityId;
  return rank && rank > 1 ? `${base} ${rank === 2 ? 'II' : 'III'}` : base;
}

/** The rank row's one-line summary of going to `toRank` ("cooldown 9 → 8 s"). */
export function rankSummary(content: ContentDB, abilityId: AbilityId | string, toRank: number): string | null {
  return content.abilityRanks(abilityId)?.ranks.find((r) => r.rank === toRank)?.summary ?? null;
}

export function slotAbility(content: ContentDB, fighter: Fighter, slot: RankableSlot): AbilityId | null {
  const klass = content.classes.get(fighter.classId);
  if (!klass) return null;
  const abilities = klass.abilities as unknown as Record<string, string | undefined>;
  const id = abilities[slot];
  return (id as AbilityId | undefined) ?? null;
}

const ROMAN = ['', 'I', 'II', 'III'];
export function tierRoman(tier: number): string {
  return ROMAN[tier] ?? String(tier);
}

export interface PerkCheck {
  eligible: boolean;
  /** Why not (empty when eligible). */
  reasons: string[];
}

/** Can this perk be offered to him now (combat-skills.md sys-perks eligibility, in the UI's words)? */
export function perkCheck(content: ContentDB, fighter: Fighter, stats: Record<string, number>, perkId: PerkId | string): PerkCheck {
  const perk = content.perks.get(perkId);
  if (!perk) return { eligible: false, reasons: ['Unknown perk'] };
  const rules = content.perkRules;
  const held = fighter.perkIds ?? [];
  const reasons: string[] = [];
  if (held.includes(perk.id as PerkId)) return { eligible: false, reasons: ['Already held'] };
  const archetypes = content.classes.get(fighter.classId)?.archetypes ?? [];
  if (perk.archetype !== 'general' && !(archetypes as readonly string[]).includes(perk.archetype)) reasons.push('Not his archetype');
  if (held.length >= rules.perkCap) reasons.push(`He holds the maximum of ${rules.perkCap} perks`);
  const heldTier3 = held.filter((id) => content.perks.get(id)?.tier === 3).length;
  if (perk.tier === 3 && heldTier3 >= rules.maxTier3) reasons.push(`Only ${rules.maxTier3} tier III perk allowed`);
  const need = perk.requires.minPerksHeld;
  if (held.length < need) reasons.push(`Needs ${need} perk${need === 1 ? '' : 's'} held first`);
  if (perk.requires.anyPerks.length > 0 && !perk.requires.anyPerks.some((p) => held.includes(p as PerkId))) {
    reasons.push(`Needs one of: ${perk.requires.anyPerks.map((p) => content.perks.get(p)?.name ?? p).join(', ')}`);
  }
  for (const [stat, min] of Object.entries(perk.requires.minStats ?? {})) {
    if ((stats[stat] ?? 0) < (min ?? 0)) reasons.push(`${statName(content, stat)} ${min} or more`);
  }
  const blocked = perk.exclusiveWith.find((p) => held.includes(p as PerkId));
  if (blocked) reasons.push(`Excludes ${content.perks.get(blocked)?.name ?? blocked}`);
  return { eligible: reasons.length === 0, reasons };
}

/** Requirements of a perk as words ("Needs 1 perk held · LDR 12+ · one of Banner Voice"), or null. */
export function perkRequiresText(content: ContentDB, perkId: PerkId | string): string | null {
  const perk = content.perks.get(perkId);
  if (!perk) return null;
  const parts: string[] = [];
  if (perk.requires.minPerksHeld > 0) parts.push(`needs ${perk.requires.minPerksHeld} perk${perk.requires.minPerksHeld === 1 ? '' : 's'} held`);
  if (perk.requires.anyPerks.length) parts.push(`one of ${perk.requires.anyPerks.map((p) => content.perks.get(p)?.name ?? p).join(' or ')}`);
  for (const [stat, min] of Object.entries(perk.requires.minStats ?? {})) parts.push(`${statName(content, stat)} ${min}+`);
  if (perk.exclusiveWith.length) parts.push(`not with ${perk.exclusiveWith.map((p) => content.perks.get(p)?.name ?? p).join(', ')}`);
  return parts.length ? parts.join(' · ') : null;
}

export interface OptionText {
  kind: LevelOption['kind'];
  title: string;
  /** current → new with the real effect ("10.4 → 11.3 (+0.9)" for a stat), the rank step ("II → III") or the perk tier. */
  change: string;
  detail: string;
  /** Why this option was offered. */
  why: string;
  /** Stat picks: what the pick really does and why it can be less than +1 (the whole-number stat only moves when the fraction crosses a point). */
  tip?: TipContent;
}

/**
 * What a stat pick really does to the shown stat. The trained value is kept in hundredths (train100): a
 * pick adds +1.00, or only the room left under his ceiling (cap100 = his potential in that stat), and
 * the stat shown everywhere is the whole-number part (10.4 shows as 10). Age wear is subtracted
 * from the trained value, so it moves the fraction too. Centipoints on the shown scale (traits and
 * statuses included as whole points).
 */
export interface StatPickEffect {
  now100: number;
  after100: number;
  /** What the pick adds to the shown value (≤ 100). */
  gain100: number;
  /** Room under his ceiling before the pick. */
  room100: number;
  wear100: number;
  wholeNow: number;
  wholeAfter: number;
  /** The shown whole-number stat rises. */
  crosses: boolean;
}

export function statPickEffect(fighter: Fighter, stats: Record<string, number>, stat: StatId | string, gain100: number, statMax = 20): StatPickEffect {
  const train = fighter.train100[stat as StatId] ?? 0;
  const cap = fighter.cap100[stat as StatId] ?? 0;
  const wear = fighter.wear100?.[stat as StatId] ?? 0;
  const room = Math.max(0, cap - train);
  const gain = Math.min(gain100, room);
  const base = Math.max(100, train - wear);
  const baseAfter = Math.max(100, train + gain - wear);
  const shown = stats[stat];
  // Whole points from traits and statuses sit on top of the trained value.
  const extra = shown === undefined ? 0 : shown - Math.floor(base / 100);
  const now100 = base + 100 * extra;
  const after100 = baseAfter + 100 * extra;
  const wholeNow = shown ?? Math.floor(now100 / 100);
  const wholeAfter = Math.min(statMax, Math.max(wholeNow, Math.floor(after100 / 100)));
  return { now100, after100, gain100: after100 - now100, room100: room, wear100: wear, wholeNow, wholeAfter, crosses: wholeAfter > wholeNow };
}

/** One decimal of a centipoint value, never showing a whole number the stat has not reached ("10.96" reads "10.9"). */
export function fmtPoints(v100: number): string {
  const whole = Math.floor(v100 / 100);
  const tenth = Math.round(v100 / 10) / 10;
  return (tenth >= whole + 1 ? whole + 0.9 : tenth).toFixed(1);
}

/** "+0.9": the difference of the two shown values, so the numbers on the card always add up. */
export function fmtGain(now100: number, after100: number): string {
  const d = Math.round((Number(fmtPoints(after100)) - Number(fmtPoints(now100))) * 10) / 10;
  // A sliver (under 0.05) would read "+0.0": say it in hundredths.
  return d === 0 && after100 > now100 ? `+${((after100 - now100) / 100).toFixed(2)}` : `+${d.toFixed(1)}`;
}

/** Words for one level-up option (the dialog, the digest and the season review). */
export function optionText(content: ContentDB, fighter: Fighter, stats: Record<string, number>, option: LevelOption): OptionText {
  if (option.kind === 'stat') {
    const eff = statPickEffect(fighter, stats, option.stat, option.gain100, content.development.scale.statMax);
    const now = eff.wholeNow;
    const klass = content.classes.get(fighter.classId);
    const weight = (klass?.ratingWeights as Record<string, number> | undefined)?.[option.stat] ?? 0;
    // On the shown scale (traits and race included): the shown value plus the trainable room left.
    const cap = now + Math.max(0, Math.round(((fighter.cap100[option.stat] ?? 0) - (fighter.train100[option.stat] ?? 0)) / 100));
    const group = content.stats.get(option.stat)?.group;
    const emphasis = fighter.trainingEmphasis;
    const why = [
      weight >= 0.1 ? `key stat for a ${klass?.name ?? 'fighter'} (${Math.round(weight * 100)}% of rating)` : `${Math.round(weight * 100)}% of his rating`,
      emphasis !== 'balanced' && ((emphasis === 'body' && group === 'physical') || (emphasis === 'mind' && group === 'mental')) ? `${emphasis === 'body' ? 'Body' : 'Mind'} training` : null,
      `room to ${cap}`,
    ]
      .filter(Boolean)
      .join(' · ');
    const name = statName(content, option.stat);
    const gain = fmtGain(eff.now100, eff.after100);
    const partial = eff.gain100 < 100;
    const detail = eff.crosses
      ? `${name} rises to ${eff.wholeAfter}`
      : eff.wholeNow >= (content.development.scale.statMax ?? 20)
        ? `${name} is at the top of the scale`
        : `${name} stays ${eff.wholeNow}: ${gain} toward ${eff.wholeNow + 1}`;
    const tip: TipContent = {
      kicker: 'Stat pick',
      title: `${name} ${fmtPoints(eff.now100)} → ${fmtPoints(eff.after100)} (${gain})`,
      body: partial
        ? `A stat pick adds +1.0 to his trained value, but never past his ceiling for ${name} (his potential in it, fixed when he was generated). Only ${(eff.room100 / 100).toFixed(2)} was left, so this pick adds ${(eff.gain100 / 100).toFixed(2)} and ${name} is then at its ceiling. ${eff.crosses ? 'That still crosses the next whole point.' : `The shown ${name} stays ${eff.wholeNow} until the fraction reaches ${eff.wholeNow + 1}.0.`}`
        : `A stat pick adds +1.0 to his trained value, so the shown ${name} rises by one whole point.`,
      rows: [
        { label: 'Shown now', value: fmtPoints(eff.now100) },
        { label: 'Pick adds', value: `${(eff.gain100 / 100).toFixed(2)} of a possible 1.00` },
        { label: 'Room under his ceiling', value: (eff.room100 / 100).toFixed(2) },
        ...(eff.wear100 > 0 ? [{ label: 'Age wear, already taken off', value: `−${(eff.wear100 / 100).toFixed(2)}` }] : []),
      ],
      meta: 'The stat shown everywhere is the whole-number part: 10.4 shows as 10.',
    };
    return { kind: 'stat', title: name, change: `${fmtPoints(eff.now100)} → ${fmtPoints(eff.after100)} (${gain})`, detail, why: partial ? `${why} · only ${(eff.room100 / 100).toFixed(2)} under his ceiling` : why, tip };
  }
  if (option.kind === 'rank') {
    const from = option.toRank - 1;
    return {
      kind: 'rank',
      title: abilityName(content, option.abilityId, option.toRank),
      change: `${tierRoman(from)} → ${tierRoman(option.toRank)}`,
      detail: rankSummary(content, option.abilityId, option.toRank) ?? 'Next rank',
      why: `Ability rank (${option.slot === 'passive' ? 'passive' : option.slot === 'a1' ? 'first ability' : 'second ability'})`,
    };
  }
  const perk = content.perks.get(option.perkId);
  const req = perkRequiresText(content, option.perkId);
  return {
    kind: 'perk',
    title: perk?.name ?? option.perkId,
    change: `Perk · tier ${tierRoman(perk?.tier ?? 1)}`,
    detail: perk?.text ?? '',
    why: [perk?.archetype === 'general' ? 'General perk' : `${content.vocabulary.roles.find((r) => r.id === perk?.archetype)?.name ?? perk?.archetype} perk`, req].filter(Boolean).join(' · '),
  };
}

/** One line for a resolved pick ("+1 Power", "Shield Bash II", "perk Quick Hands"). */
export function pickLine(content: ContentDB, option: LevelOption | null): string {
  if (!option) return 'empty level';
  // A pick at the ceiling adds only the room left: "+0.87 Strength" (a full pick reads "+1 Strength").
  if (option.kind === 'stat') return `${option.gain100 >= 100 ? '+1' : `+${(option.gain100 / 100).toFixed(2)}`} ${statName(content, option.stat)}`;
  if (option.kind === 'rank') return abilityName(content, option.abilityId, option.toRank);
  return `perk ${content.perks.get(option.perkId)?.name ?? option.perkId}`;
}

// ---- effective rating (AL-R002-T002 / T004) -----------------------------------------------------------------

/**
 * A fighter's rating and what it is worth at his Freshness now. Below the Freshness threshold he fights with a
 * penalty (attack and move speed, Power, Support, reaction); core prices it as the effective rating
 * (core/fighters freshness-rating.ts, on `FighterView.effectiveRating`), shown as "45 → 41" wherever the
 * rating sits next to a Freshness meter.
 */
export interface RatingNow {
  rating: number;
  /** Rating at the Freshness he has now (never above `rating`). */
  effective: number;
  /** rating − effective (0 when rested). */
  drop: number;
  /** Freshness 0-100 the figure is for. */
  freshness: number;
  label: FreshnessLabel;
  labelText: string;
  /** Where the loss comes from, largest first (rating points, negative): attack speed, move speed, Power, Support, reaction. */
  parts: { label: string; points: number }[];
}

const PART_LABELS: Record<string, string> = { attackSpeed: 'Attack speed', moveSpeed: 'Move speed', power: 'Power', support: 'Support', reaction: 'Reaction time' };

/** From a core fighter view; a view without the effective figure (a stand-in engine) reads as no penalty. */
export function ratingFromView(content: ContentDB, view: FighterView, fighter: Fighter): RatingNow {
  const freshness = view.freshness ?? freshnessValue(fighter);
  const { id, text } = labelFor(freshness, content);
  const effective = Math.min(view.rating, view.effectiveRating ?? view.rating);
  const parts = Object.entries(view.freshnessRating?.parts ?? {})
    .map(([key, points]) => ({ label: PART_LABELS[key] ?? key, points }))
    .filter((p) => p.points <= -0.05)
    .sort((a, b) => a.points - b.points);
  return { rating: view.rating, effective, drop: view.rating - effective, freshness, label: id, labelText: text, parts };
}

export function ratingNow(engine: GameEngine, state: GameState, content: ContentDB, fighter: Fighter): RatingNow | null {
  const view = fighterViewOf(engine, state, content, fighter.id);
  return view ? ratingFromView(content, view, fighter) : null;
}

