import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useSearchParams } from 'react-router';
import { z } from 'zod';
import { resetPasswordSchema } from '@booking/shared';
import { AuthLayout } from '../components/AuthLayout';
import { FormField } from '../components/FormField';
import { api } from '../lib/api';
import { getApiErrorMessage } from '../lib/api-error';
import { fieldErrorMessage } from '../lib/form-errors';

const formSchema = z
  .object({ password: resetPasswordSchema.shape.password, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'passwords_mismatch',
  });
type FormValues = z.infer<typeof formSchema>;

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [done, setDone] = useState(false);
  const [submitError, setSubmitError] = useState<string>();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(formSchema) });

  const onSubmit = handleSubmit(async ({ password }) => {
    setSubmitError(undefined);
    try {
      await api.post('/auth/reset-password', { token, password });
      setDone(true);
    } catch (err) {
      setSubmitError(getApiErrorMessage(err));
    }
  });

  if (!token) {
    return (
      <AuthLayout title="Đặt lại mật khẩu">
        <p className="form-error">Liên kết không hợp lệ.</p>
        <Link to="/forgot-password">Gửi lại liên kết</Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Đặt lại mật khẩu">
      {done ? (
        <p role="status">
          Đã đổi mật khẩu. <Link to="/login">Đăng nhập</Link>
        </p>
      ) : (
        <form onSubmit={onSubmit} noValidate>
          <FormField
            label="Mật khẩu mới"
            type="password"
            autoComplete="new-password"
            error={fieldErrorMessage(errors.password, 'password')}
            {...register('password')}
          />
          <FormField
            label="Nhập lại mật khẩu"
            type="password"
            autoComplete="new-password"
            error={
              errors.confirmPassword &&
              fieldErrorMessage({ ...errors.confirmPassword, type: 'passwords_mismatch' })
            }
            {...register('confirmPassword')}
          />
          {submitError && (
            <p className="form-error" role="alert">
              {submitError}
            </p>
          )}
          <button type="submit" className="btn-primary" disabled={isSubmitting}>
            Đổi mật khẩu
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
