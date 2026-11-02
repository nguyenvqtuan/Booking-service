import type { DatesSetArg, EventClickArg, EventDropArg } from '@fullcalendar/core';
import viLocale from '@fullcalendar/core/locales/vi';
import interactionPlugin, { type DateClickArg } from '@fullcalendar/interaction';
import luxonPlugin from '@fullcalendar/luxon3';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type AppointmentDto, utcToLocal } from '@booking/shared';
import { useAuth } from '../../auth/auth-context';
import { useAppointments, useSaveAppointment } from '../../hooks/useAppointments';
import { currentLocale } from '../../i18n';
import { getApiErrorMessage } from '../../lib/api-error';
import { rescheduleOnDrop, toCalendarEvent } from './calendar-events';

// Static options live outside the component: new array/object identities on every render make
// FullCalendar re-initialize and fire datesSet again, which loops forever.
const PLUGINS = [timeGridPlugin, interactionPlugin, luxonPlugin];
const LOCALES = [viLocale];
const HEADER_TOOLBAR = {
  left: 'prev,next today',
  center: 'title',
  right: 'timeGridDay,timeGridWeek',
};

interface Props {
  staffId?: string;
  onCreateAt(date: string, time: string): void;
  onOpen(appointment: AppointmentDto): void;
}

/** Day/week time grid in the salon timezone with drag-and-drop rescheduling (BS-23). */
export function AppointmentsCalendar({ staffId, onCreateAt, onOpen }: Props) {
  const { t } = useTranslation('appointments');
  const { user } = useAuth();
  const timeZone = user?.salonTimezone ?? 'Asia/Ho_Chi_Minh';
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);
  const [dropError, setDropError] = useState<string>();
  const save = useSaveAppointment();
  const { data = [] } = useAppointments(range ? { ...range, staffId } : { from: '', to: '' }, {
    enabled: !!range,
  });
  const events = useMemo(() => data.map(toCalendarEvent), [data]);

  // Only update the range when it really changes (datesSet also fires on re-renders).
  const onDatesSet = useCallback((arg: DatesSetArg) => {
    const from = arg.start.toISOString();
    const to = arg.end.toISOString();
    setRange((prev) => (prev?.from === from && prev.to === to ? prev : { from, to }));
  }, []);

  return (
    <>
      {dropError && (
        <p className="form-error" role="alert">
          {dropError}
        </p>
      )}
      <div aria-label={t('calendar')} role="region">
        <FullCalendar
          plugins={PLUGINS}
          initialView="timeGridDay"
          headerToolbar={HEADER_TOOLBAR}
          locales={LOCALES}
          locale={currentLocale()}
          timeZone={timeZone}
          firstDay={1}
          allDaySlot={false}
          slotMinTime="07:00:00"
          slotMaxTime="22:00:00"
          slotDuration="00:15:00"
          snapDuration="00:05:00"
          nowIndicator
          height="auto"
          events={events}
          eventDurationEditable={false}
          datesSet={onDatesSet}
          dateClick={(arg: DateClickArg) => {
            const local = utcToLocal(arg.date, timeZone);
            onCreateAt(local.date, local.time);
          }}
          eventClick={(arg: EventClickArg) =>
            onOpen(arg.event.extendedProps.appointment as AppointmentDto)
          }
          eventDrop={(arg: EventDropArg) => {
            setDropError(undefined);
            void rescheduleOnDrop(
              arg,
              (id, startAt) => save.mutateAsync({ id, input: { startAt } }),
              (err) => setDropError(getApiErrorMessage(err)),
            );
          }}
        />
      </div>
    </>
  );
}
