import type { ProgressDto } from '../../../src/shared/api';
import { shortenPath } from '../format';
import { Button } from './Button';
import styles from './ScanningView.module.css';

const RADIUS = 80;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const INDETERMINATE_FRACTION = 0.25;

interface ScanningViewProps {
  progress: ProgressDto;
  onCancel: () => void;
}

export function ScanningView({ progress, onCancel }: ScanningViewProps) {
  const measuring = progress.phase === 'measuring' && progress.candidatesFound > 0;
  const fraction = measuring ? progress.candidatesMeasured / progress.candidatesFound : INDETERMINATE_FRACTION;
  const percent = Math.round(fraction * 100);

  return (
    <section className={styles.view} role="status" aria-live="polite">
      <div className={styles.content}>
        <div className={`${styles.ring} ${measuring ? '' : styles.spinning}`}>
          <svg viewBox="0 0 180 180" aria-hidden="true">
            <defs>
              <linearGradient id="scan-gradient" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#8b5cf6" />
                <stop offset="1" stopColor="#22b8dc" />
              </linearGradient>
            </defs>
            <circle className={styles.track} cx="90" cy="90" r={RADIUS} fill="none" strokeWidth="10" />
            <circle
              className={styles.bar}
              cx="90"
              cy="90"
              r={RADIUS}
              fill="none"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={CIRCUMFERENCE * (1 - fraction)}
            />
          </svg>
          <div className={styles.ringLabel}>
            {measuring ? (
              <>
                <span className={styles.ringValue}>{percent}%</span>
                <span className={styles.ringCaption}>measuring</span>
              </>
            ) : (
              <>
                <span className={styles.ringValue}>{progress.candidatesFound}</span>
                <span className={styles.ringCaption}>found so far</span>
              </>
            )}
          </div>
        </div>
        <h1 className={styles.title}>{measuring ? 'Measuring folders…' : 'Searching your projects…'}</h1>
        <span>
          {measuring
            ? `${progress.candidatesMeasured} of ${progress.candidatesFound} folders measured`
            : `${progress.directoriesVisited.toLocaleString('en')} folders visited`}
        </span>
        <span className={styles.path} title={progress.currentPath}>
          {shortenPath(progress.currentPath, 70)}
        </span>
        <Button onClick={onCancel}>Cancel</Button>
      </div>
    </section>
  );
}
