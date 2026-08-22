import type { ReactNode } from 'react';
import styles from './Badge.module.scss';

export type BadgeVariant = 'primary' | 'success' | 'warning' | 'error' | 'neutral';
export type BadgeSize = 'sm' | 'md';

export interface BadgeProps {
  variant?: BadgeVariant;
  size?: BadgeSize;
  children: ReactNode;
}

export function Badge({ variant = 'neutral', size = 'md', children }: BadgeProps) {
  return (
    <span className={[styles.badge, styles[variant], styles[size]].join(' ')}>
      {children}
    </span>
  );
}
