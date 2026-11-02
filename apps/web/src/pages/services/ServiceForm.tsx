import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { z } from 'zod';
import { type ServiceDto, serviceInputSchema } from '@booking/shared';
import { FormField } from '../../components/FormField';
import { useSaveService } from '../../hooks/useServices';
import { getApiErrorMessage } from '../../lib/api-error';
import { fieldErrorMessage } from '../../lib/form-errors';

type FormValues = z.input<typeof serviceInputSchema>;

export function ServiceForm({ service, onDone }: { service?: ServiceDto; onDone(): void }) {
  const { t } = useTranslation('services');
  const save = useSaveService();
  const [submitError, setSubmitError] = useState<string>();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues, unknown, z.output<typeof serviceInputSchema>>({
    resolver: zodResolver(serviceInputSchema),
    defaultValues: service
      ? { name: service.name, durationMin: service.durationMin, price: service.price }
      : { name: '', durationMin: 30, price: 0 },
  });

  const onSubmit = handleSubmit(async (input) => {
    setSubmitError(undefined);
    try {
      await save.mutateAsync({ id: service?.id, input });
      onDone();
    } catch (err) {
      setSubmitError(getApiErrorMessage(err));
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate>
      <FormField
        label={t('fields.name')}
        error={fieldErrorMessage(errors.name)}
        {...register('name')}
      />
      <FormField
        label={t('fields.durationMin')}
        type="number"
        inputMode="numeric"
        min={1}
        error={errors.durationMin && t('errors.durationMin')}
        {...register('durationMin')}
      />
      <FormField
        label={t('fields.price')}
        type="number"
        inputMode="numeric"
        min={0}
        step={1000}
        error={errors.price && t('errors.price')}
        {...register('price')}
      />
      {submitError && (
        <p className="form-error" role="alert">
          {submitError}
        </p>
      )}
      <button type="submit" className="btn-primary" disabled={isSubmitting}>
        {t('save')}
      </button>
    </form>
  );
}
