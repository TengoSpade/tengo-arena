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
import type { AbilityId, Fighter, FreshnessLabel, GameState, LevelOption, PerkId, RankableSlot, StatId } from '../../core/model';
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
  /** current → new ("12 → 13"), the rank step ("II → III") or the perk tier. */
  change: string;
  detail: string;
  /** Why this option was offered. */
  why: string;
}

/** Words for one level-up option (the dialog, the digest and the season review). */
export function optionText(content: ContentDB, fighter: Fighter, stats: Record<string, number>, option: LevelOption): OptionText {
  if (option.kind === 'stat') {
    const now = stats[option.stat] ?? Math.floor((fighter.train100[option.stat] ?? 0) / 100);
    const gain = Math.max(1, Math.round(option.gain100 / 100));
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
    return { kind: 'stat', title: statName(content, option.stat), change: `${now} → ${now + gain}`, detail: `+${gain} ${statName(content, option.stat)}`, why };
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
  if (option.kind === 'stat') return `+${Math.max(1, Math.round(option.gain100 / 100))} ${statName(content, option.stat)}`;
  if (option.kind === 'rank') return abilityName(content, option.abilityId, option.toRank);
  return `perk ${content.perks.get(option.perkId)?.name ?? option.perkId}`;
}
