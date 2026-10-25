/**
 * DataTable: the designer's `.data-table` with sorting, sticky headers,
 * keyboard row navigation and an empty state (04 §6.2 "Tables").
 * - Click a header to sort (again to reverse); `aria-sort` on the header.
 *   With `sortKey` the sort is remembered per table (localStorage, view
 *   state per device, 05 §5).
 * - ↑ ↓ move the selection, Enter opens the row, Home / End jump; the row
 *   stays selected when returning (controlled `selectedKey`).
 * - Numbers right-aligned (`align: 'num'`), never truncated; names truncate
 *   (`fill: true` column = `.cell-fill`).
 * Sorting is stable (ties keep the input order). No virtualization: M1
 * tables stay under ~300 rows (05 §8 budget: sort ≤ 50 ms).
 */
import type { ComponentChildren, JSX } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { t } from '../text';
import { tipAttrs, type Tip } from './Tooltip';

export type SortDir = 'asc' | 'desc';
export interface SortState {
  column: string;
  dir: SortDir;
}

export interface Column<R> {
  id: string;
  header: ComponentChildren;
  /** Accessible name when the header is an icon or abbreviation. */
  headerLabel?: string;
  headerTip?: Tip;
  cell: (row: R, index: number) => ComponentChildren;
  /** Makes the column sortable. */
  sortValue?: (row: R) => number | string;
  /** First click direction (numbers usually start descending). */
  firstDir?: SortDir;
  align?: 'left' | 'num' | 'center';
  /** Takes the remaining width; its entity truncates. */
  fill?: boolean;
  /** Extra classes on th and td, e.g. 'col-wide', 'col-mid', 'cell-tight'. */
  class?: string;
  /** Per-cell attributes (tooltips, data-sort...). */
  cellAttrs?: (row: R) => Record<string, string>;
}

export interface DataTableProps<R> {
  columns: readonly Column<R>[];
  rows: readonly R[];
  rowKey: (row: R) => string;
  /** Accessible table name. */
  label: string;
  variant?: readonly ('compact' | 'dense' | 'zebra')[];
  /** Remember the sort under this key. */
  sortKey?: string;
  defaultSort?: SortState | null;
  /** Controlled sort (optional). */
  sort?: SortState | null;
  onSortChange?: (sort: SortState | null) => void;
  selectedKey?: string | null;
  onSelect?: (key: string, row: R) => void;
  onOpen?: (row: R) => void;
  rowClass?: (row: R) => string | undefined;
  /** Extra row props (data-zone, draggable, drag handlers). */
  rowAttrs?: (row: R) => Record<string, unknown>;
  empty?: ComponentChildren;
  /** CSS max-height of the scroll area (sticky header inside). */
  maxHeight?: string;
  hideHeader?: boolean;
  testId?: string;
  /** Extra keys handled while the table has focus (e.g. F / B / R on Squad). */
  onKey?: (e: KeyboardEvent, row: R | null) => boolean | void;
}

const STORAGE_PREFIX = 'al.sort.';

function loadSort(key: string | undefined): SortState | null | undefined {
  if (!key) return undefined;
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return undefined;
    const v = JSON.parse(raw) as SortState | null;
    return v;
  } catch {
    return undefined;
  }
}

function saveSort(key: string | undefined, sort: SortState | null): void {
  if (!key) return;
  try {
    window.localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(sort));
  } catch {
    /* storage is optional */
  }
}

export function compareValues(a: number | string, b: number | string): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

export function sortRows<R>(rows: readonly R[], columns: readonly Column<R>[], sort: SortState | null): R[] {
  const col = sort ? columns.find((c) => c.id === sort.column && c.sortValue) : undefined;
  if (!sort || !col?.sortValue) return [...rows];
  const sign = sort.dir === 'asc' ? 1 : -1;
  const keyed = rows.map((row, i) => ({ row, i, v: col.sortValue!(row) }));
  keyed.sort((x, y) => compareValues(x.v, y.v) * sign || x.i - y.i);
  return keyed.map((k) => k.row);
}

