import type { UpdateInfo } from '../../../src/shared/api';
import { Button } from './Button';
import styles from './UpdateBanner.module.css';

interface UpdateBannerProps {
  update: UpdateInfo;
  onDownload: () => void;
  onDismiss: () => void;
}

export function UpdateBanner({ update, onDownload, onDismiss }: UpdateBannerProps) {
  return (
    <aside className={styles.banner} aria-label="Update available">
      <span className={styles.text}>
        <span className={styles.version}>ChunkCleaner {update.latestVersion} is available.</span>{' '}
        <span className={styles.muted}>You have {update.currentVersion}.</span>
      </span>
      <Button variant="primary" onClick={onDownload}>
        Download
      </Button>
      <button type="button" className={styles.dismiss} onClick={onDismiss} aria-label="Dismiss">
        ×
      </button>
    </aside>
  );
}
