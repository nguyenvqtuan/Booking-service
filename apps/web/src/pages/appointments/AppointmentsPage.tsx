import { lazy, Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  type AppointmentDto,
  AppointmentStatus,
  formatPhone,
  isActiveStatus,
} from '@booking/shared';
import { useAuth } from '../../auth/auth-context';
import { Modal } from '../../components/Modal';
import {
  useAppointments,
  useChangeAppointmentStatus,
  useMarkNoShow,
} from '../../hooks/useAppointments';
import { useNow } from '../../hooks/useNow';
import { useStaffList } from '../../hooks/useStaff';
import { getApiErrorMessage } from '../../lib/api-error';
import { salonDayRange, salonTime, salonToday } from '../../lib/salon-time';
import { AppointmentForm } from './AppointmentForm';

// FullCalendar is large: load it only when the calendar view is shown.
const AppointmentsCalendar = lazy(() =>
  import('./AppointmentsCalendar').then((m) => ({ default: m.AppointmentsCalendar })),
);

type Dialog =
  | { mode: 'create'; date?: string; time?: string }
  | { mode: 'edit'; appointment: AppointmentDto }
  | null;
type View = 'calendar' | 'list';

const VIEW_STORAGE_KEY = 'bs_appointments_view';

function readView(): View {
  try {
    return localStorage.getItem(VIEW_STORAGE_KEY) === 'list' ? 'list' : 'calendar';
  } catch {
    return 'calendar';
  }
}

function storeView(view: View): void {
  try {
    localStorage.setItem(VIEW_STORAGE_KEY, view);
  } catch {
    // Storage may be unavailable (private mode); the choice is just not remembered.
  }
}

type ManualStatus =
  AppointmentStatus.Confirmed | AppointmentStatus.Completed | AppointmentStatus.Cancelled;

export function AppointmentsPage() {
  const { t } = useTranslation(['appointments', 'common', 'errors', 'customers']);
  const { user } = useAuth();
  const tz = user?.salonTimezone;
  const [view, setView] = useState<View>(readView);
  const [date, setDate] = useState(() => salonToday(tz));
  const [staffId, setStaffId] = useState('');
  const { data: staff = [] } = useStaffList();
  const { data, isPending, isError } = useAppointments(
    { ...salonDayRange(date, tz), staffId: staffId || undefined },
    { enabled: view === 'list' },
  );
  const changeStatus = useChangeAppointmentStatus();
  const markNoShow = useMarkNoShow();
  const now = useNow();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [actionError, setActionError] = useState<string>();

  const switchView = (next: View) => {
    setView(next);
    storeView(next);
  };

  const transition = async (a: AppointmentDto, status: ManualStatus) => {
    if (status === AppointmentStatus.Cancelled && !window.confirm(t('confirmCancel'))) return;
    setActionError(undefined);
    try {
      await changeStatus.mutateAsync({ id: a.id, status });
      setDialog(null);
    } catch (err) {
      setActionError(getApiErrorMessage(err));
    }
  };

  const noShow = async (a: AppointmentDto) => {
    if (!window.confirm(t('confirmNoShow', { name: a.customerName }))) return;
    setActionError(undefined);
    try {
      await markNoShow.mutateAsync(a.id);
      setDialog(null);
    } catch (err) {
      setActionError(getApiErrorMessage(err));
    }
  };

  const actions = (a: AppointmentDto) =>
    isActiveStatus(a.status) && (
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
        {new Date(a.startAt).getTime() <= now && (
          <button type="button" className="btn-link danger" onClick={() => void noShow(a)}>
            {t('noShow')}
          </button>
        )}
        <button
          type="button"
          className="btn-link danger"
          onClick={() => void transition(a, AppointmentStatus.Cancelled)}
        >
          {t('cancel')}
        </button>
      </div>
    );

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
        <div className="segmented" role="group" aria-label={t('viewMode')}>
          <button
            type="button"
            aria-pressed={view === 'calendar'}
            onClick={() => switchView('calendar')}
          >
            {t('views.calendar')}
          </button>
          <button type="button" aria-pressed={view === 'list'} onClick={() => switchView('list')}>
            {t('views.list')}
          </button>
        </div>
        {view === 'list' && (
          <label>
            {t('fields.date')}{' '}
            <input
              type="date"
              value={date}
              onChange={(e) => e.target.value && setDate(e.target.value)}
            />
          </label>
        )}
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

      {view === 'calendar' && (
        <Suspense fallback={<p role="status">{t('common:loading')}</p>}>
          <AppointmentsCalendar
            staffId={staffId || undefined}
            onCreateAt={(d, time) => setDialog({ mode: 'create', date: d, time })}
            onOpen={(appointment) => setDialog({ mode: 'edit', appointment })}
          />
        </Suspense>
      )}

      {view === 'list' && (
        <>
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
                  {actions(a)}
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {dialog && (
        <Modal
          title={dialog.mode === 'create' ? t('add') : t('editTitle')}
          onClose={() => setDialog(null)}
        >
          {dialog.mode === 'edit' && !isActiveStatus(dialog.appointment.status) ? (
            <p>
              {dialog.appointment.customerName} · {dialog.appointment.serviceName} —{' '}
              {t(`customers:status.${dialog.appointment.status}`)}
            </p>
          ) : (
            <>
              <AppointmentForm
                appointment={dialog.mode === 'edit' ? dialog.appointment : undefined}
                defaultDate={(dialog.mode === 'create' && dialog.date) || date}
                defaultTime={dialog.mode === 'create' ? dialog.time : undefined}
                onDone={() => setDialog(null)}
              />
              {dialog.mode === 'edit' && actions(dialog.appointment)}
            </>
          )}
        </Modal>
      )}
    </>
  );
}
