import {
  addMinutes,
  isValidTimeZone,
  localDayRangeUtc,
  localToUtc,
  reminderSendAt,
  utcToLocal,
  weekdayOf,
} from './time.js';

const VN = 'Asia/Ho_Chi_Minh';

// These tests run twice in CI/locally: TZ=UTC and TZ=America/New_York (see package.json),
// proving the results never depend on the server's local timezone.
describe(`time helpers (process TZ=${process.env.TZ ?? 'system'})`, () => {
  it('stores 15:00 Vietnam time as 08:00 UTC and shows it back as 15:00', () => {
    const utc = localToUtc('2026-11-02', '15:00', VN);
    expect(utc.toISOString()).toBe('2026-11-02T08:00:00.000Z');
    expect(utcToLocal(utc, VN)).toEqual({ date: '2026-11-02', time: '15:00', weekday: 'mon' });
  });

  it('computes a 2h reminder at 13:00 Vietnam time', () => {
    const start = localToUtc('2026-11-02', '15:00', VN);
    const sendAt = reminderSendAt(start, 120);
    expect(utcToLocal(sendAt, VN).time).toBe('13:00');
    expect(sendAt.toISOString()).toBe('2026-11-02T06:00:00.000Z');
  });

  it('computes a 24h reminder on the previous local day', () => {
    const start = localToUtc('2026-11-02', '08:30', VN);
    expect(utcToLocal(reminderSendAt(start, 1440), VN)).toMatchObject({
      date: '2026-11-01',
      time: '08:30',
    });
  });

  it('handles appointments crossing UTC midnight', () => {
    // 06:00 VN on Nov 2 is 23:00 UTC on Nov 1.
    const utc = localToUtc('2026-11-02', '06:00', VN);
    expect(utc.toISOString()).toBe('2026-11-01T23:00:00.000Z');
    expect(utcToLocal(utc, VN).date).toBe('2026-11-02');
  });

  it('returns the UTC range of a salon-local day', () => {
    const { from, to } = localDayRangeUtc('2026-11-02', VN);
    expect(from.toISOString()).toBe('2026-11-01T17:00:00.000Z');
    expect(to.toISOString()).toBe('2026-11-02T17:00:00.000Z');
  });

  it('resolves weekdays in the salon timezone', () => {
    expect(weekdayOf('2026-11-02', VN)).toBe('mon');
    expect(weekdayOf('2026-11-08', VN)).toBe('sun');
  });

  it('respects DST in zones that have it', () => {
    // New York switches from EDT (UTC-4) to EST (UTC-5) on 2026-11-01.
    expect(localToUtc('2026-10-31', '15:00', 'America/New_York').toISOString()).toBe(
      '2026-10-31T19:00:00.000Z',
    );
    expect(localToUtc('2026-11-02', '15:00', 'America/New_York').toISOString()).toBe(
      '2026-11-02T20:00:00.000Z',
    );
  });

  it('adds durations in absolute time', () => {
    const start = localToUtc('2026-11-02', '15:00', VN);
    expect(utcToLocal(addMinutes(start, 45), VN).time).toBe('15:45');
  });

  it('validates timezones and rejects garbage input', () => {
    expect(isValidTimeZone(VN)).toBe(true);
    expect(isValidTimeZone('Mars/Olympus')).toBe(false);
    expect(() => localToUtc('2026-13-40', '15:00', VN)).toThrow();
    expect(() => localToUtc('2026-11-02', '15:00', 'Mars/Olympus')).toThrow();
  });
});
