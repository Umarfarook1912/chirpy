import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { LoginSchema } from '@chirpy/shared';
import type { LoginInput } from '@chirpy/shared';
import { Button } from '../../ui/atoms/Button';
import { Input } from '../../ui/atoms/Input';
import { useAuth } from '../../hooks/useAuth';
import { ROUTES } from '../../constants/routes.constants';
import styles from './AuthForm.module.scss';

export function LoginForm() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(LoginSchema),
  });

  const onSubmit = async (data: LoginInput) => {
    try {
      await login(data.email, data.password);
      void navigate(ROUTES.DASHBOARD);
    } catch {
      setError('root', { message: 'Invalid email or password. Please try again.' });
    }
  };

  return (
    <form className={styles.form} onSubmit={(e) => { void handleSubmit(onSubmit)(e); }} noValidate>
      <Input
        label="Email"
        type="email"
        autoComplete="email"
        required
        errorMessage={errors.email?.message}
        {...register('email')}
      />
      <Input
        label="Password"
        type="password"
        autoComplete="current-password"
        required
        errorMessage={errors.password?.message}
        {...register('password')}
      />
      {errors.root && (
        <p className={styles.rootError} role="alert">
          {errors.root.message}
        </p>
      )}
      <Button type="submit" variant="primary" fullWidth loading={isSubmitting}>
        {isSubmitting ? 'Signing in...' : 'Sign in'}
      </Button>
      <p className={styles.switchLink}>
        Don&apos;t have an account?{' '}
        <Link to={ROUTES.AUTH.REGISTER}>Create one</Link>
      </p>
    </form>
  );
}
