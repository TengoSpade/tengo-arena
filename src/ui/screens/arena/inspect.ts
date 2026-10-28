/**
 * The pause inspector's content (P-22, 05-technical-m2 §A5 "Pause inspector"): the rule that is committed as a
 * sentence, why it won (every earlier rule's skip reason, the observed value, the ready-in time), what the fighter
 * would decide NOW at the paused tick (the probe), his statuses and cooldowns, Freshness and the rules fired so far.
 * Pure: the screen hands in the viewer's decision snapshot and the facade's probe, never a log.
 *
 * M2 shows both sides' rules (open-026); from M4 the viewing club's knowledge (P-13) will filter the opponent's.
 */
import type { ContentDB, RuleDef } from '../../../core/content';
import type { FightFighterInput, RuleTraceEntry } from '../../../core/model';
import type { UnitProbe } from '../../../core/sim';
import type { ArenaRoundContext, ArenaUnitInfo, DecisionSnapshot, UnitRenderState } from '../../../render';
import { penaltyText } from '../../m11/model';
import { ruleText } from '../match-report/rule-sentence';
import { presetOfTactics } from './context';
import { nameOfUnit } from './feed';
import { t, clock } from './text';

const TICK_S = 0.05;

export interface TraceLine {
  /** "R2", "S" (stance). */
  label: string;
  sentence: string;
  fired: boolean;
  /** Why it was skipped, in words; null on the fired rule. */
  why: string | null;
}

export interface DecisionModel {
  label: string;
  sentence: string;
  target: string | null;
  react: string;
  trace: TraceLine[];
}

export interface NowModel {
  /** What he would decide now; null when he cannot evaluate (see blocked). */
  evaluation: { label: string; sentence: string; target: string | null; same: boolean; trace: TraceLine[] } | null;
  blocked: string | null;
  pending: string | null;
  cooldowns: { name: string; text: string }[];
  statuses: { name: string; text: string }[];
}

export interface InspectorModel {
  unit: ArenaUnitInfo;
  isCaptain: boolean;
  vitals: { hp: number; maxHp: number; shield: number | null; focus: number | null; standing: boolean } | null;
  freshness: string | null;
  freshnessPenalty: string | null;
  decision: DecisionModel | null;
  now: NowModel | null;
  fires: { label: string; sentence: string; count: number }[] | null;
}

const SKIP_REASON: Record<string, Parameters<typeof t>[0]> = {
  rule_cooldown: 'skipRuleCooldown',
  cooldown: 'skipCooldown',
  on_cooldown: 'skipCooldown',
  no_focus: 'skipNoFocus',
  silenced: 'skipSilenced',
  blocked: 'skipBlocked',
  no_target: 'skipNoTarget',
  only_filtered: 'skipFiltered',
  only_filtered_all: 'skipFiltered',
  out_of_range: 'skipOutOfRange',
};

const BLOCKED: Record<string, Parameters<typeof t>[0]> = {
  downed: 'blockedDowned',
  stunned: 'blockedStunned',
  asleep: 'blockedAsleep',
  displaced: 'blockedDisplaced',
  winding_up: 'blockedWindingUp',
  casting: 'blockedCasting',
  channelling: 'blockedChannelling',
  taunted: 'blockedTaunted',
};

/** "R3", "S" for the stance, "T" for a forced (taunted) decision: the rule badge's labels (P-22). */
export function ruleLabel(rule: number, ruleCount: number): string {
  if (rule < 0) return 'T';
  return rule >= ruleCount ? 'S' : `R${rule + 1}`;
}

/** Why a rule was skipped, in words, from its recorded trace entry. */
export function skipText(entry: RuleTraceEntry): string {
  const reason = entry.reason ?? (entry.skip === 'condition_false' ? 'cond_false' : (entry.skip ?? ''));
  if (reason === 'cond_false' || reason === 'condition_false') {
    return entry.cond !== undefined && entry.observed !== undefined && entry.observed !== null
      ? t('skipConditionFalseAt', { n: entry.cond + 1, seen: entry.observed })
      : t('skipConditionFalse');
  }
  if ((reason === 'cooldown' || reason === 'on_cooldown') && entry.readyInTicks !== undefined && entry.readyInTicks > 0) {
    return t('skipCooldownIn', { s: Math.ceil(entry.readyInTicks * TICK_S * 10) / 10 });
  }
  const key = SKIP_REASON[reason];
  return key ? t(key) : reason.replace(/_/g, ' ');
}

interface RuleSource {
  rules: readonly RuleDef[];
  stanceName: string;
  classId: string;
}

function sourceOf(content: ContentDB, unit: ArenaUnitInfo, input: FightFighterInput | null): RuleSource | null {
  const preset = presetOfTactics(content, input?.tactics);
  if (!preset) return null;
  const stance = content.vocabulary.stances.find((s) => s.id === preset.stance)?.name ?? preset.stance;
  return { rules: preset.rules, stanceName: stance, classId: unit.classId };
}

