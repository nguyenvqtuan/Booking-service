import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { registerSchema } from '@booking/shared';
import type { z } from 'zod';
import { useAuth } from '../auth/auth-context';
import { AuthLayout } from '../components/AuthLayout';
import { FormField } from '../components/FormField';
import { getApiErrorMessage } from '../lib/api-error';
import { fieldErrorMessage } from '../lib/form-errors';

// The locale is taken from the current UI language, not typed by the user.
const registerFormSchema = registerSchema.omit({ locale: true });
type RegisterFormValues = z.infer<typeof registerFormSchema>;

export function RegisterPage() {
  const { t } = useTranslation('auth');
  const { register: registerAccount } = useAuth();
  const navigate = useNavigate();
  const [submitError, setSubmitError] = useState<string>();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({ resolver: zodResolver(registerFormSchema) });

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
    <AuthLayout title={t('register.title')}>
      <form onSubmit={onSubmit} noValidate>
        <FormField
          label={t('fields.salonName')}
          autoComplete="organization"
          error={fieldErrorMessage(errors.salonName)}
          {...register('salonName')}
        />
        <FormField
          label={t('fields.fullName')}
          autoComplete="name"
          error={fieldErrorMessage(errors.fullName)}
          {...register('fullName')}
        />
        <FormField
          label={t('fields.email')}
          type="email"
          autoComplete="email"
          error={fieldErrorMessage(errors.email)}
          {...register('email')}
        />
        <FormField
          label={t('fields.password')}
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
          {isSubmitting ? t('register.submitting') : t('register.submit')}
        </button>
      </form>
      <p className="auth-links">
        <span>
          {t('register.hasAccount')} <Link to="/login">{t('register.loginLink')}</Link>
        </span>
      </p>
    </AuthLayout>
  );
}
