/**
 * WP6 screen tests on the fixture content (05 §9.2): Home, Squad, Fighter,
 * New game, Club select and Codex render the dev world and dispatch the
 * right commands. Uses a real store on a fake platform (src/ui/debug).
 */
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/preact';
import { afterEach, describe, expect, it } from 'vitest';
import type { ClubId, FighterId, GameState } from '../../core/model';
import { installShortcuts } from '../app/shortcuts';
import { readTip, resetToasts, toasts, undoLast } from '../components';
import { TestProviders, createTestStore } from '../debug/test-store';
import { formatMoney } from '../format';
import { coreEngine } from '../store/engine';
import ClubSelectScreen from './club-select';
import CodexScreen from './codex';
import FighterScreen from './fighter';
import HomeScreen from './home';
import NewGameScreen from './new-game';
import SquadScreen, { squadSelection } from './squad';

let dispose: (() => void) | null = null;
afterEach(() => {
  cleanup();
  resetToasts();
  dispose?.();
  dispose = null;
  squadSelection.value = null;
  try {
    window.localStorage.clear();
  } catch {
    /* ignore */
  }
});

function club(state: GameState) {
  return state.clubs[state.playerClubId as ClubId]!;
}

function mount(node: preact.ComponentChild, store: ReturnType<typeof createTestStore>['store']) {
  dispose = installShortcuts(() => ({}));
  return render(<TestProviders store={store}>{node}</TestProviders>);
}

describe('Squad', () => {
  it('renders the lineup board with five cards and the full roster', () => {
    const { store } = createTestStore();
    mount(<SquadScreen params={{}} />, store);
    const c = club(store.game.value!);
    const board = screen.getByTestId('lineup-board');
    expect(board.querySelectorAll('.lineup-card:not(.lineup-card--empty)')).toHaveLength(5);
    expect(within(board).getByText('Back row')).toBeTruthy();
    expect(within(board).getByText('Front row')).toBeTruthy();
    const roster = Object.values(store.game.value!.fighters).filter((f) => f.clubId === c.id);
    const table = screen.getByTestId('roster-table');
    expect(table.querySelectorAll('tbody tr')).toHaveLength(roster.length);
    expect(screen.getByText(/5 of 5 places filled|of 5 places filled/)).toBeTruthy();
  });

  it('says the five are not all fit when an injured fighter is in the lineup', () => {
    const { store } = createTestStore();
    const state = structuredClone(store.game.value!);
    const c = club(state);
    const hurt = state.fighters[c.lineup.fighters[0]!.fighterId]!;
    hurt.injury = { severity: 'minor', weeksOut: 2, fixtureId: null, round: null, causeFighterId: null, damageBp: 0, since: { season: state.calendar.season, weekIndex: state.calendar.weekIndex } };
    store.replaceWorld(state);
    mount(<SquadScreen params={{}} />, store);
    const check = document.querySelector('.lineup-check')!;
    expect(check.textContent).toContain('All 5 places filled, but 1 fighter is unfit');
    expect(check.textContent).not.toContain('5 of 5 places filled');
    expect(check.textContent).toContain(`${hurt.name.full} is injured and cannot play`);
    // One click brings in the best fit reserve in his place.
    const button = check.querySelector<HTMLButtonElement>('[data-testid^="bring-in-"]')!;
    expect(button.textContent).toMatch(/^Bring in /);
    fireEvent.click(button);
    const after = club(store.game.value!).lineup.fighters;
    expect(after).toHaveLength(5);
    expect(after.some((e) => e.fighterId === hurt.id)).toBe(false);
    expect(after.some((e) => e.fighterId === button.dataset['testid']!.replace('bring-in-', ''))).toBe(true);
  });

  it('moves a reserve into the lineup with F and undoes it with Ctrl Z', async () => {
    const { store } = createTestStore();
    const c = club(store.game.value!);
    const reserve = Object.values(store.game.value!.fighters).find(
      (f) => f.clubId === c.id && !f.injury && !c.lineup.fighters.some((e) => e.fighterId === f.id),
    )!;
    mount(<SquadScreen params={{}} />, store);
    await act(() => {
      squadSelection.value = reserve.id;
    });
    await act(() => {
      fireEvent.keyDown(document.body, { key: 'f' });
    });
    const after = club(store.game.value!);
    expect(after.lineup.fighters.some((e) => e.fighterId === reserve.id && e.row === 'front')).toBe(true);
    expect(after.lineup.fighters).toHaveLength(5);
    expect(toasts.value[0]?.title).toMatch(/replaces|front row/);
    await act(() => {
      undoLast();
    });
    expect(club(store.game.value!).lineup.fighters.map((e) => e.fighterId)).toEqual(c.lineup.fighters.map((e) => e.fighterId));
  });

  it('sets the captain with C and changes a preset from the card', async () => {
    const { store, content } = createTestStore();
    const c = club(store.game.value!);
    const target = c.lineup.fighters.find((e) => e.fighterId !== c.captainId)!.fighterId;
    mount(<SquadScreen params={{}} />, store);
    await act(() => {
      squadSelection.value = target;
    });
    await act(() => {
      fireEvent.keyDown(document.body, { key: 'c' });
    });
    expect(club(store.game.value!).captainId).toBe(target);

    const f = store.game.value!.fighters[target]!;
    const presets = content.classes.require(f.classId).presetIds;
    const select = screen.getByLabelText(`Preset for ${f.name.full}`) as HTMLSelectElement;
    const other = presets.find((p) => p !== select.value)!;
    await act(() => {
      fireEvent.change(select, { target: { value: other } });
    });
    const t = club(store.game.value!).lineup.tactics[target];
    expect(t?.kind === 'preset' && t.presetId).toBe(other);
  });

  it('gives every number on the screen a tooltip (ux-004)', () => {
    const { store } = createTestStore();
    const { container } = mount(<SquadScreen params={{}} />, store);
    expect(untippedNumbers(container)).toEqual([]);
  });

  it('filters the roster and switches to the attributes view', async () => {
    const { store, content } = createTestStore();
    mount(<SquadScreen params={{}} />, store);
    await act(() => {
      fireEvent.click(screen.getByRole('button', { name: /^Injured/ }));
    });
    const rows = screen.getByTestId('roster-table').querySelectorAll('tbody tr');
    expect(rows.length).toBe(1);
    await act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Attributes' }));
    });
    const headers = [...screen.getByTestId('roster-table').querySelectorAll('thead th')].map((th) => th.textContent);
    for (const s of content.stats.list) expect(headers).toContain(s.abbr);
  });
});

