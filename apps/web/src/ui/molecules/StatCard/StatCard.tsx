import type { ReactNode } from 'react';
import { Typography } from '../../atoms/Typography';
import styles from './StatCard.module.scss';

export interface StatCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  trend?: {
    value: number;
    label: string;
  };
  variant?: 'default' | 'primary';
}

export function StatCard({ label, value, icon, trend, variant = 'default' }: StatCardProps) {
  const trendPositive = (trend?.value ?? 0) >= 0;

  return (
    <div className={[styles.card, styles[variant]].join(' ')}>
      <div className={styles.header}>
        <Typography variant="label" color="secondary">
          {label}
        </Typography>
        {icon && <span className={styles.icon}>{icon}</span>}
      </div>
      <Typography variant="h2" className={styles.value}>
        {value}
      </Typography>
      {trend && (
        <Typography
          variant="caption"
          color={trendPositive ? 'success' : 'error'}
          className={styles.trend}
        >
          {trendPositive ? '↑' : '↓'} {Math.abs(trend.value)}% {trend.label}
        </Typography>
      )}
    </div>
  );
}
