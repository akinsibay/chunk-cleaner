import { ecosystemMeta } from '../ecosystems';
import styles from './EcosystemBadge.module.css';

export function EcosystemBadge({ ecosystem, small = false }: { ecosystem: string; small?: boolean }) {
  const { abbreviation, tone } = ecosystemMeta(ecosystem);
  return (
    <span className={`${styles.badge} ${styles[tone]} ${small ? styles.small : ''}`} aria-hidden="true">
      {abbreviation}
    </span>
  );
}
