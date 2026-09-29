import type { FormEvent } from 'react';
import { formatBytes } from '../format';
import type { EcosystemTotal } from '../hooks/useResults';
import { Button } from './Button';
import { EcosystemBadge } from './EcosystemBadge';
import { FolderIcon, GearIcon, LogoMark } from './icons';
import styles from './Sidebar.module.css';

interface SidebarProps {
  folder: string;
  locked: boolean;
  busy: boolean;
  breakdown: EcosystemTotal[];
  onFolderChange: (folder: string) => void;
  onChooseFolder: () => void;
  onScan: () => void;
  onOpenSettings: () => void;
}

export function Sidebar({ folder, locked, busy, breakdown, onFolderChange, onChooseFolder, onScan, onOpenSettings }: SidebarProps) {
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!locked && folder.trim() !== '') onScan();
  };

  return (
    <nav className={styles.sidebar} aria-label="ChunkCleaner">
      <div className={styles.brand}>
        <LogoMark />
        <div>
          <div className={styles.brandName}>ChunkCleaner</div>
          <div className={styles.brandTagline}>Dev junk cleaner</div>
        </div>
      </div>

      <form className={styles.section} onSubmit={submit}>
        <label htmlFor="folder" className={styles.sectionTitle}>
          Scan location
        </label>
        <div className={styles.locationCard}>
          <input
            id="folder"
            className={styles.folderInput}
            value={folder}
            onChange={(event) => onFolderChange(event.target.value)}
            placeholder="~/Projects"
            spellCheck={false}
            autoComplete="off"
            disabled={locked}
          />
          <Button onClick={onChooseFolder} disabled={locked || busy}>
            <FolderIcon />
            Choose Folder…
          </Button>
        </div>
      </form>

      {breakdown.length > 0 && (
        <section className={styles.section} aria-labelledby="breakdown-title">
          <h2 id="breakdown-title" className={styles.sectionTitle}>
            Found
          </h2>
          <ul className={styles.breakdown}>
            {breakdown.map((entry) => (
              <li key={entry.ecosystem} className={styles.breakdownItem}>
                <EcosystemBadge ecosystem={entry.ecosystem} small />
                <span className={styles.breakdownName}>{entry.ecosystem}</span>
                <span className={styles.breakdownCount}>{entry.count}</span>
                <span className={styles.breakdownSize}>{formatBytes(entry.sizeBytes)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className={styles.footer}>
        <Button variant="ghost" onClick={onOpenSettings}>
          <GearIcon />
          Settings
        </Button>
      </div>
    </nav>
  );
}