describe('Home', () => {
  it('shows the next fixture, the digest, the club panel and the wing table', () => {
    const { store } = createTestStore({ weekIndex: 11 });
    mount(<HomeScreen params={{}} />, store);
    const c = club(store.game.value!);
    expect(within(screen.getByTestId('next-fixture')).getAllByText(c.name).length).toBeGreaterThan(0);
    expect(screen.getByTestId('digest')).toBeTruthy();
    expect(screen.getByTestId('club-panel').textContent).toContain('Wage bill');
    const wing = screen.getByTestId('wing-table');
    const rows = wing.querySelectorAll('tbody tr');
    expect(rows.length).toBe(8);
    expect(wing.querySelectorAll('tbody tr.is-us')).toHaveLength(1);
    expect(wing.querySelectorAll('tbody tr[data-zone="qualify"]')).toHaveLength(4);
  });

  it('shows the preseason checklist when there is no fixture', () => {
    const { store } = createTestStore({ weekIndex: 1 });
    mount(<HomeScreen params={{}} />, store);
    expect(screen.getByTestId('preseason-checklist')).toBeTruthy();
    expect(screen.queryByTestId('next-fixture')).toBeNull();
  });

  it('gives every number on the screen a tooltip (ux-004)', () => {
    const { store } = createTestStore({ weekIndex: 11 });
    const { container } = mount(<HomeScreen params={{}} />, store);
    expect(untippedNumbers(container)).toEqual([]);
  });
});

