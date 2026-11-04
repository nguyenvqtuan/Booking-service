import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';
import { type AppointmentActionView, isActiveStatus, type SlotDto } from '@booking/shared';
import { LanguageSwitcher } from '../../components/LanguageSwitcher';
import { currentLocale } from '../../i18n';
import { api } from '../../lib/api';
import { getApiErrorMessage } from '../../lib/api-error';
import { formatDateTime } from '../../lib/format';
import { salonToday } from '../../lib/salon-time';

type Action = 'confirm' | 'cancel' | { startAt: string };

/** Page opened from the link in a reminder: confirm, cancel or reschedule (BS-37). */
export function AppointmentActionPage() {
  const { t } = useTranslation(['appointmentAction', 'common']);
  const { token = '' } = useParams();
  const [done, setDone] = useState<AppointmentActionView>();
  const view = useQuery({
    queryKey: ['appointment-action', token],
    queryFn: async () =>
      (await api.get<AppointmentActionView>(`/appointment-actions/${token}`)).data,
    retry: false,
    enabled: !done,
  });

  return (
    <main className="public-page">
      <div className="public-card">
        <div className="auth-card-top">
          <p className="brand">{t('title')}</p>
          <LanguageSwitcher />
        </div>
        {done ? (
          <div role="status">
            <h1>{t(`done.${done.status}`, { defaultValue: t('done.updated') })}</h1>
            <Summary view={done} />
          </div>
        ) : (
          <>
            {view.isPending && <p role="status">{t('common:loading')}</p>}
            {view.isError && <p className="form-error">{t('invalidLink')}</p>}
            {view.data && <Actions token={token} view={view.data} onDone={setDone} />}
          </>
        )}
      </div>
    </main>
  );
}

function Summary({ view }: { view: AppointmentActionView }) {
  return (
    <ul className="booking-summary">
      <li>{view.salonName}</li>
      <li>
        {view.serviceName} · {view.staffName}
      </li>
      <li>{formatDateTime(view.startAt, currentLocale(), view.timezone)}</li>
    </ul>
  );
}

function Actions({
  token,
  view,
  onDone,
}: {
  token: string;
  view: AppointmentActionView;
  onDone(result: AppointmentActionView): void;
}) {
  const { t } = useTranslation('appointmentAction');
  const [rescheduling, setRescheduling] = useState(false);
  const [date, setDate] = useState(() => salonToday(view.timezone));
  const [error, setError] = useState<string>();

  const slots = useQuery({
    queryKey: ['appointment-action', token, 'slots', date],
    queryFn: async () =>
      (await api.get<SlotDto[]>(`/appointment-actions/${token}/slots`, { params: { date } })).data,
    enabled: rescheduling && !!date,
  });
  const run = useMutation({
    mutationFn: async (action: Action) =>
      typeof action === 'string'
        ? (await api.post<AppointmentActionView>(`/appointment-actions/${token}/${action}`)).data
        : (
            await api.post<AppointmentActionView>(
              `/appointment-actions/${token}/reschedule`,
              action,
            )
          ).data,
  });

  const perform = async (action: Action) => {
    setError(undefined);
    try {
      onDone(await run.mutateAsync(action));
    } catch (err) {
      setError(getApiErrorMessage(err));
      await slots.refetch();
    }
  };

  if (!isActiveStatus(view.status)) {
    return (
      <>
        <h1>{t('notActive')}</h1>
        <Summary view={view} />
      </>
    );
  }

  return (
    <>
      <h1>{t('heading')}</h1>
      <Summary view={view} />
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="action-buttons">
        <button
          type="button"
          className="btn-primary"
          disabled={run.isPending}
          onClick={() => void perform('confirm')}
        >
          {t('confirm')}
        </button>
        <button type="button" className="btn-secondary" onClick={() => setRescheduling(true)}>
          {t('reschedule')}
        </button>
        <button
          type="button"
          className="btn-link danger"
          disabled={run.isPending}
          onClick={() => {
            if (window.confirm(t('confirmCancel'))) void perform('cancel');
          }}
        >
          {t('cancel')}
        </button>
      </div>
      {rescheduling && (
        <>
          <div className="field">
            <label htmlFor="action-date">{t('newDate')}</label>
            <input
              id="action-date"
              type="date"
              min={salonToday(view.timezone)}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          {slots.data?.length === 0 && <p className="empty">{t('noSlots')}</p>}
          <div className="slot-grid">
            {slots.data?.map((slot) => (
              <button
                key={slot.startAt}
                type="button"
                className="slot"
                disabled={run.isPending}
                onClick={() => void perform({ startAt: slot.startAt })}
              >
                {slot.time}
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
}
