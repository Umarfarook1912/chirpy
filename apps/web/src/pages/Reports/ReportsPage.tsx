import { Typography } from '../../ui/atoms/Typography';
import styles from './ReportsPage.module.scss';

export function ReportsPage() {
  return (
    <div className={styles.page}>
      <Typography variant="h2">Reports</Typography>
      <Typography variant="body" color="secondary">
        Organization-wide participation reports and trends will appear here.
      </Typography>
    </div>
  );
}
