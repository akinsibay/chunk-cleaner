import { pluralize } from '../format';
import styles from './UnreadableBanner.module.css';

interface UnreadableBannerProps {
  count: number;
  sample: string[];
  onDismiss: () => void;
}

const FULL_DISK_ACCESS_URL = 'x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles';

export function UnreadableBanner({ count, sample, onDismiss }: UnreadableBannerProps) {
  return (
    <aside className={styles.banner} aria-label="Unreadable folders">
      <div className={styles.content}>
        <strong>
          {pluralize(count, 'folder')} couldn't be read and {count === 1 ? 'was' : 'were'} skipped.
        </strong>
        <p className={styles.hint}>
          To include them, give your terminal app Full Disk Access in{' '}
          <a className={styles.link} href={FULL_DISK_ACCESS_URL}>
            System Settings → Privacy &amp; Security → Full Disk Access
          </a>
          , then restart chunkcleaner.
        </p>
        <details>
          <summary>Show folders</summary>
          <ul className={styles.list}>
            {sample.map((path) => (
              <li key={path}>{path}</li>
            ))}
            {count > sample.length && <li>…and {count - sample.length} more</li>}
          </ul>
        </details>
      </div>
      <button type="button" className={styles.dismiss} onClick={onDismiss} aria-label="Dismiss">
        ×
      </button>
    </aside>
  );
}
