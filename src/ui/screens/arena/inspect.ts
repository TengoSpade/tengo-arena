/**
 * The pause inspector's content (P-22, 05-technical-m2 §A5 "Pause inspector"; wording of mockups/arena-notes.md §6):
 * the rule that is committed, why it won (every rule in order: skipped with its reason and observed value, the fired one
 * marked, the rest "not reached", the stance last), what the fighter would decide NOW at the paused tick (the probe),
 * his state, statuses and cooldowns, Freshness and the rules fired so far. Pure: the screen hands in the viewer's
 * decision snapshot and the facade's probe, never a log.
 *
 * One number per cooldown: a probe at tick T shows the END of T, but its evaluation is the sim's decision at T+1
 * (WP-M2A's `evaluatedTick`), so a cooldown that a rule skipped on takes its "ready in" from the evaluation's trace;
 * the state's `cooldownTicks` fills in only the abilities no evaluated rule named.
 *
 * M2 shows both sides' rules (open-026); from M4 the viewing club's knowledge (P-13) will filter the opponent's.
 */
import type { ContentDB, RuleDef } from '../../../core/content';
import type { FightFighterInput, RuleTraceEntry } from '../../../core/model';
import type { UnitProbe } from '../../../core/sim';
import type { ArenaRoundContext, ArenaUnitInfo, DecisionSnapshot, PipKind, UnitRenderState } from '../../../render';
import { labelFor, penaltyText } from '../../m11/model';
import { ruleParts } from '../match-report/rule-sentence';
import { presetOfTactics } from './context';
import { nameOfUnit } from './feed';
import { clock, t } from './text';

const TICK_S = 0.05;
const seconds = (ticks: number): number => Math.ceil(ticks * TICK_S * 10) / 10;

/** A rule as the inspector shows it: the index, the definition (null for the stance and a forced decision) and the preset's stance name. */
export interface RuleRef {
  /** "R2", "S" (stance), "T" (forced by a taunt). */
  label: string;
  index: number;
  rule: RuleDef | null;
  stanceName: string | null;
  classId: string;
}

export interface WhyLine {
  ref: RuleRef;
  fired: boolean;
  /** False for the rules after the fired one and the stance when a rule fired. */
  reached: boolean;
  /** Bold lead and the rest of the sentence ("Out of range." "The target was 8.8 m away."); null on the fired rule. */
  why: { lead: string; text: string } | null;
}

export interface DecisionModel {
  ref: RuleRef;
  target: string | null;
  react: string;
  since: string;
  why: WhyLine[];
}

export interface NowModel {
  /** What he would decide now; null when he cannot evaluate (see blocked). */
  evaluation: { ref: RuleRef; target: string | null; same: boolean; why: WhyLine[] } | null;
  blocked: string | null;
  pending: string | null;
  /** The tick the evaluation is the decision of (seconds text), "deciding now (0:27.0)". */
  at: string;
  cooldowns: { name: string; text: string }[];
  statuses: { name: string; text: string; pip: PipKind | null }[];
}

export interface InspectorModel {
  unit: ArenaUnitInfo;
  isCaptain: boolean;
  vitals: { hp: number; maxHp: number; shield: number | null; focus: number | null; standing: boolean } | null;
  freshness: string | null;
  freshnessPenalty: string | null;
  decision: DecisionModel | null;
  now: NowModel | null;
  fires: { ref: RuleRef; count: number }[] | null;
}

const BLOCKED: Record<string, Parameters<typeof t>[0]> = {
  downed: 'blockedDowned',
  stunned: 'blockedStunned',
  asleep: 'blockedAsleep',
  displaced: 'blockedDisplaced',
  winding_up: 'blockedWindingUp',
  casting: 'blockedCasting',
  channelling: 'blockedChannelling',
  taunted: 'blockedTaunted',
  round_over: 'blockedRoundOver',
};

/** "R3", "S" for the stance, "T" for a forced (taunted) decision: the rule badge's labels (P-22). */
export function ruleLabel(rule: number, ruleCount: number): string {
  if (rule < 0) return 'T';
  return rule >= ruleCount ? 'S' : `R${rule + 1}`;
}

