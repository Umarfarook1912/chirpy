import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import styles from './Input.module.scss';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  errorMessage?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, hint, errorMessage, leftIcon, rightIcon, id, required, className, ...rest }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
    const hasError = Boolean(errorMessage);

    const inputClasses = [
      styles.input,
      hasError ? styles.error : '',
      leftIcon ? styles.withLeftIcon : '',
      rightIcon ? styles.withRightIcon : '',
      className ?? '',
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div className={styles.wrapper}>
        {label && (
          <label className={styles.label} htmlFor={inputId}>
            {label}
            {required && <span className={styles.required} aria-hidden="true">*</span>}
          </label>
        )}
        <div className={styles.inputWrapper}>
          {leftIcon && <span className={styles.leftIcon}>{leftIcon}</span>}
          <input
            ref={ref}
            id={inputId}
            className={inputClasses}
            required={required}
            aria-invalid={hasError}
            aria-describedby={hasError ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
            {...rest}
          />
          {rightIcon && <span className={styles.rightIcon}>{rightIcon}</span>}
        </div>
        {hint && !hasError && (
          <span id={`${inputId}-hint`} className={styles.hint}>
            {hint}
          </span>
        )}
        {hasError && (
          <span id={`${inputId}-error`} className={styles.errorMessage} role="alert">
            {errorMessage}
          </span>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';
