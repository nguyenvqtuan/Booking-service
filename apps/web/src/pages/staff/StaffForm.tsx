import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { z } from 'zod';
import { type StaffDto, staffInputSchema, WEEKDAYS, type Weekday } from '@booking/shared';
import { FormField } from '../../components/FormField';
import { useServices } from '../../hooks/useServices';
import { useSaveStaff } from '../../hooks/useStaff';
import { getApiErrorMessage } from '../../lib/api-error';
import { fieldErrorMessage } from '../../lib/form-errors';
import { WorkingHoursEditor } from './WorkingHoursEditor';

type FormIn = z.input<typeof staffInputSchema>;
type FormOut = z.output<typeof staffInputSchema>;

export function StaffForm({ staff, onDone }: { staff?: StaffDto; onDone(): void }) {
  const { t } = useTranslation(['staff', 'validation']);
  const save = useSaveStaff();
  const { data: services = [] } = useServices();
  const [submitError, setSubmitError] = useState<string>();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(staffInputSchema),
    defaultValues: {
      name: staff?.name ?? '',
      phone: staff?.phone ?? '',
      workingHours: staff?.workingHours ?? {},
      serviceIds: staff?.serviceIds ?? [],
    },
  });

  const onSubmit = handleSubmit(async (input) => {
    setSubmitError(undefined);
    try {
      await save.mutateAsync({ id: staff?.id, input });
      onDone();
    } catch (err) {
      setSubmitError(getApiErrorMessage(err));
    }
  });

  const hoursErrors = Object.fromEntries(
    WEEKDAYS.filter((d) => errors.workingHours?.[d]).map((d) => [d, t('errors.shifts')]),
  ) as Partial<Record<Weekday, string>>;

  return (
    <form onSubmit={onSubmit} noValidate>
      <FormField
        label={t('fields.name')}
        error={fieldErrorMessage(errors.name)}
        {...register('name')}
      />
      <FormField label={t('fields.phone')} type="tel" autoComplete="off" {...register('phone')} />

      <Controller
        control={control}
        name="workingHours"
        render={({ field }) => (
          <WorkingHoursEditor value={field.value} onChange={field.onChange} errors={hoursErrors} />
        )}
      />

      <Controller
        control={control}
        name="serviceIds"
        render={({ field }) => {
          const selected = new Set(field.value ?? []);
          return (
            <fieldset className="checkbox-group">
              <legend>{t('fields.services')}</legend>
              {services.length === 0 && <p className="empty">{t('noServices')}</p>}
              {services.map((s) => (
                <label key={s.id} className="checkbox">
                  <input
                    type="checkbox"
                    checked={selected.has(s.id)}
                    onChange={(e) => {
                      const next = new Set(selected);
                      if (e.target.checked) next.add(s.id);
                      else next.delete(s.id);
                      field.onChange([...next]);
                    }}
                  />
                  {s.name}
                </label>
              ))}
              {errors.serviceIds && (
                <p className="field-error" role="alert">
                  {t('validation:invalid')}
                </p>
              )}
            </fieldset>
          );
        }}
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
