import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { type ForgotPasswordInput, forgotPasswordSchema } from '@booking/shared';
import { AuthLayout } from '../components/AuthLayout';
import { FormField } from '../components/FormField';
import { api } from '../lib/api';
import { getApiErrorMessage } from '../lib/api-error';
import { fieldErrorMessage } from '../lib/form-errors';

export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [submitError, setSubmitError] = useState<string>();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(undefined);
    try {
      await api.post('/auth/forgot-password', values);
      setSent(true);
    } catch (err) {
      setSubmitError(getApiErrorMessage(err));
    }
  });

  return (
    <AuthLayout title="Quên mật khẩu">
      {sent ? (
        <p role="status">
          Nếu email đã đăng ký, bạn sẽ nhận được liên kết đặt lại mật khẩu trong vài phút.
        </p>
      ) : (
        <form onSubmit={onSubmit} noValidate>
          <FormField
            label="Email"
            type="email"
            autoComplete="email"
            error={fieldErrorMessage(errors.email)}
            {...register('email')}
          />
          {submitError && (
            <p className="form-error" role="alert">
              {submitError}
            </p>
          )}
          <button type="submit" className="btn-primary" disabled={isSubmitting}>
            Gửi liên kết đặt lại
          </button>
        </form>
      )}
      <p className="auth-links">
        <Link to="/login">Quay lại đăng nhập</Link>
      </p>
    </AuthLayout>
  );
}
