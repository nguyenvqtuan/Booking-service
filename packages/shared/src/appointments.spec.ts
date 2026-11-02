import { AppointmentStatus as S } from './enums.js';
import {
  appointmentCreateSchema,
  appointmentListQuerySchema,
  canTransition,
} from './appointments.js';

describe('appointment state machine', () => {
  it.each([
    [S.Booked, S.Confirmed, true],
    [S.Booked, S.Cancelled, true],
    [S.Booked, S.Completed, true],
    [S.Confirmed, S.Cancelled, true],
    [S.Confirmed, S.Completed, true],
    [S.Confirmed, S.Booked, false],
    [S.Cancelled, S.Confirmed, false],
    [S.Cancelled, S.Booked, false],
    [S.Completed, S.Cancelled, false],
    [S.NoShow, S.Completed, false],
  ])('%s -> %s = %s', (from, to, expected) => {
    expect(canTransition(from, to)).toBe(expected);
  });
});

describe('appointment schemas', () => {
  const ids = {
    customerId: '0b6f7d6e-1c1a-4b8e-9a8f-1a2b3c4d5e01',
    staffId: '0b6f7d6e-1c1a-4b8e-9a8f-1a2b3c4d5e02',
    serviceId: '0b6f7d6e-1c1a-4b8e-9a8f-1a2b3c4d5e03',
  };

  it('requires an ISO instant with offset', () => {
    expect(
      appointmentCreateSchema.safeParse({ ...ids, startAt: '2026-11-02T08:00:00Z' }).success,
    ).toBe(true);
    expect(
      appointmentCreateSchema.safeParse({ ...ids, startAt: '2026-11-02T15:00:00+07:00' }).success,
    ).toBe(true);
    // A wall-clock time without offset is ambiguous: reject it.
    expect(
      appointmentCreateSchema.safeParse({ ...ids, startAt: '2026-11-02T15:00:00' }).success,
    ).toBe(false);
  });

  it('rejects an inverted list range', () => {
    expect(
      appointmentListQuerySchema.safeParse({
        from: '2026-11-03T00:00:00Z',
        to: '2026-11-02T00:00:00Z',
      }).success,
    ).toBe(false);
  });
});
