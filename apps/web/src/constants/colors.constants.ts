export const COLORS = {
  primary: '#C47BE4',
  primaryDark: '#A85CCB',
  primaryLight: '#E8C8F5',
  white: '#FFFFFF',
  background: '#FAF8FC',
  surface: '#FFFFFF',
  text: '#1F1724',
  textSecondary: '#6F6475',
  border: '#E8DFEC',
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',
} as const;

export type ColorKey = keyof typeof COLORS;
