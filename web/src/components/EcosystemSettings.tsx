import type { EcosystemInfo } from '../../../src/shared/api';
import { EcosystemBadge } from './EcosystemBadge';
import styles from './EcosystemSettings.module.css';

interface EcosystemSettingsProps {
  ecosystems: EcosystemInfo[] | null;
  error: string | null;
  disabled: readonly string[];
  onToggle: (ecosystem: string, enabled: boolean) => void;
}

/** Renders "bin or obj with a *.csproj file next to it" with the folder names in code style. */
function Condition({ text, folderNames }: { text: string; folderNames: string[] }) {
  const separator = text.indexOf(' with ');
  if (separator === -1) return <>{text}</>;
  const folders = text.slice(0, separator).split(' or ');
  if (!folders.every((name) => folderNames.includes(name))) return <>{text}</>;
  return (
    <>
      {folders.map((name, index) => (
        <span key={name}>
          {index > 0 && ' or '}
          <code>{name}</code>
        </span>
      ))}
      {text.slice(separator)}
    </>
  );
}

export function EcosystemSettings({ ecosystems, error, disabled, onToggle }: EcosystemSettingsProps) {
  if (error) {
    return (
      <p className={styles.error} role="alert">
        {error}
      </p>
    );
  }
  if (!ecosystems) return <p className={styles.summary}>Loading ecosystems…</p>;

  const enabledCount = ecosystems.filter((entry) => !disabled.includes(entry.ecosystem)).length;

  return (
    <>
      <p className={styles.summary}>
        {enabledCount} of {ecosystems.length} ecosystems on. Turned-off ecosystems are skipped entirely: their folders are never
        listed, measured or looked inside.
      </p>
      <ul className={styles.list}>
        {ecosystems.map((entry) => {
          const enabled = !disabled.includes(entry.ecosystem);
          const id = `ecosystem-${entry.ecosystem.replace(/\W/g, '')}`;
          return (
            <li key={entry.ecosystem} className={`${styles.item} ${enabled ? '' : styles.off}`}>
              <EcosystemBadge ecosystem={entry.ecosystem} small />
              <div className={styles.text}>
                <label htmlFor={id} className={styles.name}>
                  {entry.ecosystem}
                </label>
                {entry.conditions.map((condition) => (
                  <span key={condition} className={styles.condition}>
                    <Condition text={condition} folderNames={entry.folderNames} />
                  </span>
                ))}
              </div>
              <input
                id={id}
                type="checkbox"
                role="switch"
                className={styles.switch}
                checked={enabled}
                onChange={(event) => onToggle(entry.ecosystem, event.target.checked)}
              />
            </li>
          );
        })}
      </ul>
    </>
  );
}
