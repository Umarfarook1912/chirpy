import type { ReactNode } from 'react';
import { Typography } from '../../atoms/Typography';
import { Button } from '../../atoms/Button';
import styles from './EmptyState.module.scss';

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  return (
    <div className={styles.container}>
      {icon && <div className={styles.icon}>{icon}</div>}
      <Typography variant="h3">{title}</Typography>
      {description && (
        <Typography variant="bodySmall" color="secondary">
          {description}
        </Typography>
      )}
      {action && (
        <Button variant="primary" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
