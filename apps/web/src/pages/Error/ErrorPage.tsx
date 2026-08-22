import { Link } from 'react-router-dom';
import { Typography } from '../../ui/atoms/Typography';
import { Button } from '../../ui/atoms/Button';
import { ROUTES } from '../../constants/routes.constants';
import styles from './ErrorPage.module.scss';

export function ErrorPage() {
  return (
    <main className={styles.page}>
      <div className={styles.content}>
        <Typography variant="h1" className={styles.code}>500</Typography>
        <Typography variant="h3">Something went wrong</Typography>
        <Typography variant="body" color="secondary">
          An unexpected error occurred. Please try again later.
        </Typography>
        <Link to={ROUTES.DASHBOARD}>
          <Button variant="primary">Back to Dashboard</Button>
        </Link>
      </div>
    </main>
  );
}
