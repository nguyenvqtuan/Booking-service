import { computeSlots } from './slots.js';
import { localToUtc } from './time.js';

const VN = 'Asia/Ho_Chi_Minh';
const MONDAY = '2026-11-02';
const SUNDAY = '2026-11-08';
const at = (time: string, date = MONDAY) => localToUtc(date, time, VN);
const longAgo = new Date('2020-01-01T00:00:00Z');

const base = {
  workingHours: { mon: [{ start: '09:00', end: '10:00' }], sun: [] },
  busy: [],
  durationMin: 30,
  date: MONDAY,
  timeZone: VN,
  now: longAgo,
};
const times = (input: Partial<typeof base> & { stepMin?: number }) =>
  computeSlots({ ...base, ...input }).map((s) => s.time);

describe(`computeSlots (process TZ=${process.env.TZ ?? 'system'})`, () => {
  it('divides a shift by the 15-minute step; the last slot + duration fits the shift', () => {
    expect(times({})).toEqual(['09:00', '09:15', '09:30']);
  });

  it('returns instants usable for booking', () => {
    expect(computeSlots(base)[0]).toEqual({ startAt: '2026-11-02T02:00:00.000Z', time: '09:00' });
  });

  it('supports a custom step', () => {
    expect(times({ stepMin: 30 })).toEqual(['09:00', '09:30']);
  });

  it('never exceeds closing time when the service is longer than the rest of the shift (BS-67)', () => {
    expect(times({ durationMin: 45 })).toEqual(['09:00', '09:15']);
    expect(times({ durationMin: 90 })).toEqual([]);
  });

  it('removes slots overlapping booked appointments but allows back-to-back', () => {
    const workingHours = { mon: [{ start: '09:00', end: '11:00' }] };
    const busy = [{ start: at('09:30'), end: at('10:00') }];
    expect(times({ workingHours, busy } as never)).toEqual(['09:00', '10:00', '10:15', '10:30']);
  });

  it('handles several shifts and does not span the break', () => {
    const workingHours = {
      mon: [
        { start: '09:00', end: '09:30' },
        { start: '13:00', end: '13:45' },
      ],
    };
    expect(times({ workingHours } as never)).toEqual(['09:00', '13:00', '13:15']);
  });

  it('returns nothing on a day off (empty or missing)', () => {
    expect(times({ date: SUNDAY })).toEqual([]);
    expect(times({ date: '2026-11-03' })).toEqual([]);
  });

  it('removes past slots, including the current instant (BS-67)', () => {
    expect(times({ now: at('09:15') })).toEqual(['09:30']);
    expect(times({ now: at('12:00') })).toEqual([]);
  });

  it('uses the salon timezone across a DST change', () => {
    const slots = computeSlots({
      ...base,
      workingHours: { sun: [{ start: '09:00', end: '09:30' }] },
      date: '2026-11-01', // New York leaves DST on this Sunday
      timeZone: 'America/New_York',
    });
    expect(slots).toEqual([{ startAt: '2026-11-01T14:00:00.000Z', time: '09:00' }]);
  });
});
