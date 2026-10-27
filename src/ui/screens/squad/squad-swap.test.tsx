/**
 * AL-R002-T003: switching a match reserve for a starter is a true swap. The displaced starter takes the reserve
 * place (not the bench), by key (F / B), drag and drop and the Bring in / Rotate buttons; a bench fighter coming
 * into a full lineup still sends the starter to the bench. Every one of them has the Undo toast.
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ClubId, Fighter, FighterId, GameState } from '../../../core/model';
import { installShortcuts } from '../../app/shortcuts';
import { resetToasts, toasts, undoLast } from '../../components';
import { TestProviders, createTestStore } from '../../debug/test-store';
import { swapReserves } from '../../store/actions';
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

/** A world where the first two bench fighters are the match reserves. */
function world() {
  const made = createTestStore();
  const next = structuredClone(made.store.game.value!) as GameState;
  const club = next.clubs[next.playerClubId!]!;
  const starters = new Set(club.lineup.fighters.map((e) => e.fighterId as string));
  const bench = Object.values(next.fighters).filter((f) => f.clubId === club.id && !starters.has(f.id) && !(f.injury && f.injury.weeksOut > 0)) as Fighter[];
  for (const f of bench) f.freshness10 = 1000;
  club.lineup.reserves = [bench[0]!.id, bench[1]!.id];
  made.store.replaceWorld(next);
  return { ...made, club: club.id as ClubId, bench, five: club.lineup.fighters.map((e) => ({ ...e })) };
}

const lineupOf = (store: ReturnType<typeof createTestStore>['store'], clubId: ClubId) => store.game.value!.clubs[clubId]!.lineup;
const ids = (list: readonly { fighterId: FighterId }[]) => list.map((e) => e.fighterId);

describe('swapReserves (pure)', () => {
  const fit = () => true;
  it('puts the displaced starter in the entering reserve place, in the same order', () => {
    expect(swapReserves(['r1', 'r2'] as FighterId[], 'r1' as FighterId, 's' as FighterId, fit)).toEqual(['s', 'r2']);
    expect(swapReserves(['r1', 'r2'] as FighterId[], 'r2' as FighterId, 's' as FighterId, fit)).toEqual(['r1', 's']);
  });
  it('is null for a fighter who is not a reserve, or when core would refuse the list (an unfit reserve)', () => {
    expect(swapReserves(['r1'] as FighterId[], 'b' as FighterId, 's' as FighterId, fit)).toBeNull();
    expect(swapReserves(['r1', 'r2'] as FighterId[], 'r1' as FighterId, 's' as FighterId, (id) => id !== 's')).toBeNull();
  });
});

