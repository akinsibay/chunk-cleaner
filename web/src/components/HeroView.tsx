import styles from './HeroView.module.css';

interface HeroViewProps {
  title: string;
  subtitle: string;
  folder: string;
  buttonLabel?: string;
  disabled: boolean;
  onScan: () => void;
}

export function HeroView({ title, subtitle, folder, buttonLabel = 'Scan', disabled, onScan }: HeroViewProps) {
  return (
    <section className={styles.hero}>
      <div className={styles.content}>
        <button type="button" className={styles.scanButton} onClick={onScan} disabled={disabled}>
          {buttonLabel}
        </button>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.subtitle}>{subtitle}</p>
        {folder && (
          <span className={styles.folder} title={folder}>
            {folder}
          </span>
        )}
      </div>
    </section>
  );
}
