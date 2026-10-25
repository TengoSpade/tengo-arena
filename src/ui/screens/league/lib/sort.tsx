/**
 * Table sorting for WP7 tables (04 §6.2 "Tables": click a header to sort,
 * again to reverse; header buttons announce aria-sort). Used until WP6's
 * DataTable covers the grouped and zoned tables these screens need.
 */
import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';

export type SortDir = 'asc' | 'desc';
export interface SortState<K extends string> {
  key: K;
  dir: SortDir;
}

export function useSort<K extends string>(initial: SortState<K>) {
  const [sort, setSort] = useState<SortState<K>>(initial);
  const toggle = (key: K, firstDir: SortDir = 'desc') =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: firstDir }));
  return { sort, toggle, setSort };
}

/** Stable sort by a key; ties keep the incoming order (callers pass rows in their canonical order). */
export function sortBy<T>(rows: readonly T[], key: (row: T) => number | string, dir: SortDir): T[] {
  const indexed = rows.map((row, i) => ({ row, i, k: key(row) }));
  indexed.sort((a, b) => {
    let c: number;
    if (typeof a.k === 'number' && typeof b.k === 'number') c = a.k - b.k;
    else c = String(a.k) < String(b.k) ? -1 : String(a.k) > String(b.k) ? 1 : 0;
    if (dir === 'desc') c = -c;
    return c || a.i - b.i;
  });
  return indexed.map((x) => x.row);
}

export function SortTh<K extends string>({
  label,
  sortKey,
  sort,
  onSort,
  num = false,
  firstDir = 'desc',
  tip,
  class: cls,
}: {
  label: ComponentChildren;
  sortKey: K;
  sort: SortState<K>;
  onSort: (key: K, firstDir: SortDir) => void;
  num?: boolean;
  firstDir?: SortDir;
  tip?: string;
  class?: string;
}) {
  const active = sort.key === sortKey;
  const classes = [num ? 'cell-num' : '', cls ?? ''].filter(Boolean).join(' ') || undefined;
  return (
    <th class={classes} aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined} scope="col">
      <button class="th-sort" type="button" data-tip={tip} onClick={() => onSort(sortKey, firstDir)}>
        {label}
      </button>
    </th>
  );
}
