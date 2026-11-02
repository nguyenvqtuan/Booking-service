import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  type AppointmentDto,
  AppointmentStatus,
  formatPhone,
  isActiveStatus,
} from '@booking/shared';
import { useAuth } from '../../auth/auth-context';
import { Modal } from '../../components/Modal';
import { useAppointments, useChangeAppointmentStatus } from '../../hooks/useAppointments';
import { useStaffList } from '../../hooks/useStaff';
import { getApiErrorMessage } from '../../lib/api-error';
import { salonDayRange, salonTime, salonToday } from '../../lib/salon-time';
import { AppointmentForm } from './AppointmentForm';

type Dialog = { mode: 'create' } | { mode: 'edit'; appointment: AppointmentDto } | null;

export function AppointmentsPage() {
  const { t } = useTranslation(['appointments', 'common', 'errors', 'customers']);
  const { user } = useAuth();
  const tz = user?.salonTimezone;
  const [date, setDate] = useState(() => salonToday(tz));
  const [staffId, setStaffId] = useState('');
  const { data: staff = [] } = useStaffList();
  const { data, isPending, isError } = useAppointments({
    ...salonDayRange(date, tz),
    staffId: staffId || undefined,
  });
  const changeStatus = useChangeAppointmentStatus();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [actionError, setActionError] = useState<string>();

  const transition = async (
    a: AppointmentDto,
    status: AppointmentStatus.Confirmed | AppointmentStatus.Completed | AppointmentStatus.Cancelled,
  ) => {
    if (status === AppointmentStatus.Cancelled && !window.confirm(t('confirmCancel'))) return;
    setActionError(undefined);
    try {
      await changeStatus.mutateAsync({ id: a.id, status });
    } catch (err) {
      setActionError(getApiErrorMessage(err));
    }
  };

  return (
    <>
      <div className="page-header">
        <h1>{t('title')}</h1>
        <button
          type="button"
          className="btn-primary btn-inline"
          onClick={() => setDialog({ mode: 'create' })}
        >
          {t('add')}
        </button>
      </div>

      <div className="toolbar">
        <label>
          {t('fields.date')}{' '}
          <input
            type="date"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
          />
        </label>
        <label>
          {t('fields.staff')}{' '}
          <select value={staffId} onChange={(e) => setStaffId(e.target.value)}>
            <option value="">{t('allStaff')}</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {actionError && (
        <p className="form-error" role="alert">
          {actionError}
        </p>
      )}
      {isPending && <p role="status">{t('common:loading')}</p>}
      {isError && <p className="form-error">{t('errors:fallback')}</p>}
      {data?.length === 0 && <p className="empty">{t('empty')}</p>}

      {!!data?.length && (
        <ul className="appointment-list">
          {data.map((a) => (
            <li key={a.id} className={`appointment status-${a.status}`}>
              <div className="appointment-time">
                {salonTime(a.startAt, tz)}–{salonTime(a.endAt, tz)}
              </div>
              <div className="appointment-main">
                <strong>{a.customerName}</strong> · {formatPhone(a.customerPhone)}
                <div className="muted">
                  {a.serviceName} · {a.staffName}
                </div>
              </div>
              <span className={`status status-${a.status}`}>
                {t(`customers:status.${a.status}`)}
              </span>
              {isActiveStatus(a.status) && (
                <div className="row-actions">
                  {a.status === AppointmentStatus.Booked && (
                    <button
                      type="button"
                      className="btn-link"
                      onClick={() => void transition(a, AppointmentStatus.Confirmed)}
                    >
                      {t('confirm')}
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn-link"
                    onClick={() => void transition(a, AppointmentStatus.Completed)}
                  >
                    {t('complete')}
                  </button>
                  <button
                    type="button"
                    className="btn-link"
                    onClick={() => setDialog({ mode: 'edit', appointment: a })}
                  >
                    {t('edit')}
                  </button>
                  <button
                    type="button"
                    className="btn-link danger"
                    onClick={() => void transition(a, AppointmentStatus.Cancelled)}
                  >
                    {t('cancel')}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {dialog && (
        <Modal
          title={dialog.mode === 'create' ? t('add') : t('editTitle')}
          onClose={() => setDialog(null)}
        >
          <AppointmentForm
            appointment={dialog.mode === 'edit' ? dialog.appointment : undefined}
            defaultDate={date}
            onDone={() => setDialog(null)}
          />
        </Modal>
      )}
    </>
  );
}