/** The pip a status category shows (mockups/arena-notes.md §1; the shield category has none: the bar segment). */
export function pipOfCategory(category: string | undefined): PipKind | null {
  switch (category) {
    case 'cc_hard':
      return 'control-hard';
    case 'cc_soft':
      return 'control-soft';
    case 'buff':
      return 'buff';
    case 'debuff':
      return 'debuff';
    case 'dot':
      return 'dot';
    case 'hot':
      return 'hot';
    case 'shield':
      return null;
    default:
      return 'special';
  }
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

function refOf(src: RuleSource | null, ruleCount: number, rule: number, classId: string): RuleRef {
  const def = src && rule >= 0 ? (src.rules[rule] ?? null) : null;
  return { label: ruleLabel(rule, ruleCount), index: rule, rule: def, stanceName: src && rule >= 0 && !def ? src.stanceName : null, classId };
}

/** Why a rule was skipped, in the wording of the notes (§6): a bold lead and a sentence. */
export function skipParts(entry: RuleTraceEntry, ctx?: { content: ContentDB; rule: RuleDef | null; classId: string }): { lead: string; text: string } {
  const reason = entry.reason ?? (entry.skip === 'condition_false' ? 'cond_false' : (entry.skip ?? ''));
  const observed = entry.observed ?? undefined;
  const slot = ctx?.rule ? (ctx.rule.then as { slot?: string }).slot : undefined;
  let abilityName = '';
  if (ctx && (slot === 'a1' || slot === 'a2')) {
    try {
      abilityName = ctx.content.classAbility(ctx.classId, slot).name;
    } catch {
      abilityName = '';
    }
  }
  const parts = ctx?.rule ? ruleParts(ctx.content, ctx.rule, ctx.classId) : null;
  switch (reason) {
    case 'cond_false':
    case 'condition_false': {
      const cond = entry.cond !== undefined ? parts?.conditions[entry.cond] : undefined;
      const n = entry.cond !== undefined ? entry.cond + 1 : null;
      const lead = n !== null ? t('skipCondLead', { n }) : t('skipCondLeadPlain');
      const text = [cond?.text ? `${cond.text}.` : '', observed !== undefined ? t('skipObserved', { v: observed }) : ''].filter(Boolean).join(' ');
      return { lead, text };
    }
    case 'rule_cooldown':
      return { lead: t('skipRuleCooldownLead'), text: entry.readyInTicks ? t('skipReadyIn', { s: seconds(entry.readyInTicks) }) : '' };
    case 'cooldown':
    case 'on_cooldown':
      return { lead: t('skipCooldownLead'), text: abilityName ? t('skipAbilityReady', { name: abilityName, s: seconds(entry.readyInTicks ?? 0) }) : t('skipReadyIn', { s: seconds(entry.readyInTicks ?? 0) }) };
    case 'no_focus':
      return { lead: t('skipNoFocusLead'), text: observed !== undefined ? t('skipFocusHad', { have: observed }) : '' };
    case 'silenced':
      return { lead: t('skipSilencedLead'), text: '' };
    case 'blocked':
      return { lead: t('skipBlockedLead'), text: '' };
    case 'no_target':
      return { lead: t('skipNoTargetLead'), text: parts?.selector ? t('skipNobody', { selector: parts.selector }) : '' };
    case 'only_filtered':
    case 'only_filtered_all':
      return { lead: t('skipFilteredLead'), text: parts?.only ? t('skipFilteredBy', { pred: parts.only }) : '' };
    case 'out_of_range':
      return { lead: t('skipRangeLead'), text: observed !== undefined ? t('skipGap', { m: Math.round(observed / 100) / 10 }) : '' };
    default:
      return { lead: reason.replace(/_/g, ' '), text: '' };
  }
}

/** Skip reason as one plain sentence (feed texts, tests). */
export function skipText(entry: RuleTraceEntry, ctx?: { content: ContentDB; rule: RuleDef | null; classId: string }): string {
  const p = skipParts(entry, ctx);
  return `${p.lead} ${p.text}`.trim();
}

function whyLines(src: RuleSource | null, content: ContentDB, ruleCount: number, trace: readonly RuleTraceEntry[], classId: string): WhyLine[] {
  const firedEntry = trace.find((e) => e.fired);
  const byRule = new Map(trace.map((e) => [e.rule, e]));
  const lines: WhyLine[] = [];
  // Every rule in order, then the stance; those after the fired one were never reached. A trace without the fired rule
  // (a forced decision) lists only what was recorded.
  const last = src ? ruleCount : Math.max(-1, ...trace.map((e) => e.rule));
  for (let i = 0; i <= last; i++) {
    const e = byRule.get(i);
    const ref = refOf(src, ruleCount, i, classId);
    if (!e) {
      lines.push({ ref, fired: false, reached: !firedEntry && i === ruleCount ? true : false, why: null });
    } else if (e.fired) {
      lines.push({ ref, fired: true, reached: true, why: null });
    } else {
      lines.push({ ref, fired: false, reached: true, why: skipParts(e, { content, rule: ref.rule, classId }) });
    }
  }
  return lines;
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
  /** The probe's tick and, when core provides it, the tick its evaluation is the decision of. */
  probeTick?: { tick: number; evaluatedTick?: number } | null;
  /** The unit's committed decisions up to the tick, when the viewer offers them (optional capability). */
  decisions?: readonly DecisionSnapshot[] | null;
  input: FightFighterInput | null;
}): InspectorModel | null {
  const { content, ctx, state, decision, probe } = args;
  const unit = ctx.units[args.unit];
  if (!unit) return null;
  const src = sourceOf(content, unit, args.input);
  const ruleCount = src?.rules.length ?? unit.ruleCount;
  const ref = (rule: number) => refOf(src, ruleCount, rule, unit.classId);
  const targetName = (u: number | null) => (u === null ? null : nameOfUnit(ctx, u));

  let decisionModel: DecisionModel | null = null;
  if (decision) {
    const ms = Math.round(decision.reactTicks * TICK_S * 1000);
    decisionModel = {
      ref: ref(decision.rule),
      target: targetName(decision.targetUnit),
      react: decision.reactCauses.length > 0 ? t('inspectReact', { ms, causes: decision.reactCauses.map((c) => c.replace(/_/g, ' ')).join(', ') }) : t('inspectReactNoCause', { ms }),
      since: t('inspectSince', { time: clock(decision.commitTick * TICK_S) }),
      why: whyLines(src, content, ruleCount, decision.trace, unit.classId),
    };
  }

  let now: NowModel | null = null;
  if (probe) {
    const ev = probe.evaluation;
    const evWhy = ev ? whyLines(src, content, ruleCount, ev.trace, unit.classId) : [];
    // "Ready in" from the evaluation's own trace, per ability slot, so one cooldown never shows two numbers.
    const traced: Partial<Record<'a1' | 'a2', number>> = {};
    if (ev && src) {
      for (const e of ev.trace) {
        const slot = (src.rules[e.rule]?.then as { slot?: string } | undefined)?.slot;
        if ((slot === 'a1' || slot === 'a2') && e.readyInTicks !== undefined && !(slot in traced)) traced[slot] = e.readyInTicks;
      }
    }
    const abilityOf = (slot: 'a1' | 'a2'): string => {
      try {
        return content.classAbility(unit.classId, slot).name;
      } catch {
        return slot;
      }
    };
    const evTick = args.probeTick?.evaluatedTick ?? args.probeTick?.tick ?? 0;
    now = {
      evaluation: ev ? { ref: ref(ev.rule), target: targetName(ev.target), same: decision !== null && decision.rule === ev.rule, why: evWhy } : null,
      blocked: probe.blockedBy ? (BLOCKED[probe.blockedBy] ? t(BLOCKED[probe.blockedBy]!) : probe.blockedBy.replace(/_/g, ' ')) : null,
      pending: probe.pending ? t('inspectPending', { action: refLabel(ref(probe.pending.rule)), time: clock(probe.pending.commitTick * TICK_S) }) : null,
      at: `${clock(Math.floor(evTick / 20))}.${Math.floor((evTick % 20) / 2)}`,
      cooldowns: (['a1', 'a2'] as const).map((slot) => {
        const ticks = traced[slot] ?? probe.cooldownTicks[slot];
        return { name: abilityOf(slot), text: ticks > 0 ? t('inspectIn', { s: seconds(ticks) }) : t('inspectReady') };
      }),
      statuses: probe.statuses.map((s) => ({
        name: `${content.statuses.get(s.status)?.name ?? s.status}${s.stacks > 1 ? ` ×${s.stacks}` : ''}`,
        text: `${seconds(s.ticksLeft)} s`,
        pip: pipOfCategory(content.statuses.get(s.status)?.category),
      })),
    };
  }

  const counts = args.decisions && src ? firesFrom(args.decisions, ruleCount) : null;
  const fresh = unit.freshness;
  return {
    unit,
    isCaptain: state?.isCaptain ?? false,
    vitals: state ? { hp: state.hp, maxHp: state.maxHp, shield: state.shield, focus: state.focus, standing: state.standing } : null,
    freshness: fresh === null ? null : t('inspectFresh', { n: fresh, label: labelFor(fresh, content).text }),
    freshnessPenalty: fresh === null ? null : penaltyText(fresh, content),
    decision: decisionModel,
    now,
    fires: counts ? counts.map((count, i) => ({ ref: ref(i), count })) : null,
  };
}

function refLabel(r: RuleRef): string {
  return r.label;
}
