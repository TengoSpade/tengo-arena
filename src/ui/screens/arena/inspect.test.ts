import { describe, expect, it } from 'vitest';
import type { RuleTraceEntry } from '../../../core/model';
import { fixtureContent } from '../../../core/testkit';
import type { DecisionSnapshot } from '../../../render';
import { buildRoundContext, fightInputOf, presetOfTactics } from './context';
import { firesFrom, inspectorModel, ruleLabel, skipParts, skipText } from './inspect';
import { readArenaPalette } from './palette';
import { fakeTimeline } from './testing/fake-timeline';
import { liveWatchState, probeOf, roundPlaybackOf, watchWorld } from '../../debug/arena-test-world';

const content = fixtureContent();
const w = watchWorld(content);
const state = liveWatchState(w);
const playback = roundPlaybackOf(state, content, 'live', 1);
const ctx = buildRoundContext({ state, content, playback, match: null, palette: readArenaPalette('dark'), startTick: 0 });

describe('rule labels and skip reasons (P-22; wording of arena-notes §6)', () => {
  it('labels the committed rule R1.., the stance S and a forced decision T', () => {
    expect(ruleLabel(0, 4)).toBe('R1');
    expect(ruleLabel(3, 4)).toBe('R4');
    expect(ruleLabel(4, 4)).toBe('S');
    expect(ruleLabel(-1, 4)).toBe('T');
  });

  it('puts each skip reason in words, with the observed value and the ready-in time', () => {
    const e = (over: Partial<RuleTraceEntry>): RuleTraceEntry => ({ rule: 0, fired: false, skip: 'condition_false', ...over });
    expect(skipText(e({ reason: 'cond_false', cond: 1, observed: 3500 }))).toBe('Condition 2 was false. Observed 3500.');
    expect(skipText(e({ reason: 'cond_false' }))).toBe('Its condition was false.');
    expect(skipText(e({ skip: 'on_cooldown', reason: 'cooldown', readyInTicks: 30 }))).toBe('On cooldown. Ready in 1.5 s.');
    expect(skipText(e({ skip: 'rule_cooldown', reason: 'rule_cooldown', readyInTicks: 20 }))).toBe('Rule cooldown. Ready in 1 s.');
    expect(skipText(e({ skip: 'no_focus', reason: 'no_focus', observed: 40 }))).toBe('Not enough focus. He had 40.');
    expect(skipText(e({ skip: 'out_of_range', reason: 'out_of_range', observed: 8800 }))).toBe('Out of range. The target was 8.8 m away.');
    expect(skipText(e({ skip: 'blocked' }))).toBe('Blocked.');
  });

  it('names the condition from the rule itself', () => {
    const input = fightInputOf(state, playback.fixtureId, ctx.units[0]!.fighterId);
    const preset = presetOfTactics(content, input?.tactics)!;
    const rule = preset.rules[0]!;
    const parts = skipParts({ rule: 0, fired: false, skip: 'condition_false', reason: 'cond_false', cond: 0, observed: 12 }, { content, rule, classId: ctx.units[0]!.classId });
    expect(parts.lead).toBe('Condition 1 was false.');
    expect(parts.text.endsWith('Observed 12.')).toBe(true);
    expect(parts.text.length).toBeGreaterThan('Observed 12.'.length);
  });
});

describe('inspector model', () => {
  const unit = 0;
  const decision = fakeTimeline.decisionAt(fakeTimeline.indexFightLog(playback.log, content, {} as never, 'live'), unit, 200) as DecisionSnapshot;
  const input = fightInputOf(state, playback.fixtureId, ctx.units[unit]!.fighterId);

  it('lists every rule in order: the skipped ones with why, the fired one, then the rest as not reached, the stance last', () => {
    const m = inspectorModel({ content, ctx, unit, state: null, decision, probe: null, input })!;
    expect(m.unit.name).toBe(state.fighters[ctx.units[unit]!.fighterId]!.name.full);
    expect(m.decision!.ref.label).toBe('R2');
    expect(m.decision!.since).toBe('since 0:05');
    expect(m.decision!.react).toContain('200 ms');
    const why = m.decision!.why;
    expect(why.slice(0, 2).map((l) => [l.ref.label, l.fired, l.reached])).toEqual([
      ['R1', false, true],
      ['R2', true, true],
    ]);
    expect(why[0]!.why!.lead).toBe('Condition 1 was false.');
    expect(why.slice(2).every((l) => !l.reached && !l.fired)).toBe(true);
    expect(why.at(-1)!.ref.label).toBe('S');
    expect(why.at(-1)!.ref.stanceName).toBeTruthy();
    expect(m.now).toBeNull();
  });

  it('adds what he would decide now from the probe, his cooldowns and statuses (with their pip)', () => {
    const probe = probeOf(200).units[unit]!;
    const m = inspectorModel({ content, ctx, unit, state: null, decision, probe, probeTick: { tick: 200, evaluatedTick: 201 }, input })!;
    expect(m.now!.evaluation!.ref.label).toBe('R1');
    expect(m.now!.evaluation!.same).toBe(false);
    expect(m.now!.at).toBe('0:10.0');
    expect(m.now!.cooldowns[0]!.text).toBe('ready in 2s');
    expect(m.now!.cooldowns[1]!.text).toBe('ready');
    expect(m.now!.statuses[0]!.text).toBe('1 s');
  });

  it('takes a cooldown from the evaluation trace when a rule skipped on it, so one cooldown never shows two numbers (WP-M2A review)', () => {
    const preset = presetOfTactics(content, input?.tactics)!;
    const slotRule = preset.rules.findIndex((r) => (r.then as { slot?: string }).slot === 'a1');
    if (slotRule < 0) return; // this preset has no rule on a1: nothing to reconcile
    const base = probeOf(200).units[unit]!;
    const probe = { ...base, evaluation: { rule: 0, action: 'attack', target: 6, trace: [{ rule: slotRule, fired: false, skip: 'on_cooldown' as const, reason: 'cooldown', readyInTicks: 10 }] } };
    const m = inspectorModel({ content, ctx, unit, state: null, decision, probe, input })!;
    // The state said 40 ticks (2 s); the evaluation, one tick later and the one the player reads, says 10 (0.5 s).
    expect(m.now!.cooldowns[0]!.text).toBe('ready in 0.5s');
  });

  it('says why he cannot decide when the probe has no evaluation, also past the round end', () => {
    const probe = probeOf(500).units[3]!;
    const m = inspectorModel({ content, ctx, unit: 3, state: null, decision: null, probe, input: null })!;
    expect(m.now!.evaluation).toBeNull();
    expect(m.now!.blocked).toBe('he is down');
    const over = inspectorModel({ content, ctx, unit: 3, state: null, decision: null, probe: { ...probe, blockedBy: 'round_over' }, input: null })!;
    expect(over.now!.blocked).toBe('the round is over');
  });

  it('counts the rules fired so far when the viewer offers his decisions', () => {
    const d = (rule: number): DecisionSnapshot => ({ ...decision, rule });
    expect(firesFrom([d(0), d(1), d(1), d(2)], 2)).toEqual([1, 2, 1]);
    const m = inspectorModel({ content, ctx, unit, state: null, decision, probe: null, decisions: [d(1), d(1)], input })!;
    expect(m.fires!.find((f) => f.ref.label === 'R2')!.count).toBe(2);
    expect(inspectorModel({ content, ctx, unit, state: null, decision, probe: null, input })!.fires).toBeNull();
  });
});
