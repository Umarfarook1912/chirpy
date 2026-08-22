import { RegisterForm } from '../../modules/Auth/RegisterForm';
import { Typography } from '../../ui/atoms/Typography';
import styles from './AuthPage.module.scss';

export function RegisterPage() {
  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.logo}>C</div>
          <Typography variant="h2">Create your account</Typography>
          <Typography variant="bodySmall" color="secondary">
            Start tracking meeting engagement for your organization
          </Typography>
        </div>
        <RegisterForm />
      </div>
    </main>
  );
}
