import { describe, expect, it } from 'vitest';
import { fixtureContent } from '../testkit';
import { runBalance } from './index';
import { FATIGUE_PROFILES, M11_TARGETS, perkAutoValue, rankAutoValue, wilson } from './balance';

describe('balance harness', () => {
  const content = fixtureContent();

  it('plays real fights deterministically per seed and counts every fighter-round', () => {
    const a = runBalance({ seed: 'b1', fights: 40, content });
    expect(a.stub).toBe(false);
    expect(a).toEqual(runBalance({ seed: 'b1', fights: 40, content }));
    expect(a.fights).toBe(40);
    expect(a.classes.reduce((n, r) => n + r.appearances, 0)).toBe(400);
    expect(a.classes.reduce((n, r) => n + r.wins, 0)).toBe(200);
    expect(a.classes.map((r) => r.classId).sort()).toEqual(content.classes.list.map((k) => k.id).sort());
    expect(a.contentHash).toBe(content.ref.hash);
    expect(a.fightLength!.rounds).toBe(40);
    expect(a.fightLength!.medianS).toBeGreaterThan(0);
    expect(a.fightLength!.medianS).toBeLessThanOrEqual(75);
    expect(a.archetypes!.reduce((n, r) => n + r.appearances, 0)).toBe(400);
    for (const r of a.classes) {
      expect(r.ciLow!).toBeLessThanOrEqual(r.winRate);
      expect(r.ciHigh!).toBeGreaterThanOrEqual(r.winRate);
    }
    expect(a.outliers).toEqual(a.classes.filter((r) => r.winRate < 0.4 || r.winRate > 0.6).map((r) => r.classId));
  });

  it('mirrors each pair of lineups (sides swapped, same seed)', () => {
    const r = runBalance({ seed: 'm', fights: 30, content, mode: 'mirror' });
    expect(r.mode).toBe('mirror');
    expect(r.fights).toBe(30);
    // A mirror lineup wins exactly half of its own appearances per pair.
    expect(r.classes.reduce((n, c) => n + c.wins, 0)).toBe(150);
  });

  it('preset-vs-default reports the tailored styles against the defaults', () => {
    const r = runBalance({ seed: 'p', fights: 20, content, mode: 'preset-vs-default' });
    const ids = r.styles!.map((s) => s.id);
    expect(ids).toContain('default');
    expect(ids.some((s) => s.startsWith('tailored:'))).toBe(true);
    expect(r.styles!.find((s) => s.id === 'default')!.appearances).toBe(100);
  });

  it('times fights only with an injected clock and flags slow medians', () => {
    let t = 0;
    const r = runBalance({ seed: 'c', fights: 4, content, clock: () => (t += 3) });
    expect(r.timing).toMatchObject({ record: 'none', medianMs: 3 });
    expect(r.flags!.some((f) => f.startsWith('median'))).toBe(true);
    expect(runBalance({ seed: 'c', fights: 4, content }).timing).toBeUndefined();
  });

  it('rejects a bad fight count', () => {
    expect(() => runBalance({ seed: 'b1', fights: -1, content })).toThrow(RangeError);
    expect(runBalance({ seed: 'b1', fights: 0, content }).fights).toBe(0);
  });

  it('Wilson interval', () => {
    const w = wilson(50, 100);
    expect(w.low).toBeCloseTo(0.4038, 3);
    expect(w.high).toBeCloseTo(0.5962, 3);
    expect(wilson(0, 0)).toEqual({ low: 0, high: 1 });
  });

  // ---- M1.1 modes (combat-skills.md §8) ----

  it('progression: random drafts with season-3 skills; observational perk rows and the M1.1 bands', () => {
    const a = runBalance({ seed: 'pg', fights: 24, content, mode: 'progression' });
    expect(a).toEqual(runBalance({ seed: 'pg', fights: 24, content, mode: 'progression' }));
    expect([a.profile, a.pick, a.fights]).toEqual(['season3', 'auto', 24]);
    expect(a.classes.reduce((n, r) => n + r.appearances, 0)).toBe(240);
    expect(a.targetBand).toEqual(M11_TARGETS.class);
    expect(a.archetypeBand).toEqual(M11_TARGETS.archetype);
    expect(a.perks).toHaveLength(content.perks.list.length);
    // One perk per fighter at season 3: 240 fighter-rounds hold exactly one perk each.
    expect(a.perks!.reduce((n, p) => n + p.rounds, 0)).toBe(240);
    // Tier II and III need perks held first: never picked with a single perk.
    for (const p of a.perks!) if (p.tier > 1) expect(p.pickRate).toBe(0);
    expect(a.perks!.some((p) => p.tier > 1 && p.pickRateVeteran > 0)).toBe(true);
    const v = runBalance({ seed: 'pg', fights: 8, content, mode: 'progression', profile: 'veteran', pick: 'uniform' });
    expect([v.profile, v.pick]).toEqual(['veteran', 'uniform']);
    expect(v.perks!.reduce((n, p) => n + p.rounds, 0)).toBe(80 * 3);
    // The plain draft is unchanged by the M1.1 additions.
    expect(runBalance({ seed: 'b1', fights: 4, content }).profile).toBeUndefined();
  });

  it('perk-impact: every perk on paired sides, with procs for triggered perks and dominance ordering', () => {
    const r = runBalance({ seed: 'pi', fights: 0, content, mode: 'perk-impact', perItem: 2 });
    expect(r.fights).toBe(2 * content.perks.list.length);
    expect(r.perks).toHaveLength(content.perks.list.length);
    for (const p of r.perks!) {
      expect(p.rounds).toBe(2);
      expect(p.liftPts).toBeCloseTo((p.winRate - 0.5) * 100, 1);
      const triggered = (content.perks.require(p.perkId).passive?.triggers.length ?? 0) > 0;
      expect(p.procsPerRound === null).toBe(!triggered);
    }
    // Context perks are measured in their situation, the same on both sides.
    const ctx = (id: string) => r.perks!.find((p) => p.perkId === id)!.context;
    expect([ctx('g_fresh_legs'), ctx('g_long_wind'), ctx('g_banner_voice'), ctx('m_keen_edge')]).toEqual(['fresh entry', 'F 40', 'captain', null]);
    const dom = r.perks!.map((p) => p.dominance);
    expect(dom).toEqual([...dom].sort((x, y) => y - x));
    expect(r.outliers).toEqual([]);
    expect(r.flags!.some((f) => f.startsWith('class '))).toBe(false);
  });

  it('rank-impact: every rankable ability at rank 3 against rank 1', () => {
    const r = runBalance({ seed: 'ri', fights: 0, content, mode: 'rank-impact', perItem: 2 });
    const rankable = content.classes.list.flatMap((k) => (['a1', 'a2', 'passive'] as const).filter((s) => content.abilityRanks(k.abilities[s])?.rankable));
    expect(r.ranks).toHaveLength(rankable.length);
    expect(r.fights).toBe(2 * rankable.length);
    for (const row of r.ranks!) {
      expect(row.rounds).toBe(2);
      expect(row.flags.length > 0).toBe(row.liftPts > M11_TARGETS.rankLiftMaxPts || row.liftPts < M11_TARGETS.rankLiftMinPts);
    }
  });

  it('fatigue: the four Freshness profiles; a tired side never does better than chance by much', () => {
    const r = runBalance({ seed: 'fa', fights: 40, content, mode: 'fatigue' });
    expect(r.profile).toBe('none');
    expect(r.fatigue!.map((x) => x.id)).toEqual(FATIGUE_PROFILES.map((x) => x.id));
    for (const row of r.fatigue!) {
      expect(row.rounds).toBe(10);
      expect(row.inTarget).toBe(row.winRate >= row.target.min && row.winRate <= row.target.max);
    }
    // All five at F 10 against fresh twins.
    expect(r.fatigue!.find((x) => x.id === 'all_f10')!.winRate).toBeLessThan(0.5);
  });

  it('squad-match waits for game.playMatchAuto (WP-C)', () => {
    expect(() => runBalance({ seed: 's', fights: 2, content, mode: 'squad-match' })).toThrow(/WP-C/);
  });

  it('auto-pick values follow combat-skills.md §5 (captain tag, tier III, preset use, clamp)', () => {
    const ctx = (classId: string, captainOrVice: boolean) => ({ classId, style: 'balanced', captainOrVice, stamina: 10, presetSlots: new Set(['a1', 'a2']) });
    const banner = content.perks.require('g_banner_voice');
    expect(perkAutoValue(content, banner, ctx('oathguard', true))).toBeGreaterThan(perkAutoValue(content, banner, ctx('oathguard', false)));
    for (const p of content.perks.list) {
      const v = perkAutoValue(content, p, ctx('oathguard', false));
      expect(v).toBeGreaterThanOrEqual(0.5);
      expect(v).toBeLessThanOrEqual(3);
    }
    const noPreset = { ...ctx('oathguard', false), presetSlots: new Set<string>() };
    expect(rankAutoValue(content, 'a1', ctx('oathguard', false))).toBeCloseTo(rankAutoValue(content, 'a1', noPreset) * 1.2, 6);
    expect(rankAutoValue(content, 'passive', noPreset)).toBeLessThan(1.25);
  });
});
