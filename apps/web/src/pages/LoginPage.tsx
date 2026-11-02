import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router';
import { type LoginInput, loginSchema } from '@booking/shared';
import { useAuth } from '../auth/auth-context';
import { AuthLayout } from '../components/AuthLayout';
import { FormField } from '../components/FormField';
import { getApiErrorMessage } from '../lib/api-error';
import { fieldErrorMessage } from '../lib/form-errors';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [submitError, setSubmitError] = useState<string>();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const redirectTo = (location.state as { from?: string } | null)?.from ?? '/';

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(undefined);
    try {
      await login(values);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setSubmitError(getApiErrorMessage(err));
    }
  });

  return (
    <AuthLayout title="Đăng nhập">
      <form onSubmit={onSubmit} noValidate>
        <FormField
          label="Email"
          type="email"
          autoComplete="email"
          error={fieldErrorMessage(errors.email)}
          {...register('email')}
        />
        <FormField
          label="Mật khẩu"
          type="password"
          autoComplete="current-password"
          error={fieldErrorMessage(errors.password, 'password')}
          {...register('password')}
        />
        {submitError && (
          <p className="form-error" role="alert">
            {submitError}
          </p>
        )}
        <button type="submit" className="btn-primary" disabled={isSubmitting}>
          {isSubmitting ? 'Đang đăng nhập…' : 'Đăng nhập'}
        </button>
      </form>
      <p className="auth-links">
        <Link to="/forgot-password">Quên mật khẩu?</Link>
        <span>
          Chưa có tài khoản? <Link to="/register">Đăng ký</Link>
        </span>
      </p>
    </AuthLayout>
  );
}