export function DataTable<R>(props: DataTableProps<R>) {
  const { columns, rows, rowKey } = props;
  const [internalSort, setInternalSort] = useState<SortState | null>(() => {
    const stored = loadSort(props.sortKey);
    return stored === undefined ? (props.defaultSort ?? null) : stored;
  });
  const sort = props.sort !== undefined ? props.sort : internalSort;
  const [internalSel, setInternalSel] = useState<string | null>(null);
  const selectedKey = props.selectedKey !== undefined ? props.selectedKey : internalSel;
  const bodyRef = useRef<HTMLTableSectionElement>(null);

  const sorted = useMemo(() => sortRows(rows, columns, sort), [rows, columns, sort]);

  const setSort = (next: SortState | null) => {
    if (props.sort === undefined) setInternalSort(next);
    saveSort(props.sortKey, next);
    props.onSortChange?.(next);
  };

  const clickHeader = (col: Column<R>) => {
    if (!col.sortValue) return;
    if (sort?.column === col.id) setSort({ column: col.id, dir: sort.dir === 'asc' ? 'desc' : 'asc' });
    else setSort({ column: col.id, dir: col.firstDir ?? (col.align === 'num' ? 'desc' : 'asc') });
  };

  const select = (key: string, row: R) => {
    if (props.selectedKey === undefined) setInternalSel(key);
    props.onSelect?.(key, row);
  };

  // Keep the selected row visible after keyboard moves.
  useEffect(() => {
    if (!selectedKey || !bodyRef.current) return;
    const el = [...bodyRef.current.querySelectorAll<HTMLElement>('tr[data-key]')].find((tr) => tr.dataset.key === selectedKey);
    el?.scrollIntoView?.({ block: 'nearest' });
  }, [selectedKey]);

  const onKeyDown = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement).closest('input, select, textarea, button, a') && e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    const idx = selectedKey ? sorted.findIndex((r) => rowKey(r) === selectedKey) : -1;
    const current = idx >= 0 ? sorted[idx]! : null;
    if (props.onKey && props.onKey(e, current) === true) {
      e.preventDefault();
      return;
    }
    let next: number;
    if (e.key === 'ArrowDown') next = Math.min(sorted.length - 1, idx + 1);
    else if (e.key === 'ArrowUp') next = idx <= 0 ? 0 : idx - 1;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = sorted.length - 1;
    else if (e.key === 'Enter' && current && props.onOpen) {
      e.preventDefault();
      props.onOpen(current);
      return;
    } else return;
    if (next >= 0 && sorted[next]) {
      e.preventDefault();
      select(rowKey(sorted[next]!), sorted[next]!);
    }
  };

  const variants = (props.variant ?? []).map((v) => ` data-table--${v}`).join('');
  const cellClass = (col: Column<R>): string | undefined => {
    const cls = [col.align === 'num' ? 'cell-num' : col.align === 'center' ? 'cell-center' : '', col.fill ? 'cell-fill' : '', col.class ?? '']
      .filter(Boolean)
      .join(' ');
    return cls || undefined;
  };

  const wrapStyle: JSX.CSSProperties | undefined = props.maxHeight ? { maxHeight: props.maxHeight } : undefined;

  return (
    <div
      class="table-wrap"
      style={wrapStyle}
      tabIndex={0}
      role="region"
      aria-label={props.label}
      onKeyDown={onKeyDown}
      data-testid={props.testId}
    >
      <table class={`data-table${variants}`} aria-label={props.label}>
        {!props.hideHeader && (
          <thead>
            <tr>
              {columns.map((col) => {
                const active = sort?.column === col.id;
                const ariaSort = active ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : undefined;
                return (
                  <th key={col.id} class={cellClass(col)} aria-sort={ariaSort} scope="col" {...tipAttrs(col.headerTip)}>
                    {col.sortValue ? (
                      <button
                        class="th-sort"
                        type="button"
                        aria-label={col.headerLabel ? `${t('table.sortBy')} ${col.headerLabel}` : undefined}
                        onClick={() => clickHeader(col)}
                      >
                        {col.header}
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
        )}
        <tbody ref={bodyRef}>
          {sorted.length === 0 ? (
            <tr class="data-table__empty">
              <td colSpan={columns.length}>{props.empty ?? <div class="empty empty--compact">{t('table.empty')}</div>}</td>
            </tr>
          ) : (
            sorted.map((row, i) => {
              const key = rowKey(row);
              const extra = props.rowAttrs?.(row) ?? {};
              return (
                <tr
                  key={key}
                  data-key={key}
                  class={props.rowClass?.(row)}
                  aria-selected={props.onSelect || props.selectedKey !== undefined ? (key === selectedKey ? 'true' : 'false') : undefined}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest('select, input, button')) return;
                    select(key, row);
                  }}
                  onDblClick={() => props.onOpen?.(row)}
                  {...extra}
                >
                  {columns.map((col) => (
                    <td key={col.id} class={cellClass(col)} {...(col.cellAttrs?.(row) ?? {})}>
                      {col.cell(row, i)}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
