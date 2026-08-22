import { Typography } from '../../ui/atoms/Typography';
import styles from './SettingsPage.module.scss';

export function SettingsPage() {
  return (
    <div className={styles.page}>
      <Typography variant="h2">Settings</Typography>
      <Typography variant="body" color="secondary">
        Profile and organization settings will be available here.
      </Typography>
    </div>
  );
}
