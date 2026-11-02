import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { z } from 'zod';
import { type CustomerDto, customerInputSchema, formatPhone } from '@booking/shared';
import { FormField } from '../../components/FormField';
import { useSaveCustomer } from '../../hooks/useCustomers';
import { getApiErrorCode, getApiErrorMessage } from '../../lib/api-error';
import { fieldErrorMessage } from '../../lib/form-errors';

type FormIn = z.input<typeof customerInputSchema>;
type FormOut = z.output<typeof customerInputSchema>;

export function CustomerForm({ customer, onDone }: { customer?: CustomerDto; onDone(): void }) {
  const { t } = useTranslation(['customers', 'errors']);
  const save = useSaveCustomer();
  const [submitError, setSubmitError] = useState<string>();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(customerInputSchema),
    defaultValues: {
      name: customer?.name ?? '',
      phone: customer ? formatPhone(customer.phone) : '',
      note: customer?.note ?? '',
    },
  });

  const onSubmit = handleSubmit(async (input) => {
    setSubmitError(undefined);
    try {
      await save.mutateAsync({ id: customer?.id, input });
      onDone();
    } catch (err) {
      if (getApiErrorCode(err) === 'CUSTOMER_PHONE_TAKEN') {
        setError('phone', { type: 'taken', message: t('errors:CUSTOMER_PHONE_TAKEN') });
      } else {
        setSubmitError(getApiErrorMessage(err));
      }
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
        label={t('fields.phone')}
        type="tel"
        inputMode="tel"
        placeholder="0901 234 567"
        error={
          errors.phone && (errors.phone.type === 'taken' ? errors.phone.message : t('invalidPhone'))
        }
        {...register('phone')}
      />
      <FormField label={t('fields.note')} {...register('note')} />
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
