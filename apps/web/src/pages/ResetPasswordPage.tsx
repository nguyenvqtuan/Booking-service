import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('auth');
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
      <AuthLayout title={t('reset.title')}>
        <p className="form-error">{t('reset.invalidLink')}</p>
        <Link to="/forgot-password">{t('reset.resendLink')}</Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={t('reset.title')}>
      {done ? (
        <p role="status">
          {t('reset.done')} <Link to="/login">{t('reset.loginLink')}</Link>
        </p>
      ) : (
        <form onSubmit={onSubmit} noValidate>
          <FormField
            label={t('fields.newPassword')}
            type="password"
            autoComplete="new-password"
            error={fieldErrorMessage(errors.password, 'password')}
            {...register('password')}
          />
          <FormField
            label={t('fields.confirmPassword')}
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
            {t('reset.submit')}
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
