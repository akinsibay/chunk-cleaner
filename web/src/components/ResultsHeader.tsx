import { formatBytes, pluralize, shortenPath } from '../format';
import { Button } from './Button';
import { RefreshIcon } from './icons';
import styles from './ResultsHeader.module.css';

interface ResultsHeaderProps {
  root: string;
  count: number;
  totalBytes: number;
  disabled: boolean;
  onRescan: () => void;
}

export function ResultsHeader({ root, count, totalBytes, disabled, onRescan }: ResultsHeaderProps) {
  return (
    <header className={styles.header}>
      <div>
        <p className={styles.eyebrow}>Reclaimable space</p>
        <h1 className={styles.total}>{formatBytes(totalBytes)}</h1>
        <p className={styles.detail}>
          {pluralize(count, 'folder')} in{' '}
          <span className={styles.folder} title={root}>
            {shortenPath(root, 60)}
          </span>
        </p>
      </div>
      <Button onClick={onRescan} disabled={disabled}>
        <RefreshIcon />
        Rescan
      </Button>
    </header>
  );
}
