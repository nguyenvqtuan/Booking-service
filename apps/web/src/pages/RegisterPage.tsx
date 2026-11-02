import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router';
import { type RegisterInput, registerSchema } from '@booking/shared';
import { useAuth } from '../auth/auth-context';
import { AuthLayout } from '../components/AuthLayout';
import { FormField } from '../components/FormField';
import { getApiErrorMessage } from '../lib/api-error';
import { fieldErrorMessage } from '../lib/form-errors';

export function RegisterPage() {
  const { register: registerAccount } = useAuth();
  const navigate = useNavigate();
  const [submitError, setSubmitError] = useState<string>();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(undefined);
    try {
      await registerAccount(values);
      navigate('/', { replace: true });
    } catch (err) {
      setSubmitError(getApiErrorMessage(err));
    }
  });

  return (
    <AuthLayout title="Đăng ký tiệm">
      <form onSubmit={onSubmit} noValidate>
        <FormField
          label="Tên tiệm"
          autoComplete="organization"
          error={fieldErrorMessage(errors.salonName)}
          {...register('salonName')}
        />
        <FormField
          label="Họ tên chủ tiệm"
          autoComplete="name"
          error={fieldErrorMessage(errors.fullName)}
          {...register('fullName')}
        />
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
          autoComplete="new-password"
          error={fieldErrorMessage(errors.password, 'password')}
          {...register('password')}
        />
        {submitError && (
          <p className="form-error" role="alert">
            {submitError}
          </p>
        )}
        <button type="submit" className="btn-primary" disabled={isSubmitting}>
          {isSubmitting ? 'Đang tạo tài khoản…' : 'Đăng ký'}
        </button>
      </form>
      <p className="auth-links">
        <span>
          Đã có tài khoản? <Link to="/login">Đăng nhập</Link>
        </span>
      </p>
    </AuthLayout>
  );
}