describe('Squad: a match reserve for a starter is a true swap (AL-R002-T003)', () => {
  it('F / B: the reserve comes in and the starter he replaces takes his reserve place; Undo restores both', async () => {
    const w = world();
    const reserve = w.bench[0]!.id;
    const other = w.bench[1]!.id;
    mount(w.store);
    // The last starter of the front row (else the last of the lineup) is the one a full lineup gives way.
    const row = w.five.some((e) => e.row === 'front') ? 'front' : 'back';
    const key = row === 'front' ? 'f' : 'b';
    const out = [...w.five].reverse().find((e) => e.row === row)!.fighterId;
    await act(() => {
      squadSelection.value = reserve;
    });
    await act(() => {
      fireEvent.keyDown(document.body, { key });
    });
    const after = lineupOf(w.store, w.club);
    expect(ids(after.fighters)).toContain(reserve);
    expect(ids(after.fighters)).not.toContain(out);
    expect(after.fighters).toHaveLength(5);
    expect(after.reserves).toEqual([out, other]);
    expect(w.store.recentCommands.value.at(-1)?.command.type).toBe('squad.set');
    const toast = toasts.value.at(-1)!;
    expect(toast.title).toContain('replaces');
    expect(toast.sub).toContain(w.store.game.value!.fighters[out]!.name.full);
    expect(toast.undo).toBeTruthy();
    await act(() => {
      undoLast();
    });
    const undone = lineupOf(w.store, w.club);
    expect(undone.fighters).toEqual(w.five);
    expect(undone.reserves).toEqual([reserve, other]);
  });

  it('the second reserve swaps into his own place (the other reserve keeps his)', async () => {
    const w = world();
    mount(w.store);
    const second = w.bench[1]!.id;
    const out = w.five[w.five.length - 1]!.fighterId;
    await act(() => {
      squadSelection.value = second;
    });
    await act(() => {
      fireEvent.keyDown(document.body, { key: w.five[w.five.length - 1]!.row === 'front' ? 'f' : 'b' });
    });
    expect(lineupOf(w.store, w.club).reserves).toEqual([w.bench[0]!.id, out]);
  });

  it('drag and drop: a reserve dropped on a starter swaps with him; a starter dropped on a reserve card does the same', async () => {
    const w = world();
    mount(w.store);
    const reserve = w.bench[0]!.id;
    const starter = w.five[2]!.fighterId;
    const reserveCard = screen.getByTestId(`reserve-card-${reserve}`);
    const starterCard = screen.getByTestId(`lineup-card-${starter}`);
    await act(() => {
      fireEvent.dragStart(reserveCard);
    });
    await act(() => {
      fireEvent.drop(starterCard);
    });
    let lineup = lineupOf(w.store, w.club);
    expect(ids(lineup.fighters)[2]).toBe(reserve);
    expect(lineup.fighters[2]!.row).toBe(w.five[2]!.row);
    expect(lineup.reserves).toEqual([starter, w.bench[1]!.id]);
    // And back: the starter (now a reserve) comes in again by dropping the first starter on his reserve card.
    const back = w.five[0]!.fighterId;
    await act(() => {
      fireEvent.dragStart(screen.getByTestId(`lineup-card-${back}`));
    });
    await act(() => {
      fireEvent.drop(screen.getByTestId(`reserve-card-${starter}`));
    });
    lineup = lineupOf(w.store, w.club);
    expect(ids(lineup.fighters)).toContain(starter);
    expect(ids(lineup.fighters)).not.toContain(back);
    expect(lineup.reserves).toEqual([back, w.bench[1]!.id]);
    expect(lineup.fighters).toHaveLength(5);
  });

  it('a bench fighter coming into a full lineup still sends the starter to the bench, reserves untouched, with Undo', async () => {
    const w = world();
    const benchGuy = w.bench[2]!.id;
    mount(w.store);
    const out = [...w.five].reverse().find((e) => e.row === 'back')?.fighterId ?? w.five[4]!.fighterId;
    const row = w.five.find((e) => e.fighterId === out)!.row;
    await act(() => {
      squadSelection.value = benchGuy;
    });
    await act(() => {
      fireEvent.keyDown(document.body, { key: row === 'front' ? 'f' : 'b' });
    });
    const after = lineupOf(w.store, w.club);
    expect(ids(after.fighters)).toContain(benchGuy);
    expect(ids(after.fighters)).not.toContain(out);
    expect(after.reserves).toEqual([w.bench[0]!.id, w.bench[1]!.id]);
    expect(w.store.recentCommands.value.at(-1)?.command.type).toBe('lineup.set');
    expect(toasts.value.at(-1)!.undo).toBeTruthy();
    await act(() => {
      undoLast();
    });
    expect(lineupOf(w.store, w.club).fighters).toEqual(w.five);
    expect(lineupOf(w.store, w.club).reserves).toEqual([w.bench[0]!.id, w.bench[1]!.id]);
  });

  it('an injured starter cannot be named a reserve: the reserve who replaces him leaves the reserve list and Undo brings it back', async () => {
    const w = world();
    const next = structuredClone(w.store.game.value!) as GameState;
    const hurt = w.five[4]!.fighterId;
    next.fighters[hurt]!.injury = { severity: 'moderate', weeksOut: 3, fixtureId: null, round: null, causeFighterId: null } as never;
    w.store.replaceWorld(next);
    mount(w.store);
    const reserve = w.bench[0]!.id;
    await act(() => {
      squadSelection.value = reserve;
    });
    await act(() => {
      fireEvent.click(screen.getByTestId(`bring-in-${reserve}`));
    });
    const after = lineupOf(w.store, w.club);
    expect(ids(after.fighters)).toContain(reserve);
    expect(ids(after.fighters)).not.toContain(hurt);
    expect(after.reserves).toEqual([w.bench[1]!.id]);
    await act(() => {
      undoLast();
    });
    expect(lineupOf(w.store, w.club).reserves).toEqual([reserve, w.bench[1]!.id]);
    expect(lineupOf(w.store, w.club).fighters).toEqual(w.five);
  });

  it('a reserve joining a lineup with an empty place just leaves the reserve list (nobody is displaced), Undo restores it', async () => {
    const w = world();
    const next = structuredClone(w.store.game.value!) as GameState;
    next.clubs[w.club]!.lineup.fighters = next.clubs[w.club]!.lineup.fighters.slice(0, 4);
    w.store.replaceWorld(next);
    mount(w.store);
    const reserve = w.bench[0]!.id;
    await act(() => {
      squadSelection.value = reserve;
    });
    await act(() => {
      fireEvent.keyDown(document.body, { key: 'b' });
    });
    const after = lineupOf(w.store, w.club);
    expect(after.fighters).toHaveLength(5);
    expect(after.reserves).toEqual([w.bench[1]!.id]);
    await act(() => {
      undoLast();
    });
    expect(lineupOf(w.store, w.club).fighters).toHaveLength(4);
    expect(lineupOf(w.store, w.club).reserves).toEqual([reserve, w.bench[1]!.id]);
  });
});
