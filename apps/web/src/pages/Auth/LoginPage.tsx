import { LoginForm } from '../../modules/Auth/LoginForm';
import { Typography } from '../../ui/atoms/Typography';
import styles from './AuthPage.module.scss';

export function LoginPage() {
  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.logo}>C</div>
          <Typography variant="h2">Sign in to Chirpy</Typography>
          <Typography variant="bodySmall" color="secondary">
            Track and improve meeting engagement
          </Typography>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
