import { shortenPath } from '../format';
import { Button } from './Button';
import styles from './IgnoredProjects.module.css';

interface IgnoredProjectsProps {
  paths: string[];
  onRemove: (path: string) => void;
}

export function IgnoredProjects({ paths, onRemove }: IgnoredProjectsProps) {
  return (
    <fieldset className={styles.field}>
      <legend className={styles.label}>Ignored projects</legend>
      {paths.length === 0 ? (
        <p className={styles.help}>None. Right-click a result and choose Ignore This Project to hide it from future scans.</p>
      ) : (
        <>
          <p className={styles.help}>These projects, and everything inside them, are skipped when scanning.</p>
          <ul className={styles.list}>
            {paths.map((path) => (
              <li key={path} className={styles.item}>
                <span className={styles.path} title={path}>
                  {shortenPath(path, 44)}
                </span>
                <Button variant="ghost" onClick={() => onRemove(path)} aria-label={`Stop ignoring ${path}`}>
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        </>
      )}
    </fieldset>
  );
}
