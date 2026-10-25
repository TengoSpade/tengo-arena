import { cleanup, fireEvent, render, screen, act } from '@testing-library/preact';
import { useState } from 'preact/hooks';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { fixtureContent } from '../../core/testkit';
import { configureFormat, formatMoney, formatPercentBp, formatSigned, potentialStars, ratingBand, attributeBand } from '../format';
import {
  ClassTag,
  ConfirmButton,
  Crest,
  DataTable,
  FighterName,
  Modal,
  Money,
  PageHeader,
  Panel,
  StatBar,
  Stars,
  Tabs,
  ToastRegion,
  TooltipLayer,
  readTip,
  resetToasts,
  showToast,
  tipAttrs,
  toasts,
  undoLast,
  type Column,
} from './index';

beforeAll(() => configureFormat(fixtureContent()));
afterEach(() => {
  cleanup();
  resetToasts();
  try {
    window.localStorage.clear();
  } catch {
    /* ignore */
  }
});

describe('format', () => {
  it('formats money with the content currency, a true minus and signed gains', () => {
    expect(formatMoney(11840)).toBe('11,840 ts');
    expect(formatMoney(-2398)).toBe('−2,398 ts');
    expect(formatMoney(1552, { signed: true })).toBe('+1,552 ts');
    expect(formatMoney(230, { perWeek: true })).toBe('230 ts/wk');
    expect(formatSigned(-3)).toBe('−3');
    expect(formatPercentBp(1250)).toBe('12.5%');
  });

  it('computes bands and stars in one place', () => {
    expect([1, 5, 6, 10, 11, 15, 16, 20].map(attributeBand)).toEqual([1, 1, 2, 2, 3, 3, 4, 4]);
    expect([39, 40, 54, 55, 69, 70].map(ratingBand)).toEqual([1, 2, 2, 3, 3, 4]);
    expect(potentialStars(66)).toBe(3.5);
    expect(potentialStars(80)).toBe(4);
  });
});

interface Row {
  id: string;
  name: string;
  rating: number;
}
const rows: Row[] = [
  { id: 'a', name: 'Brannoc', rating: 62 },
  { id: 'b', name: 'Ysolde', rating: 59 },
  { id: 'c', name: 'Mira', rating: 65 },
];
const columns: Column<Row>[] = [
  { id: 'name', header: 'Fighter', cell: (r) => r.name, sortValue: (r) => r.name, fill: true },
  { id: 'rating', header: 'Rating', cell: (r) => <span {...tipAttrs(`Rating ${r.rating}`)}>{r.rating}</span>, sortValue: (r) => r.rating, align: 'num' },
];
const names = () => screen.getAllByRole('row').slice(1).map((tr) => tr.querySelector('td')!.textContent);

describe('DataTable', () => {
  it('sorts by header clicks with aria-sort and reverses on a second click', () => {
    render(<DataTable label="Roster" columns={columns} rows={rows} rowKey={(r) => r.id} />);
    expect(names()).toEqual(['Brannoc', 'Ysolde', 'Mira']);
    const ratingHeader = screen.getByText('Rating').closest('th')!;
    fireEvent.click(screen.getByText('Rating'));
    expect(ratingHeader.getAttribute('aria-sort')).toBe('descending');
    expect(names()).toEqual(['Mira', 'Brannoc', 'Ysolde']);
    fireEvent.click(screen.getByText('Rating'));
    expect(ratingHeader.getAttribute('aria-sort')).toBe('ascending');
    expect(names()).toEqual(['Ysolde', 'Brannoc', 'Mira']);
    expect(ratingHeader.classList.contains('cell-num')).toBe(true);
  });

  it('remembers the sort per table', () => {
    const { unmount } = render(<DataTable label="T" sortKey="test.table" columns={columns} rows={rows} rowKey={(r) => r.id} />);
    fireEvent.click(screen.getByText('Fighter'));
    unmount();
    render(<DataTable label="T" sortKey="test.table" columns={columns} rows={rows} rowKey={(r) => r.id} />);
    expect(names()).toEqual(['Brannoc', 'Mira', 'Ysolde']);
  });

  it('moves the selection with arrow keys and opens with Enter', () => {
    const onOpen = vi.fn();
    function Host() {
      const [sel, setSel] = useState<string | null>(null);
      return <DataTable label="Roster" columns={columns} rows={rows} rowKey={(r) => r.id} selectedKey={sel} onSelect={setSel} onOpen={onOpen} />;
    }
    render(<Host />);
    const region = screen.getByRole('region', { name: 'Roster' });
    fireEvent.keyDown(region, { key: 'ArrowDown' });
    fireEvent.keyDown(region, { key: 'ArrowDown' });
    const selected = screen.getAllByRole('row').filter((tr) => tr.getAttribute('aria-selected') === 'true');
    expect(selected).toHaveLength(1);
    expect(selected[0]!.textContent).toContain('Ysolde');
    fireEvent.keyDown(region, { key: 'Enter' });
    expect(onOpen).toHaveBeenCalledWith(rows[1]);
  });

  it('shows the empty state', () => {
    render(<DataTable label="Empty" columns={columns} rows={[]} rowKey={(r) => r.id} empty={<span>No fighters match</span>} />);
    expect(screen.getByText('No fighters match')).toBeTruthy();
  });
});

