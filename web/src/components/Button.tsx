import type { ButtonHTMLAttributes } from 'react';
import styles from './Button.module.css';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'danger' | 'ghost';
  size?: 'normal' | 'large';
}

export function Button({ variant = 'default', size = 'normal', className, type = 'button', ...props }: ButtonProps) {
  const classes = [
    styles.button,
    variant !== 'default' ? styles[variant] : '',
    size === 'large' ? styles.large : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');
  return <button type={type} className={classes} {...props} />;
}
