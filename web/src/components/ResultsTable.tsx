import { useCallback, useState, type MouseEvent } from 'react';
import type { ItemDto } from '../../../src/shared/api';
import { basename, formatBytes, formatDate, formatRelative, relativeTo } from '../format';
import type { SortKey, SortOrder } from '../hooks/useResults';
import { ContextMenu, type ContextMenuPosition } from './ContextMenu';
import { EcosystemBadge } from './EcosystemBadge';
import styles from './ResultsTable.module.css';

interface ResultsTableProps {
  root: string;
  items: ItemDto[];
  checked: ReadonlySet<string>;
  sortOrder: SortOrder;
  onSort: (key: SortKey) => void;
  onToggle: (id: string) => void;
  onToggleAll: (value: boolean) => void;
  onReveal: (id: string) => void;
  onIgnoreProject: (id: string) => void;
}

const COLUMNS: Array<{ key: SortKey; label: string; numeric?: boolean }> = [
  { key: 'path', label: 'Project' },
  { key: 'ecosystem', label: 'Ecosystem' },
  { key: 'lastActivityMs', label: 'Last Activity', numeric: true },
  { key: 'sizeBytes', label: 'Size', numeric: true },
];

export function ResultsTable({
  root,
  items,
  checked,
  sortOrder,
  onSort,
  onToggle,
  onToggleAll,
  onReveal,
  onIgnoreProject,
}: ResultsTableProps) {
  const [menu, setMenu] = useState<{ id: string; position: ContextMenuPosition } | null>(null);
  const closeMenu = useCallback(() => setMenu(null), []);

  const openMenu = (event: MouseEvent, id: string) => {
    event.preventDefault();
    // Keyboard-triggered context menus report 0,0; anchor those to the row instead.
    const rect = event.currentTarget.getBoundingClientRect();
    const fromKeyboard = event.clientX === 0 && event.clientY === 0;
    setMenu({ id, position: fromKeyboard ? { x: rect.left + 40, y: rect.bottom } : { x: event.clientX, y: event.clientY } });
  };

  const allChecked = items.length > 0 && items.every((item) => checked.has(item.id));
  const someChecked = !allChecked && items.some((item) => checked.has(item.id));

  return (
    <div className={styles.wrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.checkCell}>
              <input
                type="checkbox"
                aria-label="Select all"
                checked={allChecked}
                ref={(input) => {
                  if (input) input.indeterminate = someChecked;
                }}
                onChange={(event) => onToggleAll(event.target.checked)}
              />
            </th>
            {COLUMNS.map((column) => {
              const active = sortOrder.key === column.key;
              return (
                <th
                  key={column.key}
                  className={column.numeric ? styles.numeric : undefined}
                  aria-sort={active ? sortOrder.direction : 'none'}
                >
                  <button
                    type="button"
                    className={`${styles.sortButton} ${active ? styles.activeSort : ''}`}
                    onClick={() => onSort(column.key)}
                  >
                    {column.label}
                    {active && <span aria-hidden="true">{sortOrder.direction === 'ascending' ? ' ↑' : ' ↓'}</span>}
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const isChecked = checked.has(item.id);
            return (
              <tr
                key={item.id}
                className={`${styles.row} ${isChecked ? styles.checkedRow : ''}`}
                tabIndex={0}
                onContextMenu={(event) => openMenu(event, item.id)}
              >
                <td className={styles.checkCell}>
                  <input type="checkbox" aria-label={`Select ${item.path}`} checked={isChecked} onChange={() => onToggle(item.id)} />
                </td>
                <td className={styles.nameCell} title={item.path}>
                  <div className={styles.name}>
                    <EcosystemBadge ecosystem={item.ecosystem} />
                    <div className={styles.nameText}>
                      <span className={styles.projectName}>{basename(item.projectPath)}</span>
                      <span className={styles.path}>{relativeTo(item.path, root)}</span>
                    </div>
                  </div>
                </td>
                <td className={styles.muted}>{item.ecosystem}</td>
                <td className={styles.numeric}>
                  {item.lastActivityMs === null ? (
                    <span className={styles.muted}>—</span>
                  ) : (
                    <time
                      className={styles.muted}
                      dateTime={new Date(item.lastActivityMs).toISOString()}
                      title={formatDate(item.lastActivityMs)}
                    >
                      {formatRelative(item.lastActivityMs)}
                    </time>
                  )}
                </td>
                <td className={`${styles.numeric} ${styles.size}`}>{formatBytes(item.sizeBytes)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {menu && (
        <ContextMenu
          position={menu.position}
          items={[
            { label: 'Show in Finder', onSelect: () => onReveal(menu.id) },
            { label: 'Ignore This Project', onSelect: () => onIgnoreProject(menu.id) },
          ]}
          onClose={closeMenu}
        />
      )}
    </div>
  );
}
