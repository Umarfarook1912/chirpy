import { Link } from 'react-router-dom';
import { Typography } from '../../ui/atoms/Typography';
import { Button } from '../../ui/atoms/Button';
import { ROUTES } from '../../constants/routes.constants';
import styles from './ErrorPage.module.scss';

export function NotFoundPage() {
  return (
    <main className={styles.page}>
      <div className={styles.content}>
        <Typography variant="h1" className={styles.code}>404</Typography>
        <Typography variant="h3">Page not found</Typography>
        <Typography variant="body" color="secondary">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </Typography>
        <Link to={ROUTES.DASHBOARD}>
          <Button variant="primary">Back to Dashboard</Button>
        </Link>
      </div>
    </main>
  );
}
