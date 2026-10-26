import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { GameState } from '../../../core/model';
import { installShortcuts } from '../../app/shortcuts';
import { resetToasts } from '../../components';
import { TestProviders, createTestStore } from '../../debug/test-store';
import { coreEngine } from '../../store';
import SquadScreen, { squadSelection } from './index';

let dispose: (() => void) | null = null;
beforeEach(() => resetToasts());
afterEach(() => {
  cleanup();
  dispose?.();
  dispose = null;
  squadSelection.value = null;
});

function mount(store: ReturnType<typeof createTestStore>['store']) {
  dispose = installShortcuts(() => ({}));
  return render(
    <TestProviders store={store}>
      <SquadScreen params={{}} />
    </TestProviders>,
  );
}

describe('Squad: match squad of 5 + 2 and Freshness (M1.1)', () => {
  it('names a match reserve with M, shows his Freshness and the roles the reserves cover', async () => {
    const { store } = createTestStore();
    const state = store.game.value!;
    const club = state.clubs[state.playerClubId!]!;
    const starters = new Set(club.lineup.fighters.map((e) => e.fighterId as string));
    const bench = Object.values(state.fighters).filter((f) => f.clubId === club.id && !starters.has(f.id) && !(f.injury && f.injury.weeksOut > 0));
    mount(store);
    const zone = screen.getByTestId('match-reserves');
    expect(zone.textContent).toContain('0/2');
    await act(() => {
      squadSelection.value = bench[0]!.id;
    });
    await act(() => {
      fireEvent.keyDown(document.body, { key: 'm' });
    });
    expect(store.game.value!.clubs[club.id]!.lineup.reserves).toEqual([bench[0]!.id]);
    expect(store.recentCommands.value.at(-1)?.command.type).toBe('squad.set');
    const card = screen.getByTestId(`reserve-card-${bench[0]!.id}`);
    expect(within(card).getByLabelText(/^Freshness \d+/)).toBeTruthy();
    expect(screen.getByTestId('reserves-cover').textContent).toMatch(/Cover: /);
    // Every starter card carries a Freshness meter and the forecast after this match.
    for (const e of club.lineup.fighters) expect(screen.getByTestId(`fresh-${e.fighterId}`)).toBeTruthy();
  });

  it('warns about a Tired starter and suggests resting him for a fresher fighter of his role (one click)', async () => {
    const { store, content } = createTestStore();
    const next = structuredClone(store.game.value!) as GameState;
    const club = next.clubs[next.playerClubId!]!;
    const starter = club.lineup.fighters[0]!.fighterId;
    next.fighters[starter]!.freshness10 = 450;
    // Make sure a same-role fresh bench fighter exists.
    const roles = content.classes.get(next.fighters[starter]!.classId)!.archetypes;
    const starters = new Set(club.lineup.fighters.map((e) => e.fighterId as string));
    const sub = Object.values(next.fighters).find((f) => f.clubId === club.id && !starters.has(f.id) && content.classes.get(f.classId)!.archetypes.some((r) => roles.includes(r)));
    if (sub) {
      sub.classId = next.fighters[starter]!.classId;
      sub.train100 = { ...next.fighters[starter]!.train100 };
      sub.cap100 = { ...next.fighters[starter]!.cap100 };
      sub.injury = null;
    }
    store.replaceWorld(next);
    mount(store);
    const card = screen.getByTestId(`lineup-card-${starter}`);
    expect(card.textContent).toContain('Tired 45');
    if (!sub) return;
    const tip = screen.getByTestId(`rotate-${starter}`);
    await act(() => {
      fireEvent.click(tip);
    });
    const lineup = store.game.value!.clubs[club.id]!.lineup.fighters.map((e) => e.fighterId);
    expect(lineup).toContain(sub.id);
    expect(lineup).not.toContain(starter);
  });
  it('Auto-pick takes the core squad suggestion: an injured starter is replaced and the reserve places are filled', async () => {
    const { store } = createTestStore({ engine: coreEngine });
    const next = structuredClone(store.game.value!) as GameState;
    const club = next.clubs[next.playerClubId!]!;
    const hurt = club.lineup.fighters[0]!.fighterId;
    next.fighters[hurt]!.injury = { ...(next.fighters[hurt]!.injury ?? {}), severity: 'moderate', weeksOut: 3, fixtureId: null, round: null, causeFighterId: null } as never;
    club.lineup.reserves = [];
    store.replaceWorld(next);
    expect(store.blockers.value.map((b) => b.code)).toContain('lineup.unavailable');
    mount(store);
    await act(() => {
      fireEvent.click(screen.getByRole('button', { name: /Auto-pick/ }));
    });
    const after = store.game.value!.clubs[club.id]!.lineup;
    expect(store.blockers.value).toEqual([]);
    expect(after.fighters.map((e) => e.fighterId)).not.toContain(hurt);
    expect(after.reserves.length).toBeGreaterThan(0);
    expect(store.recentCommands.value.at(-1)?.command.type).toBe('squad.set');
  });
});

