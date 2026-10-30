import { act, cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FighterId, GameState } from '../../core/model';
import { fixturePendingLevelUp } from '../../core/testkit';
import { readTip, type TipContent } from '../components';
import { TestProviders, createTestStore } from '../debug/test-store';
import { fmtGain, fmtPoints, statPickEffect } from '../m11/model';
import { buildDigest } from '../store/digest';
import { autoOpenFor } from './host';
import { LevelUpDialog } from './LevelUpDialog';

afterEach(cleanup);

function withPending(opts: { traitOffer?: string[] | null; levels?: number } = {}) {
  const t = createTestStore();
  const state = structuredClone(t.store.game.value!) as GameState;
  const club = state.clubs[state.playerClubId!]!;
  const id = club.lineup.fighters[0]!.fighterId;
  const f = state.fighters[id]!;
  const traits = Object.values(t.content.traits.list)
    .filter((x) => x.polarity !== 'negative' && !f.traits.some((h) => h.id === x.id))
    .slice(0, 2)
    .map((x) => x.id);
  f.pendingLevelUps = Array.from({ length: opts.levels ?? 1 }, (_, i) =>
    fixturePendingLevelUp(f, t.content, { level: f.level + 1 + i, traitOffer: opts.traitOffer === undefined ? null : opts.traitOffer === null ? null : traits }),
  );
  t.store.replaceWorld(state, t.content);
  return { ...t, id, traits };
}

function open(store: ReturnType<typeof createTestStore>['store'], id: FighterId, onClose = vi.fn()) {
  render(
    <TestProviders store={store}>
      <LevelUpDialog fighterId={id} onClose={onClose} />
    </TestProviders>,
  );
  return onClose;
}

/** A pending level-up whose three stat picks have 0.87, 0.43 and 2.60 of room under the ceiling. */
function withFractionalPicks() {
  const t = createTestStore();
  const state = structuredClone(t.store.game.value!) as GameState;
  const club = state.clubs[state.playerClubId!]!;
  const id = club.lineup.fighters[0]!.fighterId;
  const f = state.fighters[id]!;
  const stats = Object.keys(f.train100).slice(0, 3) as (keyof typeof f.train100)[];
  const rooms = [87, 43, 260];
  stats.forEach((s, i) => {
    f.train100[s] = 1040 + i * 100; // 10.40, 11.40, 12.40 trained
    f.wear100[s] = 0;
    f.cap100[s] = f.train100[s] + rooms[i]!;
  });
  f.pendingLevelUps = [{ level: f.level + 1, season: 1, weekIndex: 1, options: stats.map((s, i) => ({ kind: 'stat' as const, stat: s, gain100: Math.min(100, rooms[i]!) })), traitOffer: null }];
  t.store.replaceWorld(state, t.content);
  return { ...t, id };
}

