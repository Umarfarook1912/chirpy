import styles from './Spinner.module.scss';

export type SpinnerSize = 'sm' | 'md' | 'lg';

export interface SpinnerProps {
  size?: SpinnerSize;
  label?: string;
}

export function Spinner({ size = 'md', label = 'Loading...' }: SpinnerProps) {
  return (
    <span
      className={[styles.spinner, styles[size]].join(' ')}
      role="status"
      aria-label={label}
    >
      <span className={styles.sr}>
        {label}
      </span>
    </span>
  );
}
