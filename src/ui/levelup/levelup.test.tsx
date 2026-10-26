import { act, cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FighterId, GameState } from '../../core/model';
import { fixturePendingLevelUp } from '../../core/testkit';
import { TestProviders, createTestStore } from '../debug/test-store';
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
