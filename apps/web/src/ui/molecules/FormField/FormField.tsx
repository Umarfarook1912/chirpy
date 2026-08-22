import type { ReactNode } from 'react';
import styles from './FormField.module.scss';

export interface FormFieldProps {
  children: ReactNode;
  errorMessage?: string;
}

export function FormField({ children, errorMessage }: FormFieldProps) {
  return (
    <div className={styles.field}>
      {children}
      {errorMessage && (
        <span className={styles.error} role="alert">
          {errorMessage}
        </span>
      )}
    </div>
  );
}
