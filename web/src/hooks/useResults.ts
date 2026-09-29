import { useCallback, useMemo, useState } from 'react';
import type { ItemDto } from '../../../src/shared/api';

export type SortKey = 'path' | 'ecosystem' | 'sizeBytes' | 'lastActivityMs';
export type SortDirection = 'ascending' | 'descending';

export interface SortOrder {
  key: SortKey;
  direction: SortDirection;
}

export interface EcosystemTotal {
  ecosystem: string;
  count: number;
  sizeBytes: number;
}

const DEFAULT_SORT: SortOrder = { key: 'sizeBytes', direction: 'descending' };

function compare(a: ItemDto, b: ItemDto, key: SortKey): number {
  switch (key) {
    case 'path':
    case 'ecosystem':
      return a[key].localeCompare(b[key]);
    case 'sizeBytes':
      return a.sizeBytes - b.sizeBytes;
    case 'lastActivityMs':
      return (a.lastActivityMs ?? 0) - (b.lastActivityMs ?? 0);
  }
}

/**
 * Sorting, ecosystem filtering and checkbox selection for the scan results. Selection totals and
 * select-all only cover visible rows, so nothing hidden by the filter is ever moved to the Trash;
 * hidden selections are kept and come back when the filter is cleared.
 */
export function useResults(items: readonly ItemDto[]) {
  const [sortOrder, setSortOrder] = useState<SortOrder>(DEFAULT_SORT);
  const [checkedIds, setCheckedIds] = useState<ReadonlySet<string>>(new Set());
  const [filterChoice, setFilterChoice] = useState<string | null>(null);

  // A filter for an ecosystem that is no longer in the results (e.g. after a rescan) is dropped.
  const ecosystemFilter = filterChoice !== null && items.some((item) => item.ecosystem === filterChoice) ? filterChoice : null;

  const visible = useMemo(
    () => (ecosystemFilter === null ? items : items.filter((item) => item.ecosystem === ecosystemFilter)),
    [items, ecosystemFilter],
  );

  const sorted = useMemo(() => {
    const factor = sortOrder.direction === 'ascending' ? 1 : -1;
    return [...visible].sort((a, b) => factor * compare(a, b, sortOrder.key));
  }, [visible, sortOrder]);

  // Drop ids that disappeared after a rescan so the totals never include stale items.
  const checked = useMemo(() => {
    const present = new Set(items.map((item) => item.id));
    return new Set([...checkedIds].filter((id) => present.has(id)));
  }, [items, checkedIds]);

  const checkedItems = useMemo(() => visible.filter((item) => checked.has(item.id)), [visible, checked]);
  const checkedBytes = useMemo(() => checkedItems.reduce((sum, item) => sum + item.sizeBytes, 0), [checkedItems]);

  const breakdown = useMemo(() => {
    const totals = new Map<string, EcosystemTotal>();
    for (const item of items) {
      const total = totals.get(item.ecosystem) ?? { ecosystem: item.ecosystem, count: 0, sizeBytes: 0 };
      total.count++;
      total.sizeBytes += item.sizeBytes;
      totals.set(item.ecosystem, total);
    }
    return [...totals.values()].sort((a, b) => b.sizeBytes - a.sizeBytes);
  }, [items]);

  const totalBytes = useMemo(() => items.reduce((sum, item) => sum + item.sizeBytes, 0), [items]);

  const sortBy = useCallback((key: SortKey) => {
    setSortOrder((current) =>
      current.key === key
        ? { key, direction: current.direction === 'ascending' ? 'descending' : 'ascending' }
        : { key, direction: key === 'sizeBytes' || key === 'lastActivityMs' ? 'descending' : 'ascending' },
    );
  }, []);

  const toggle = useCallback((id: string) => {
    setCheckedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const setAll = useCallback(
    (value: boolean) =>
      setCheckedIds((current) => {
        const next = new Set(current);
        for (const item of visible) {
          if (value) next.add(item.id);
          else next.delete(item.id);
        }
        return next;
      }),
    [visible],
  );

  const toggleFilter = useCallback(
    (ecosystem: string) => setFilterChoice((current) => (current === ecosystem ? null : ecosystem)),
    [],
  );
  const clearFilter = useCallback(() => setFilterChoice(null), []);

  return {
    sorted,
    sortOrder,
    sortBy,
    checked,
    checkedItems,
    checkedBytes,
    breakdown,
    totalBytes,
    ecosystemFilter,
    visibleCount: visible.length,
    toggle,
    setAll,
    toggleFilter,
    clearFilter,
  };
}
