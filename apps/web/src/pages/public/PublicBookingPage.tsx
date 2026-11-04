import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';
import {
  ErrorCode,
  normalizePhone,
  type PublicBookingResult,
  type PublicSalonDto,
  type PublicServiceDto,
  type PublicStaffDto,
  type SlotDto,
} from '@booking/shared';
import { FormField } from '../../components/FormField';
import { LanguageSwitcher } from '../../components/LanguageSwitcher';
import { currentLocale } from '../../i18n';
import { api } from '../../lib/api';
import { getApiErrorCode, getApiErrorMessage } from '../../lib/api-error';
import { formatCurrency, formatDateTime } from '../../lib/format';
import { salonToday } from '../../lib/salon-time';

/** Public page where customers book by themselves, without an account (BS-35). */
export function PublicBookingPage() {
  const { t } = useTranslation(['booking', 'common']);
  const { salonSlug = '' } = useParams();
  const salon = useQuery({
    queryKey: ['public', salonSlug],
    queryFn: async () => (await api.get<PublicSalonDto>(`/public/${salonSlug}`)).data,
    retry: false,
  });

  return (
    <main className="public-page">
      <div className="public-card">
        <div className="auth-card-top">
          <p className="brand">{t('title')}</p>
          <LanguageSwitcher />
        </div>
        {salon.isPending && <p role="status">{t('common:loading')}</p>}
        {salon.isError && <p className="form-error">{t('salonNotFound')}</p>}
        {salon.data && <BookingFlow slug={salonSlug} salon={salon.data} />}
      </div>
    </main>
  );
}

function BookingFlow({ slug, salon }: { slug: string; salon: PublicSalonDto }) {
  const { t } = useTranslation('booking');
  const qc = useQueryClient();
  const tz = salon.timezone;
  const [serviceId, setServiceId] = useState('');
  const [staffId, setStaffId] = useState('');
  const [date, setDate] = useState(() => salonToday(tz));
  const [startAt, setStartAt] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState<string>();
  const [submitError, setSubmitError] = useState<string>();
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpMessage, setOtpMessage] = useState<string>();
  const [result, setResult] = useState<PublicBookingResult>();

  const services = useQuery({
    queryKey: ['public', slug, 'services'],
    queryFn: async () => (await api.get<PublicServiceDto[]>(`/public/${slug}/services`)).data,
  });
  const staff = useQuery({
    queryKey: ['public', slug, 'staff', serviceId],
    queryFn: async () =>
      (await api.get<PublicStaffDto[]>(`/public/${slug}/staff`, { params: { serviceId } })).data,
    enabled: !!serviceId,
  });
  const slots = useQuery({
    queryKey: ['public', slug, 'slots', serviceId, staffId, date],
    queryFn: async () =>
      (await api.get<SlotDto[]>(`/public/${slug}/slots`, { params: { serviceId, staffId, date } }))
        .data,
    enabled: !!serviceId && !!staffId && !!date,
  });
  const book = useMutation({
    mutationFn: async () =>
      (
        await api.post<PublicBookingResult>(`/public/${slug}/appointments`, {
          serviceId,
          staffId,
          startAt,
          name,
          phone,
          locale: currentLocale(),
          ...(salon.otpRequired && { otp }),
        })
      ).data,
  });

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitError(undefined);
    if (!normalizePhone(phone)) {
      setPhoneError(t('invalidPhone'));
      return;
    }
    setPhoneError(undefined);
    try {
      setResult(await book.mutateAsync());
    } catch (err) {
      setSubmitError(getApiErrorMessage(err));
      const code = getApiErrorCode(err);
      if (code === ErrorCode.SlotUnavailable || code === ErrorCode.AppointmentOverlap) {
        // The chosen time was just taken: show what is still free.
        setStartAt('');
        await qc.invalidateQueries({ queryKey: ['public', slug, 'slots'] });
      }
    }
  };

  const requestOtp = async () => {
    setOtpMessage(undefined);
    if (!normalizePhone(phone)) {
      setPhoneError(t('invalidPhone'));
      return;
    }
    setPhoneError(undefined);
    try {
      await api.post(`/public/${slug}/otp`, { phone });
      setOtpSent(true);
      setOtpMessage(t('otp.sent'));
    } catch (err) {
      setOtpMessage(getApiErrorMessage(err));
    }
  };

  if (result) {
    return (
      <div role="status">
        <h1>{t('success.title')}</h1>
        <p>{t('success.message', { salon: result.salonName })}</p>
        <ul className="booking-summary">
          <li>{result.serviceName}</li>
          <li>{result.staffName}</li>
          <li>{formatDateTime(result.startAt, currentLocale(), tz)}</li>
        </ul>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <h1>{salon.name}</h1>

      <div className="field">
        <label htmlFor="pb-service">{t('fields.service')}</label>
        <select
          id="pb-service"
          value={serviceId}
          onChange={(e) => {
            setServiceId(e.target.value);
            setStaffId('');
            setStartAt('');
          }}
        >
          <option value="">{t('choose')}</option>
          {services.data?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} · {t('minutes', { count: s.durationMin })} ·{' '}
              {formatCurrency(s.price, currentLocale())}
            </option>
          ))}
        </select>
      </div>

      {serviceId && (
        <div className="field">
          <label htmlFor="pb-staff">{t('fields.staff')}</label>
          <select
            id="pb-staff"
            value={staffId}
            onChange={(e) => {
              setStaffId(e.target.value);
              setStartAt('');
            }}
          >
            <option value="">{t('choose')}</option>
            {staff.data?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {staffId && (
        <>
          <div className="field">
            <label htmlFor="pb-date">{t('fields.date')}</label>
            <input
              id="pb-date"
              type="date"
              min={salonToday(tz)}
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setStartAt('');
              }}
            />
          </div>
          <fieldset className="slot-group">
            <legend>{t('fields.time')}</legend>
            {slots.data?.length === 0 && <p className="empty">{t('noSlots')}</p>}
            <div className="slot-grid">
              {slots.data?.map((slot) => (
                <button
                  key={slot.startAt}
                  type="button"
                  className="slot"
                  aria-pressed={startAt === slot.startAt}
                  onClick={() => setStartAt(slot.startAt)}
                >
                  {slot.time}
                </button>
              ))}
            </div>
          </fieldset>
        </>
      )}

      {startAt && (
        <>
          <FormField
            label={t('fields.name')}
            autoComplete="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <FormField
            label={t('fields.phone')}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            required
            error={phoneError}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          {salon.otpRequired && (
            <div className="otp-block">
              <button type="button" className="btn-secondary" onClick={() => void requestOtp()}>
                {otpSent ? t('otp.resend') : t('otp.send')}
              </button>
              {otpMessage && <p role="status">{otpMessage}</p>}
              {otpSent && (
                <FormField
                  label={t('otp.code')}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                />
              )}
            </div>
          )}
        </>
      )}

      {submitError && (
        <p className="form-error" role="alert">
          {submitError}
        </p>
      )}
      {startAt && (
        <button
          type="submit"
          className="btn-primary"
          disabled={
            book.isPending ||
            !name.trim() ||
            !phone.trim() ||
            (salon.otpRequired && otp.length !== 6)
          }
        >
          {t('submit')}
        </button>
      )}
    </form>
  );
}
