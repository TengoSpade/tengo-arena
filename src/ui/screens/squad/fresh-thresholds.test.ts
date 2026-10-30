/**
 * The Freshness numbers and label names in the Squad texts and suggestions come from content (O36), not from
 * constants: a content set with moved tiers changes the words, the rotation tips and the suggested reserves.
 */
import { describe, expect, it } from 'vitest';
import type { ContentDB } from '../../../core/content';
import type { GameState } from '../../../core/model';
import { createTestStore } from '../../debug/test-store';
import { fighterViewOf } from '../../store/views';
import { freshBands } from '../../m11/model';
import { format } from '../../text';
import { rotationTips, suggestReserves } from './MatchSquad';
import { T } from './text';

/** Content with every Freshness boundary moved (penalty from 90, Tired boundary 70, Tired from 45, Spent below 45) and Tired renamed. */
function movedContent(content: ContentDB): ContentDB {
  const move = new Map([[75, 90], [50, 70], [25, 45]]);
  const fr = content.levels.freshness;
  const tiers = content.combat.freshness.tiers.map((t) => ({ ...t, minFreshness: move.get(t.minFreshness) ?? t.minFreshness }));
  const labels = fr.labels.map((l) => ({ ...l, min: move.get(l.min) ?? l.min, label: l.id === 'tired' ? 'Worn' : l.label }));
  return {
    ...content,
    combat: { ...content.combat, freshness: { ...content.combat.freshness, tiers } },
    levels: { ...content.levels, freshness: { ...fr, threshold: 70, labels } },
  };
}

/** A copy of the world with the given fighters' Freshness (0-100) set; the store's state is frozen. */
function withFresh(state: GameState, set: Record<string, number>): GameState {
  const fighters = { ...state.fighters };
  for (const [id, v] of Object.entries(set)) fighters[id as keyof typeof fighters] = { ...fighters[id as keyof typeof fighters]!, freshness10: v * 10 };
  return { ...state, fighters };
}

function setup() {
  const { store, content, engine } = createTestStore();
  const state = store.game.value as GameState;
  const club = state.clubs[state.playerClubId!]!;
  return { state, content, engine, club };
}

describe('Squad Freshness texts and suggestions read the content bands', () => {
  it('freshBands reads the penalty start, the Tired boundary and the label names', () => {
    const { content } = setup();
    expect(freshBands(content)).toEqual({ penaltyFrom: 75, threshold: 50, tiredName: 'Tired', spentName: 'Spent', spentFrom: 25 });
    expect(freshBands(movedContent(content))).toEqual({ penaltyFrom: 90, threshold: 70, tiredName: 'Worn', spentName: 'Spent', spentFrom: 45 });
  });

  it('the header tip and the projection words carry the numbers and names of the content', () => {
    const { content } = setup();
    const words = (c: ContentDB) => {
      const b = freshBands(c);
      return format(T.colFreshTip, { penalty: b.penaltyFrom, threshold: b.threshold, tired: b.tiredName, spentFrom: b.spentFrom, spent: b.spentName }) + ' ' + format(T.freshWillTire, { threshold: b.threshold, tired: b.tiredName });
    };
    expect(words(content)).toContain('Below 75');
    expect(words(content)).toContain('below 50 is Tired; below 25 is Spent');
    expect(words(content)).toContain('below 50 (Tired)');
    const moved = words(movedContent(content));
    expect(moved).toContain('Below 90');
    expect(moved).toContain('below 70 is Worn; below 45 is Spent');
    expect(moved).toContain('below 70 (Worn)');
    expect(moved).not.toMatch(/\b(60|40|80)\b/);
  });

  it('suggestReserves keeps fighters at or above the content threshold only', () => {
    const { state, content, engine, club } = setup();
    const starters = new Set(club.lineup.fighters.map((e) => e.fighterId as string));
    const bench = Object.values(state.fighters).filter((f) => f.clubId === club.id && f.status === 'active' && !starters.has(f.id));
    expect(bench.length).toBeGreaterThanOrEqual(2);
    const at = (v: number) => withFresh(state, Object.fromEntries(bench.map((f) => [f.id, v])));
    const s60 = at(60); // fine under threshold 50, below a threshold of 70
    expect(suggestReserves(s60, content, engine, club).length).toBe(2);
    expect(suggestReserves(s60, movedContent(content), engine, club)).toEqual([]);
    expect(suggestReserves(at(45), content, engine, club)).toEqual([]);
  });

  it('rotationTips ask for a bench fighter at or above where the penalty starts', () => {
    const { state, content, engine, club: club0 } = setup();
    // Field the five lowest-rated fighters (so every other fighter is within the rating gap) and leave the stronger ones on the bench.
    const rated = Object.values(state.fighters)
      .filter((f) => f.clubId === club0.id && f.status === 'active')
      .sort((a, b) => (fighterViewOf(engine, state, content, a.id)?.rating ?? 0) - (fighterViewOf(engine, state, content, b.id)?.rating ?? 0));
    const five = rated.slice(0, 5);
    const bench = rated.slice(5);
    const club = { ...club0, lineup: { ...club0.lineup, fighters: club0.lineup.fighters.map((e, i) => ({ ...e, fighterId: five[i]!.id })), reserves: [] } };
    const spent = Object.fromEntries(five.map((f) => [f.id, 10]));
    const at = (v: number) => withFresh(state, { ...spent, ...Object.fromEntries(bench.map((f) => [f.id, v])) });
    expect(rotationTips(at(80), content, engine, club).length).toBeGreaterThan(0);
    // 80 clears the shipped penalty start (75) but not a moved one (90).
    expect(rotationTips(at(80), movedContent(content), engine, club)).toEqual([]);
    expect(rotationTips(at(76), content, engine, club).length).toBeGreaterThan(0); // was out under the old fixed 80
    expect(rotationTips(at(74), content, engine, club)).toEqual([]); // under the penalty start
  });
});
