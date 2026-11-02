import { type FormEvent, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type AppointmentDto, formatPhone, utcToLocal } from '@booking/shared';
import { useAuth } from '../../auth/auth-context';
import { useSaveAppointment } from '../../hooks/useAppointments';
import { useCustomers } from '../../hooks/useCustomers';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useServices } from '../../hooks/useServices';
import { useStaffList } from '../../hooks/useStaff';
import { getApiErrorMessage } from '../../lib/api-error';
import { salonInstant } from '../../lib/salon-time';

interface Props {
  appointment?: AppointmentDto;
  defaultDate: string;
  defaultTime?: string;
  onDone(): void;
}

/** Create or reschedule an appointment. Date/time are entered in the salon timezone. */
export function AppointmentForm({ appointment, defaultDate, defaultTime, onDone }: Props) {
  const { t } = useTranslation(['appointments', 'validation']);
  const { user } = useAuth();
  const tz = user?.salonTimezone;
  const save = useSaveAppointment();
  const { data: services = [] } = useServices();
  const { data: staff = [] } = useStaffList();

  const initial = appointment
    ? utcToLocal(new Date(appointment.startAt), tz ?? 'Asia/Ho_Chi_Minh')
    : null;
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerId, setCustomerId] = useState(appointment?.customerId ?? '');
  const [serviceId, setServiceId] = useState(appointment?.serviceId ?? '');
  const [staffId, setStaffId] = useState(appointment?.staffId ?? '');
  const [date, setDate] = useState(initial?.date ?? defaultDate);
  const [time, setTime] = useState(initial?.time ?? defaultTime ?? '09:00');
  const [note, setNote] = useState(appointment?.note ?? '');
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  const q = useDebouncedValue(customerQuery.trim());
  const { data: customerPage } = useCustomers(q, 0);
  const customerOptions = useMemo(() => {
    const items = customerPage?.items ?? [];
    // Keep the current customer selectable while searching for another one.
    if (appointment && !items.some((c) => c.id === appointment.customerId)) {
      return [
        {
          id: appointment.customerId,
          name: appointment.customerName,
          phone: appointment.customerPhone,
        },
        ...items,
      ];
    }
    return items;
  }, [customerPage, appointment]);

  const activeServices = services.filter((s) => s.isActive);
  const eligibleStaff = staff.filter(
    (s) => s.isActive && (!serviceId || s.serviceIds.includes(serviceId)),
  );

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!customerId || !serviceId || !staffId || !date || !time) {
      setError(t('requiredFields'));
      return;
    }
    setError(undefined);
    setSubmitting(true);
    try {
      const input = { customerId, serviceId, staffId, startAt: salonInstant(date, time, tz), note };
      await save.mutateAsync({ id: appointment?.id, input });
      onDone();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} noValidate className="appointment-form">
      <div className="field">
        <label htmlFor="appt-customer-search">{t('fields.customer')}</label>
        <input
          id="appt-customer-search"
          type="search"
          placeholder={t('customerSearch')}
          value={customerQuery}
          onChange={(e) => setCustomerQuery(e.target.value)}
        />
        <select
          aria-label={t('fields.customer')}
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
        >
          <option value="">{t('choose')}</option>
          {customerOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} · {formatPhone(c.phone)}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="appt-service">{t('fields.service')}</label>
        <select
          id="appt-service"
          value={serviceId}
          onChange={(e) => {
            setServiceId(e.target.value);
            setStaffId('');
          }}
        >
          <option value="">{t('choose')}</option>
          {activeServices.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({t('minutes', { count: s.durationMin })})
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="appt-staff">{t('fields.staff')}</label>
        <select id="appt-staff" value={staffId} onChange={(e) => setStaffId(e.target.value)}>
          <option value="">{t('choose')}</option>
          {eligibleStaff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="appt-date">{t('fields.date')}</label>
          <input
            id="appt-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="appt-time">{t('fields.time')}</label>
          <input
            id="appt-time"
            type="time"
            step={300}
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </div>
      </div>

      <div className="field">
        <label htmlFor="appt-note">{t('fields.note')}</label>
        <input id="appt-note" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="btn-primary" disabled={submitting}>
        {t('save')}
      </button>
    </form>
  );
}