describe('tooltips', () => {
  it('encodes plain and rich tips and the layer shows them on focus', async () => {
    expect(tipAttrs('Plain')).toEqual({ 'data-tip': 'Plain' });
    expect(tipAttrs(null)).toEqual({});
    const rich = { kicker: 'Balance', title: '11,840 ts', rows: [{ label: 'Wages', value: '−2,685' }] };
    render(
      <>
        <TooltipLayer />
        <button type="button" {...tipAttrs(rich)}>
          Balance
        </button>
      </>,
    );
    const btn = screen.getByText('Balance', { selector: 'button' });
    expect(readTip(btn)).toEqual(rich);
    await act(() => {
      btn.focus();
    });
    const tip = screen.getByRole('tooltip');
    expect(tip.textContent).toContain('11,840 ts');
    expect(tip.querySelector('.tooltip__rows')).toBeTruthy();
    await act(() => {
      fireEvent.keyDown(document, { key: 'Escape' });
    });
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
});

describe('toasts', () => {
  it('stacks at most three and Ctrl Z runs the newest undo', async () => {
    render(<ToastRegion />);
    const undo = vi.fn();
    await act(() => {
      showToast({ title: 'One' });
      showToast({ title: 'Two' });
      showToast({ title: 'Three', undo });
      showToast({ title: 'Four' });
    });
    expect(toasts.value.map((x) => x.title)).toEqual(['Two', 'Three', 'Four']);
    expect(screen.getByText('Undo')).toBeTruthy();
    await act(() => {
      expect(undoLast()).toBe(true);
    });
    expect(undo).toHaveBeenCalledTimes(1);
    expect(toasts.value.map((x) => x.title)).toEqual(['Two', 'Four']);
    expect(undoLast()).toBe(false);
  });
});

describe('Modal and ConfirmButton', () => {
  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Keyboard shortcuts">
        <p>Body</p>
      </Modal>,
    );
    expect(screen.getByText('Keyboard shortcuts')).toBeTruthy();
    fireEvent.keyDown(screen.getByText('Body'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('opens the commit dialog with the consequences and confirms once', async () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmButton
        testId="release"
        title="Release Brannoc Hale"
        confirmLabel="Release for 10,620 ts"
        consequences={[{ label: 'Balance after', value: '1,220 ts' }]}
        warning="This cannot be undone."
        onConfirm={onConfirm}
        variant="danger"
      >
        Release
      </ConfirmButton>,
    );
    fireEvent.click(screen.getByTestId('release'));
    expect(screen.getByText('Balance after')).toBeTruthy();
    expect(screen.getByText('This cannot be undone.')).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByTestId('release-confirm'));
    });
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('does not open while disabled', () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmButton testId="renew" title="Renew" confirmLabel="Renew" onConfirm={onConfirm} disabled disabledReason="Renewal opens in his final season.">
        Renew
      </ConfirmButton>,
    );
    const btn = screen.getByTestId('renew');
    expect(btn.getAttribute('aria-disabled')).toBe('true');
    expect(btn.getAttribute('data-tip')).toBe('Renewal opens in his final season.');
    fireEvent.click(btn);
    expect(screen.queryByText('Renew', { selector: '.modal__title' })).toBeNull();
  });
});

