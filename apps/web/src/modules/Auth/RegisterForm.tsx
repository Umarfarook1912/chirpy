import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { RegisterSchema } from '@chirpy/shared';
import type { RegisterInput } from '@chirpy/shared';
import { Button } from '../../ui/atoms/Button';
import { Input } from '../../ui/atoms/Input';
import { useAuth } from '../../hooks/useAuth';
import { ROUTES } from '../../constants/routes.constants';
import styles from './AuthForm.module.scss';

export function RegisterForm() {
  const { register: registerUser } = useAuth();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(RegisterSchema),
  });

  const onSubmit = async (data: RegisterInput) => {
    try {
      await registerUser(data);
      void navigate(ROUTES.DASHBOARD);
    } catch {
      setError('root', { message: 'Registration failed. Please try again.' });
    }
  };

  return (
    <form className={styles.form} onSubmit={(e) => { void handleSubmit(onSubmit)(e); }} noValidate>
      <Input
        label="Display Name"
        type="text"
        autoComplete="name"
        required
        errorMessage={errors.displayName?.message}
        {...register('displayName')}
      />
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
        autoComplete="new-password"
        required
        hint="Minimum 8 characters, one uppercase, one number"
        errorMessage={errors.password?.message}
        {...register('password')}
      />
      <Input
        label="Organization Name"
        type="text"
        required
        hint="Your company, team, or institution"
        errorMessage={errors.organizationName?.message}
        {...register('organizationName')}
      />
      {errors.root && (
        <p className={styles.rootError} role="alert">
          {errors.root.message}
        </p>
      )}
      <Button type="submit" variant="primary" fullWidth loading={isSubmitting}>
        {isSubmitting ? 'Creating account...' : 'Create account'}
      </Button>
      <p className={styles.switchLink}>
        Already have an account?{' '}
        <Link to={ROUTES.AUTH.LOGIN}>Sign in</Link>
      </p>
    </form>
  );
}
