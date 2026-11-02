import type { EventInput } from '@fullcalendar/core';
import { type AppointmentDto, AppointmentStatus, isActiveStatus } from '@booking/shared';

/** Status colors (kept in sync with the list view in index.css). */
export const STATUS_COLORS: Record<AppointmentStatus, string> = {
  [AppointmentStatus.Booked]: '#0969da',
  [AppointmentStatus.Confirmed]: '#1a7f37',
  [AppointmentStatus.Completed]: '#8c959f',
  [AppointmentStatus.Cancelled]: '#cf222e',
  [AppointmentStatus.NoShow]: '#bc4c00',
};

export function toCalendarEvent(a: AppointmentDto): EventInput {
  const active = isActiveStatus(a.status);
  return {
    id: a.id,
    title: `${a.customerName} · ${a.serviceName}`,
    start: a.startAt,
    end: a.endAt,
    backgroundColor: STATUS_COLORS[a.status],
    borderColor: STATUS_COLORS[a.status],
    // Only active appointments can be moved; duration always follows the service.
    editable: active,
    durationEditable: false,
    classNames: [`status-${a.status}`],
    extendedProps: { appointment: a },
  };
}

/** Minimal shape of FullCalendar's EventDropArg that the handler needs. */
export interface DropInfo {
  event: { id: string; start: Date | null };
  revert(): void;
}

/**
 * Persists a drag-and-drop reschedule. On any failure (e.g. 409 overlap) the event is put
 * back where it was and the error is reported.
 */
export async function rescheduleOnDrop(
  info: DropInfo,
  save: (id: string, startAt: string) => Promise<unknown>,
  onError: (err: unknown) => void,
): Promise<void> {
  if (!info.event.start) {
    info.revert();
    return;
  }
  try {
    await save(info.event.id, info.event.start.toISOString());
  } catch (err) {
    info.revert();
    onError(err);
  }
}