describe('Level-up dialog: the real effect of a stat pick', () => {
  it('statPickEffect: a pick adds +1.00 or the room left; the shown stat only moves when the fraction crosses a point', () => {
    const f = { train100: { str: 1040 }, cap100: { str: 1127 }, wear100: { str: 0 } } as never;
    const e = statPickEffect(f, { str: 10 }, 'str', 100);
    expect(e).toMatchObject({ now100: 1040, after100: 1127, gain100: 87, room100: 87, wholeNow: 10, wholeAfter: 11, crosses: true });
    const short = statPickEffect({ train100: { str: 1040 }, cap100: { str: 1083 }, wear100: { str: 0 } } as never, { str: 10 }, 'str', 100);
    expect(short).toMatchObject({ gain100: 43, wholeNow: 10, wholeAfter: 10, crosses: false });
    // Traits and statuses add whole points on top; wear is taken off the trained value.
    const worn = statPickEffect({ train100: { str: 1240 }, cap100: { str: 1500 }, wear100: { str: 70 } } as never, { str: 13 }, 'str', 100);
    expect(worn).toMatchObject({ now100: 1370, after100: 1470, gain100: 100, wholeNow: 13, wholeAfter: 14 });
    expect(fmtPoints(1040)).toBe('10.4');
    expect(fmtPoints(1096)).toBe('10.9'); // never "11.0" before the stat reaches 11
    expect(fmtGain(1040, 1127)).toBe('+0.9'); // the difference of the two shown values: 10.4 → 11.3
    expect(fmtGain(1040, 1043)).toBe('+0.03');
  });

  it('shows the real effect ("10.4 → 11.3 (+0.9)"), never a whole-number step the pick does not make, and a tooltip saying why', () => {
    const { store, id } = withFractionalPicks();
    open(store, id);
    const cards = [0, 1, 2].map((i) => screen.getByTestId(`levelup-option-${i}`));
    const change = (i: number) => screen.getByTestId(`levelup-change-${i}`).textContent!;
    // 10.40 + 0.87 = 11.27 crosses 11; 11.40 + 0.43 = 11.83 stays 11; 12.40 + 1.00 = 13.40.
    expect(change(0)).toBe('10.4 → 11.3 (+0.9)');
    expect(change(1)).toBe('11.4 → 11.8 (+0.4)');
    expect(change(2)).toBe('12.4 → 13.4 (+1.0)');
    expect(cards[0]!.querySelector('.lu-card__detail')!.textContent).toMatch(/rises to 11$/);
    expect(cards[1]!.querySelector('.lu-card__detail')!.textContent).toMatch(/stays 11: \+0\.4 toward 12$/);
    expect(cards[2]!.querySelector('.lu-card__detail')!.textContent).toMatch(/rises to 13$/);
    // Why the gain is below one point: the room under his ceiling (his potential in the stat), in the tooltip and on the card.
    const tip = readTip(screen.getByTestId('levelup-change-1')) as TipContent;
    expect(tip.body).toMatch(/never past his ceiling/);
    expect(tip.body).toMatch(/Only 0\.43 was left/);
    expect(tip.rows!.map((r) => r.label)).toContain('Room under his ceiling');
    expect(cards[1]!.querySelector('.lu-card__why')!.textContent).toMatch(/only 0\.43 under his ceiling/);
    expect((readTip(screen.getByTestId('levelup-change-2')) as TipContent).body).toMatch(/rises by one whole point/);
    for (const c of cards) expect(c.textContent).not.toMatch(/\b(\d+) → \1,/);
  });
});

describe('Level-up dialog focus', () => {
  it('lands focus inside, and its keys work when focus fell to <body>', async () => {
    const { store, id } = withPending();
    open(store, id);
    const dialog = screen.getByTestId('levelup-dialog');
    expect(dialog.contains(document.activeElement)).toBe(true);
    // Focus lost to the body (the focused control went away): keys still reach the dialog.
    (document.activeElement as HTMLElement).blur();
    const cards = [0, 1, 2].map((i) => screen.getByTestId(`levelup-option-${i}`));
    await act(() => {
      fireEvent.keyDown(document.body, { key: '2' });
    });
    expect(cards[1]!.getAttribute('aria-checked')).toBe('true');
    await act(() => {
      fireEvent.keyDown(document.body, { key: 'Enter' });
    });
    expect(store.game.value!.fighters[id]!.pendingLevelUps).toHaveLength(0);
  });
});

