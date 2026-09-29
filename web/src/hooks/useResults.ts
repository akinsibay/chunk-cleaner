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

/** Sorting and checkbox selection for the scan results. */
export function useResults(items: readonly ItemDto[]) {
  const [sortOrder, setSortOrder] = useState<SortOrder>(DEFAULT_SORT);
  const [checkedIds, setCheckedIds] = useState<ReadonlySet<string>>(new Set());

  const sorted = useMemo(() => {
    const factor = sortOrder.direction === 'ascending' ? 1 : -1;
    return [...items].sort((a, b) => factor * compare(a, b, sortOrder.key));
  }, [items, sortOrder]);

  // Drop ids that disappeared after a rescan so the totals never include stale items.
  const checked = useMemo(() => {
    const present = new Set(items.map((item) => item.id));
    return new Set([...checkedIds].filter((id) => present.has(id)));
  }, [items, checkedIds]);

  const checkedItems = useMemo(() => items.filter((item) => checked.has(item.id)), [items, checked]);
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
    (value: boolean) => setCheckedIds(value ? new Set(items.map((item) => item.id)) : new Set()),
    [items],
  );

  return { sorted, sortOrder, sortBy, checked, checkedItems, checkedBytes, breakdown, totalBytes, toggle, setAll };
}
