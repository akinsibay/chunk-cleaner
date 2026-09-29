import { useEffect, useRef } from 'react';
import styles from './ContextMenu.module.css';

export interface ContextMenuPosition {
  x: number;
  y: number;
}

interface ContextMenuProps {
  position: ContextMenuPosition;
  items: Array<{ label: string; onSelect: () => void }>;
  onClose: () => void;
}

/** Right-click menu positioned at the pointer, clamped to the viewport. */
export function ContextMenu({ position, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const menu = ref.current;
    if (!menu) return;
    const x = Math.min(position.x, window.innerWidth - menu.offsetWidth - 8);
    const y = Math.min(position.y, window.innerHeight - menu.offsetHeight - 8);
    menu.style.setProperty('--menu-x', `${x}px`);
    menu.style.setProperty('--menu-y', `${y}px`);
    menu.querySelector('button')?.focus();

    const close = (event: Event) => {
      if (event instanceof KeyboardEvent && event.key !== 'Escape') return;
      if (event.type === 'mousedown' && menu.contains(event.target as Node)) return;
      onClose();
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    window.addEventListener('blur', onClose);
    window.addEventListener('resize', onClose);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
      window.removeEventListener('blur', onClose);
      window.removeEventListener('resize', onClose);
    };
  }, [position, onClose]);

  return (
    <ul ref={ref} className={styles.menu} role="menu">
      {items.map((item) => (
        <li key={item.label} role="none">
          <button
            type="button"
            role="menuitem"
            className={styles.item}
            onClick={() => {
              item.onSelect();
              onClose();
            }}
          >
            {item.label}
          </button>
        </li>
      ))}
    </ul>
  );
}