describe('Fighter profile', () => {
  it('renders the header, twelve attributes, traits and career', () => {
    const { store, content } = createTestStore();
    const c = club(store.game.value!);
    const id = c.lineup.fighters[0]!.fighterId;
    const { container } = mount(<FighterScreen params={{ id }} />, store);
    const f = store.game.value!.fighters[id]!;
    expect(untippedNumbers(container)).toEqual([]);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain(f.name.full);
    expect(screen.getByTestId('attributes').querySelectorAll('.stat-bar')).toHaveLength(content.stats.list.length);
    expect(screen.getByTestId('career')).toBeTruthy();
  });

  it('cycles fighters with ] and opens the tactics tab with T', async () => {
    const { store } = createTestStore();
    const c = club(store.game.value!);
    const roster = Object.values(store.game.value!.fighters).filter((f) => f.clubId === c.id);
    const id = c.lineup.fighters[0]!.fighterId;
    mount(<FighterScreen params={{ id }} />, store);
    await act(() => {
      fireEvent.keyDown(document.body, { key: ']' });
    });
    expect(location.hash).toMatch(/^#\/fighter\/f-\d+$/);
    expect(location.hash).not.toBe(`#/fighter/${id}`);
    expect(roster.some((f) => location.hash === `#/fighter/${f.id}`)).toBe(true);
    await act(() => {
      fireEvent.keyDown(document.body, { key: 't' });
    });
    expect(screen.getByTestId('preset-rules').querySelectorAll('.rule-list > li').length).toBeGreaterThan(1);
  });

  it('opens the release commit dialog with its consequences', async () => {
    const { store } = createTestStore();
    const id = club(store.game.value!).lineup.fighters[1]!.fighterId;
    mount(<FighterScreen params={{ id }} />, store);
    await act(() => {
      fireEvent.click(screen.getByTestId('release'));
    });
    const dialog = screen.getByTestId('release-dialog');
    expect(dialog.textContent).toContain('Roster after');
    expect(dialog.textContent).toContain('A release cannot be undone.');
    // The payout is stated in money before the player confirms, with the balance it leaves.
    const state = store.game.value!;
    const payout = coreEngine.releasePayout(state, club(state).id, id, store.content.value!);
    expect(dialog.textContent).toContain(`Release payout${formatMoney(payout)}`);
    expect(dialog.textContent).toContain(`Balance after${formatMoney(club(state).finance.balance - payout)}`);
    expect(dialog.textContent).not.toContain('.json');
  });

  it('shows a not-found state for an unknown id', () => {
    const { store } = createTestStore();
    mount(<FighterScreen params={{ id: 'f-99999' as FighterId }} />, store);
    expect(screen.getByText('Fighter not found')).toBeTruthy();
  });
});

describe('New career and club select', () => {
  it('generates a world from the title screen and opens the club select', async () => {
    const { store } = createTestStore({ world: 'none' });
    mount(<NewGameScreen params={{}} />, store);
    await act(async () => {
      fireEvent.click(screen.getByTestId('title-new'));
      await new Promise((r) => setTimeout(r, 5));
    });
    expect(store.game.value).not.toBeNull();
    expect(location.hash).toBe('#/club-select');
  });

  it('picks a club and starts the career through the commit dialog', async () => {
    const { store, content } = createTestStore({ playerClubId: null });
    mount(<ClubSelectScreen params={{}} />, store);
    const lowest = Math.max(...content.leagues.tiers.map((t) => t.level));
    const target = content.clubs.list.find((c) => c.startTierLevel === lowest)!;
    const start = screen.getByTestId('start-career');
    expect(start.getAttribute('aria-disabled')).toBe('true');
    await act(() => {
      fireEvent.click(screen.getByTestId(`club-card-${target.id}`));
    });
    await act(() => {
      fireEvent.click(screen.getByTestId('start-career'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('start-career-confirm'));
    });
    expect(store.playerClubId.value).toBe(target.id);
  });
});

describe('Class codex', () => {
  it('filters by role and search, and shows the empty state with reset', async () => {
    const { store, content } = createTestStore();
    mount(<CodexScreen params={{}} />, store);
    expect(document.querySelectorAll('.codex-card')).toHaveLength(content.classes.list.length);
    await act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Show Healer classes' }));
    });
    const healers = content.classes.list.filter((k) => k.archetypes.includes('healer'));
    expect(document.querySelectorAll('.codex-card')).toHaveLength(healers.length);
    await act(() => {
      fireEvent.input(screen.getByLabelText('Search name, ability or role tag'), { target: { value: 'zzzz' } });
    });
    expect(screen.getByText('No class matches')).toBeTruthy();
    await act(() => {
      fireEvent.click(screen.getAllByText('Reset filters')[0]!);
    });
    expect(document.querySelectorAll('.codex-card')).toHaveLength(content.classes.list.length);
  });

  it('opens the detail pane with the kit and presets', async () => {
    const { store, content } = createTestStore();
    const k = content.classes.list[0]!;
    mount(<CodexScreen params={{ class: k.id }} />, store);
    const detail = await screen.findByTestId('class-detail');
    expect(detail.textContent).toContain(content.classAbility(k.id, 'a1').name);
    expect(detail.querySelectorAll('.codex-preset')).toHaveLength(k.presetIds.length);
  });
});

/** Text nodes with digits that have no tooltip on themselves or an ancestor (ux-004 automated check). */
export function untippedNumbers(root: Element): string[] {
  const out: string[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const text = (n.textContent ?? '').trim();
    // Numbers, not prose: short text with a digit (sentences carry their own context).
    if (!/\d/.test(text) || text.length > 24) continue;
    const el = n.parentElement;
    if (!el) continue;
    if (el.closest('kbd, h1, p, option, .page-header__eyebrow, .page-header__meta, .tab, .btn, .chip, .sidenav, svg, .digest__title, .digest__text, .tooltip, .fixture__kind, .empty, .checklist, .panel__footer, .entity__name, .u-sr-only, .trait-row__effect')) continue;
    let p: Element | null = el;
    let found = false;
    while (p && p !== root.parentElement) {
      if (readTip(p)) {
        found = true;
        break;
      }
      p = p.parentElement;
    }
    if (!found) out.push(`${text} @ ${el.tagName.toLowerCase()}.${el.className}`);
  }
  return out;
}
