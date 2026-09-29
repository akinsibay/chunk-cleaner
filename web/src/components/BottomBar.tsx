import { formatBytes, pluralize } from '../format';
import { Button } from './Button';
import { TrashIcon } from './icons';
import styles from './BottomBar.module.css';

interface BottomBarProps {
  totalCount: number;
  /** Ecosystem the table is filtered to, if any. */
  filter: string | null;
  checkedCount: number;
  checkedBytes: number;
  busy: boolean;
  onTrash: () => void;
}

export function BottomBar({ totalCount, filter, checkedCount, checkedBytes, busy, onTrash }: BottomBarProps) {
  return (
    <footer className={styles.bar}>
      <div className={styles.summary} aria-live="polite">
        <span className={styles.selected}>{formatBytes(checkedBytes)}</span>
        <span className={styles.detail}>
          {checkedCount} of {pluralize(totalCount, filter ? `${filter} folder` : 'folder')} selected
        </span>
      </div>
      <Button variant="danger" size="large" onClick={onTrash} disabled={checkedCount === 0 || busy}>
        <TrashIcon />
        {busy ? 'Moving to Trash…' : 'Move to Trash'}
      </Button>
    </footer>
  );
}