describe('Level-up dialog', () => {
  it('shows three options with current → new values and why; 1–3 pick, Enter confirms the choice', async () => {
    const { store, id } = withPending();
    const onClose = open(store, id);
    const dialog = screen.getByTestId('levelup-dialog');
    expect(dialog.textContent).toContain('reached level');
    const cards = [0, 1, 2].map((i) => screen.getByTestId(`levelup-option-${i}`));
    for (const c of cards) {
      expect(c.querySelector('.lu-card__change')!.textContent).toMatch(/\d+ → \d+/);
      expect(c.querySelector('.lu-card__why')!.textContent!.length).toBeGreaterThan(5);
    }
    const before = store.game.value!.fighters[id]!;
    const option = before.pendingLevelUps[0]!.options[1]!;
    await act(() => {
      fireEvent.keyDown(dialog, { key: '2' });
    });
    expect(cards[1]!.getAttribute('aria-checked')).toBe('true');
    await act(() => {
      fireEvent.keyDown(dialog, { key: 'Enter' });
    });
    const after = store.game.value!.fighters[id]!;
    expect(after.pendingLevelUps).toHaveLength(0);
    expect(after.season.levelLog.at(-1)).toMatchObject({ picked: option, how: 'player' });
    expect(store.recentCommands.value.at(-1)?.command).toMatchObject({ type: 'levelup.choose', fighterId: id, optionIndex: 1, traitIndex: null });
    expect(onClose).toHaveBeenCalledWith(true);
  });

  it('offers the trait choice (4/5 or 6 neither) besides the main pick, and Auto-pick resolves by the policy', async () => {
    const { store, id, traits } = withPending({ traitOffer: [] , levels: 2 });
    const onClose = open(store, id);
    const dialog = screen.getByTestId('levelup-dialog');
    expect(screen.getByTestId('levelup-traits')).toBeTruthy();
    expect(dialog.textContent).toContain('2 waiting');
    await act(() => {
      fireEvent.keyDown(dialog, { key: '1' });
      fireEvent.keyDown(dialog, { key: '5' });
    });
    await act(() => {
      fireEvent.click(screen.getByTestId('levelup-confirm'));
    });
    const f = store.game.value!.fighters[id]!;
    expect(f.traits.some((x) => x.id === traits[1] && x.source === 'level')).toBe(true);
    // The second one stays in the dialog; Auto-pick takes the policy's choice.
    expect(onClose).not.toHaveBeenCalled();
    await act(() => {
      fireEvent.click(screen.getByTestId('levelup-auto'));
    });
    expect(store.game.value!.fighters[id]!.pendingLevelUps).toHaveLength(0);
    expect(onClose).toHaveBeenCalledWith(true);
  });

  it('Later keeps the level-up waiting; the digest lists it with a Choose link', async () => {
    const { store, id, content } = withPending();
    const onClose = open(store, id);
    await act(() => {
      fireEvent.click(screen.getByTestId('levelup-later'));
    });
    expect(onClose).toHaveBeenCalledWith(false);
    const state = store.game.value!;
    expect(state.fighters[id]!.pendingLevelUps).toHaveLength(1);
    const item = buildDigest(state, content, state.playerClubId!, []).find((d) => d.id === 'level-ups');
    expect(item?.action?.href).toBe(`#/fighter/${id}?levelup=1`);
    expect(item?.needsAction).toBe(false);
  });

  it('opens by itself per pacing: detailed for every Ask-me fighter, balanced only for those who played, fast never', () => {
    const { store, id, engine } = withPending();
    const state = structuredClone(store.game.value!) as GameState;
    const report = { season: 1, weekIndex: 1, playerFixtureId: null, levelUps: [{ fighterId: id, level: 99 }] } as unknown as Parameters<typeof autoOpenFor>[1];
    const club = state.clubs[state.playerClubId!]!;
    club.levelUpPacing = 'detailed';
    expect(autoOpenFor(state, report, engine)).toEqual([id]);
    club.levelUpPacing = 'balanced';
    expect(autoOpenFor(state, report, engine)).toEqual([]);
    club.levelUpPacing = 'fast';
    expect(autoOpenFor(state, report, engine)).toEqual([]);
    club.levelUpPacing = 'detailed';
    state.fighters[id]!.levelUpMode = 'auto';
    expect(autoOpenFor(state, report, engine)).toEqual([]);
  });
});
