import type { ElementType, ReactNode, HTMLAttributes } from 'react';
import styles from './Typography.module.scss';

export type TypographyVariant =
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'body'
  | 'bodySmall'
  | 'caption'
  | 'label';

export type TypographyColor = 'default' | 'secondary' | 'primary' | 'success' | 'warning' | 'error';

export interface TypographyProps extends HTMLAttributes<HTMLElement> {
  variant?: TypographyVariant;
  color?: TypographyColor;
  as?: ElementType;
  children: ReactNode;
}

const DEFAULT_TAGS: Record<TypographyVariant, ElementType> = {
  h1: 'h1',
  h2: 'h2',
  h3: 'h3',
  h4: 'h4',
  body: 'p',
  bodySmall: 'p',
  caption: 'span',
  label: 'span',
};

export function Typography({
  variant = 'body',
  color = 'default',
  as,
  children,
  className,
  ...rest
}: TypographyProps) {
  const Tag = as ?? DEFAULT_TAGS[variant];
  const classes = [styles[variant], styles[color], className ?? ''].filter(Boolean).join(' ');
  return (
    <Tag className={classes} {...rest}>
      {children}
    </Tag>
  );
}
