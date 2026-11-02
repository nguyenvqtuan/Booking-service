import type { AppointmentDto } from '@booking/shared';
import { rescheduleOnDrop, STATUS_COLORS, toCalendarEvent } from './calendar-events';

const base = {
  id: 'a1',
  customerName: 'Lê Chi',
  serviceName: 'Cắt tóc',
  startAt: '2026-11-02T08:00:00.000Z',
  endAt: '2026-11-02T08:30:00.000Z',
} as AppointmentDto;

describe('toCalendarEvent', () => {
  it('maps an active appointment to a draggable, colored event', () => {
    const e = toCalendarEvent({ ...base, status: 'booked' as AppointmentDto['status'] });
    expect(e).toMatchObject({
      id: 'a1',
      title: 'Lê Chi · Cắt tóc',
      start: base.startAt,
      end: base.endAt,
      editable: true,
      durationEditable: false,
      backgroundColor: STATUS_COLORS.booked,
    });
  });

  it.each(['cancelled', 'completed', 'no_show'])('locks %s appointments', (status) => {
    const e = toCalendarEvent({ ...base, status: status as AppointmentDto['status'] });
    expect(e.editable).toBe(false);
    expect(e.backgroundColor).toBe(STATUS_COLORS[status as AppointmentDto['status']]);
  });
});

describe('rescheduleOnDrop', () => {
  const newStart = new Date('2026-11-02T09:00:00.000Z');

  it('saves the new start time', async () => {
    const save = vi.fn().mockResolvedValue({});
    const revert = vi.fn();
    await rescheduleOnDrop({ event: { id: 'a1', start: newStart }, revert }, save, vi.fn());
    expect(save).toHaveBeenCalledWith('a1', '2026-11-02T09:00:00.000Z');
    expect(revert).not.toHaveBeenCalled();
  });

  it('reverts the UI and reports the error when the API refuses (e.g. overlap)', async () => {
    const error = new Error('409');
    const revert = vi.fn();
    const onError = vi.fn();
    await rescheduleOnDrop(
      { event: { id: 'a1', start: newStart }, revert },
      vi.fn().mockRejectedValue(error),
      onError,
    );
    expect(revert).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledWith(error);
  });
});