describe('Tabs', () => {
  it('moves with the arrow keys (roving tabindex)', () => {
    function Host() {
      const [sel, setSel] = useState<'a' | 'b' | 'c'>('a');
      return (
        <Tabs
          idPrefix="t"
          label="Sections"
          selected={sel}
          onSelect={setSel}
          tabs={[
            { id: 'a', label: 'Overview' },
            { id: 'b', label: 'Tactics', count: 3 },
            { id: 'c', label: 'Contract' },
          ]}
        />
      );
    }
    render(<Host />);
    const list = screen.getByRole('tablist');
    fireEvent.keyDown(list, { key: 'ArrowRight' });
    const tabs = screen.getAllByRole('tab');
    expect(tabs[1]!.getAttribute('aria-selected')).toBe('true');
    expect(tabs[1]!.tabIndex).toBe(0);
    expect(tabs[0]!.tabIndex).toBe(-1);
    fireEvent.keyDown(list, { key: 'ArrowLeft' });
    fireEvent.keyDown(list, { key: 'ArrowLeft' });
    expect(screen.getAllByRole('tab')[2]!.getAttribute('aria-selected')).toBe('true');
  });
});

describe('domain components', () => {
  it('StatBar carries band, value, ceiling and wear', () => {
    const { container } = render(<StatBar label="Strength" value={15} cap={16} peak={17} delta={1} tip="Strength 15" />);
    const bar = container.querySelector('.stat-bar') as HTMLElement;
    expect(bar.getAttribute('data-band')).toBe('3');
    expect(bar.style.getPropertyValue('--cap')).toBe('16');
    expect(container.querySelector('.stat-bar__wear')).toBeTruthy();
    expect(container.querySelector('.delta--up')?.textContent).toContain('1');
  });

  it('FighterName links to the profile with the captain mark', () => {
    render(<FighterName name="Brannoc Hale" href="#/fighter/f-1" role="tank" race="human" captain="captain" />);
    const link = screen.getByText('Brannoc Hale');
    expect(link.getAttribute('href')).toBe('#/fighter/f-1');
    expect(document.querySelector('.captain-mark')).toBeTruthy();
    expect(document.querySelector('.portrait[data-role="tank"][data-race="human"]')).toBeTruthy();
  });

  it('ClassTag shows both glyphs for a hybrid with a tooltip', () => {
    const { container } = render(<ClassTag name="Vowknight" roles={['tank', 'healer']} roleNames={['Tank', 'Healer']} />);
    expect(container.querySelectorAll('.role-glyph')).toHaveLength(2);
    expect(container.querySelector('.class-tag')!.getAttribute('data-tip')).toBe('Hybrid: Tank and Healer');
  });

  it('Stars, Money, Crest, Panel and PageHeader render the designer classes', () => {
    const { container } = render(
      <Panel title="Club" icon="coins" subtitle="2 items" actions={<button type="button">Finances</button>} footer="Source: ledger">
        <PageHeader eyebrow="Season 1" title="Matchweek 7" meta={['2nd of 8', null, '10 matchweeks left']} />
        <Stars potential={66} />
        <Money amount={-2398} tip="This week" tone />
        <Crest primary="#ffffff" secondary="#f4f4f4" code="VLG" size="md" />
      </Panel>,
    );
    expect(container.querySelectorAll('.star')).toHaveLength(5);
    expect(container.querySelector('.star--half')).toBeTruthy();
    expect(screen.getByText('−2,398 ts').classList.contains('u-bad')).toBe(true);
    expect((container.querySelector('.crest') as HTMLElement).style.getPropertyValue('--crest-rim')).not.toBe('');
    expect(container.querySelectorAll('.page-header__meta .sep-dot')).toHaveLength(1);
    expect(container.querySelector('.panel__title')!.textContent).toBe('Club');
  });
});
