import { describe, expect, it } from 'vitest';
import type { RuleTraceEntry } from '../../../core/model';
import { fixtureContent } from '../../../core/testkit';
import type { DecisionSnapshot } from '../../../render';
import { buildRoundContext, fightInputOf } from './context';
import { firesFrom, inspectorModel, ruleLabel, skipText } from './inspect';
import { readArenaPalette } from './palette';
import { fakeTimeline } from './testing/fake-timeline';
import { liveWatchState, probeOf, roundPlaybackOf, watchWorld } from '../../debug/arena-test-world';

const content = fixtureContent();
const w = watchWorld(content);
const state = liveWatchState(w);
const playback = roundPlaybackOf(state, content, 'live', 1);
const ctx = buildRoundContext({ state, content, playback, match: null, palette: readArenaPalette('dark'), startTick: 0 });

describe('rule labels and skip reasons (P-22)', () => {
  it('labels the committed rule R1.., the stance S and a forced decision T', () => {
    expect(ruleLabel(0, 4)).toBe('R1');
    expect(ruleLabel(3, 4)).toBe('R4');
    expect(ruleLabel(4, 4)).toBe('S');
    expect(ruleLabel(-1, 4)).toBe('T');
  });

  it('puts each skip reason in words, with the observed value and the ready-in time', () => {
    const e = (over: Partial<RuleTraceEntry>): RuleTraceEntry => ({ rule: 0, fired: false, skip: 'condition_false', ...over });
    expect(skipText(e({ reason: 'cond_false', cond: 1, observed: 3500 }))).toBe('condition 2 was not met (saw 3500)');
    expect(skipText(e({ reason: 'cond_false' }))).toBe('its condition was not met');
    expect(skipText(e({ skip: 'on_cooldown', reason: 'cooldown', readyInTicks: 30 }))).toBe('the ability was ready in 1.5s');
    expect(skipText(e({ skip: 'rule_cooldown', reason: 'rule_cooldown' }))).toBe('the rule was cooling down');
    expect(skipText(e({ skip: 'no_focus', reason: 'no_focus' }))).toBe('not enough focus');
    expect(skipText(e({ skip: 'out_of_range', reason: 'out_of_range' }))).toBe('the target was out of reach');
    expect(skipText(e({ skip: 'only_filtered_all', reason: 'only_filtered' }))).toBe('every target was filtered out');
    // An old log without the detail still says something.
    expect(skipText(e({ skip: 'blocked' }))).toBe('it was blocked');
  });
});

describe('inspector model', () => {
  const unit = 0;
  const decision = fakeTimeline.decisionAt(fakeTimeline.indexFightLog(playback.log, content, {} as never, 'live'), unit, 200) as DecisionSnapshot;
  const input = fightInputOf(state, playback.fixtureId, ctx.units[unit]!.fighterId);

  it('explains the committed rule as a sentence from his preset, with every earlier rule and why it lost', () => {
    const m = inspectorModel({ content, ctx, unit, state: null, decision, probe: null, input })!;
    expect(m.unit.name).toBe(state.fighters[ctx.units[unit]!.fighterId]!.name.full);
    expect(m.decision!.label).toBe('R2');
    expect(m.decision!.sentence.length).toBeGreaterThan(5);
    expect(m.decision!.trace.map((l) => [l.label, l.fired])).toEqual([['R1', false], ['R2', true]]);
    expect(m.decision!.trace[0]!.why).toContain('condition 1 was not met (saw 8200)');
    expect(m.decision!.react).toContain('200 ms');
    expect(m.now).toBeNull();
  });

  it('adds what he would decide now from the probe, his cooldowns and statuses', () => {
    const probe = probeOf(200).units[unit]!;
    const m = inspectorModel({ content, ctx, unit, state: null, decision, probe, input })!;
    expect(m.now!.evaluation!.label).toBe('R1');
    expect(m.now!.evaluation!.same).toBe(false);
    expect(m.now!.cooldowns[0]!.text).toBe('ready in 2s');
    expect(m.now!.cooldowns[1]!.text).toBe('ready');
    expect(m.now!.statuses[0]!.text).toBe('1s');
  });

  it('says why he cannot decide when the probe has no evaluation', () => {
    const probe = probeOf(500).units[3]!;
    const m = inspectorModel({ content, ctx, unit: 3, state: null, decision: null, probe, input: null })!;
    expect(m.now!.evaluation).toBeNull();
    expect(m.now!.blocked).toBe('he is down');
  });

  it('counts the rules fired so far when the viewer offers his decisions', () => {
    const d = (rule: number): DecisionSnapshot => ({ ...decision, rule });
    expect(firesFrom([d(0), d(1), d(1), d(2)], 2)).toEqual([1, 2, 1]);
    const m = inspectorModel({ content, ctx, unit, state: null, decision, probe: null, decisions: [d(1), d(1)], input })!;
    expect(m.fires!.find((f) => f.label === 'R2')!.count).toBe(2);
    expect(inspectorModel({ content, ctx, unit, state: null, decision, probe: null, input })!.fires).toBeNull();
  });
});