function sentenceOf(content: ContentDB, src: RuleSource | null, rule: number): string {
  if (rule < 0) return t('blockedTaunted');
  if (!src) return ruleLabel(rule, 99);
  const def = src.rules[rule];
  if (def) return ruleText(content, def, src.classId);
  return t('inspectStance', { name: src.stanceName });
}

function traceLines(content: ContentDB, src: RuleSource | null, ruleCount: number, trace: readonly RuleTraceEntry[]): TraceLine[] {
  return trace.map((e) => ({
    label: ruleLabel(e.rule, ruleCount),
    sentence: sentenceOf(content, src, e.rule),
    fired: e.fired,
    why: e.fired ? null : skipText(e),
  }));
}

/** Rules fired so far (committed decisions per rule) from the viewer's decisions up to the shown tick. */
export function firesFrom(decisions: readonly DecisionSnapshot[], ruleCount: number): number[] {
  const counts = Array.from({ length: ruleCount + 1 }, () => 0);
  for (const d of decisions) if (d.rule >= 0 && d.rule <= ruleCount) counts[d.rule] = (counts[d.rule] ?? 0) + 1;
  return counts;
}

export function inspectorModel(args: {
  content: ContentDB;
  ctx: ArenaRoundContext;
  unit: number;
  state: UnitRenderState | null;
  decision: DecisionSnapshot | null;
  probe: UnitProbe | null;
  /** The unit's committed decisions up to the tick, when the viewer offers them (optional capability). */
  decisions?: readonly DecisionSnapshot[] | null;
  input: FightFighterInput | null;
}): InspectorModel | null {
  const { content, ctx, state, decision, probe } = args;
  const unit = ctx.units[args.unit];
  if (!unit) return null;
  const src = sourceOf(content, unit, args.input);
  const ruleCount = src?.rules.length ?? unit.ruleCount;
  const label = (rule: number) => ruleLabel(rule, ruleCount);
  const targetName = (u: number | null) => (u === null ? null : nameOfUnit(ctx, u));

  let decisionModel: DecisionModel | null = null;
  if (decision) {
    const ms = Math.round(decision.reactTicks * TICK_S * 1000);
    decisionModel = {
      label: label(decision.rule),
      sentence: sentenceOf(content, src, decision.rule),
      target: targetName(decision.targetUnit),
      react: decision.reactCauses.length > 0 ? t('inspectReact', { ms, causes: decision.reactCauses.map((c) => c.replace(/_/g, ' ')).join(', ') }) : t('inspectReactNoCause', { ms }),
      trace: traceLines(content, src, ruleCount, decision.trace),
    };
  }

  let now: NowModel | null = null;
  if (probe) {
    const ev = probe.evaluation;
    const abilityOf = (slot: 'a1' | 'a2'): string => {
      try {
        return content.classAbility(unit.classId, slot).name;
      } catch {
        return slot;
      }
    };
    now = {
      evaluation: ev
        ? { label: label(ev.rule), sentence: sentenceOf(content, src, ev.rule), target: targetName(ev.target), same: decision !== null && decision.rule === ev.rule, trace: traceLines(content, src, ruleCount, ev.trace) }
        : null,
      blocked: probe.blockedBy ? (BLOCKED[probe.blockedBy] ? t(BLOCKED[probe.blockedBy]!) : probe.blockedBy.replace(/_/g, ' ')) : null,
      pending: probe.pending ? t('inspectPending', { action: sentenceOf(content, src, probe.pending.rule), time: clock(probe.pending.commitTick * TICK_S) }) : null,
      cooldowns: (['a1', 'a2'] as const).map((slot) => {
        const ticks = probe.cooldownTicks[slot];
        return { name: abilityOf(slot), text: ticks > 0 ? t('inspectIn', { s: Math.ceil(ticks * TICK_S * 10) / 10 }) : t('inspectReady') };
      }),
      statuses: probe.statuses.map((s) => ({
        name: `${content.statuses.get(s.status)?.name ?? s.status}${s.stacks > 1 ? ` ×${s.stacks}` : ''}`,
        text: `${Math.ceil(s.ticksLeft * TICK_S * 10) / 10}s`,
      })),
    };
  }

  const counts = args.decisions && src ? firesFrom(args.decisions, ruleCount) : null;
  const fresh = unit.freshness;
  return {
    unit,
    isCaptain: state?.isCaptain ?? false,
    vitals: state ? { hp: state.hp, maxHp: state.maxHp, shield: state.shield, focus: state.focus, standing: state.standing } : null,
    freshness: fresh === null ? null : t('inspectFresh', { n: fresh, label: unit.fatigueTag ?? '' }).replace(/ · $/, ''),
    freshnessPenalty: fresh === null ? null : penaltyText(fresh, content),
    decision: decisionModel,
    now,
    fires: counts ? counts.map((count, i) => ({ label: label(i), sentence: sentenceOf(content, src, i), count })) : null,
  };
}

