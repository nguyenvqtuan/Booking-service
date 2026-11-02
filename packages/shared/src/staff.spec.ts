import { staffInputSchema, staffUpdateSchema, workingHoursSchema } from './staff.js';

describe('workingHoursSchema', () => {
  it('fills missing days with [] and sorts shifts', () => {
    const parsed = workingHoursSchema.parse({
      mon: [
        { start: '13:30', end: '20:00' },
        { start: '09:00', end: '12:00' },
      ],
    });
    expect(parsed.mon).toEqual([
      { start: '09:00', end: '12:00' },
      { start: '13:30', end: '20:00' },
    ]);
    expect(parsed.sun).toEqual([]);
    expect(Object.keys(parsed)).toHaveLength(7);
  });

  it.each([
    [{ mon: [{ start: '12:00', end: '09:00' }] }, 'end before start'],
    [{ mon: [{ start: '09:00', end: '09:00' }] }, 'empty shift'],
    [{ mon: [{ start: '9:00', end: '12:00' }] }, 'bad format'],
    [{ mon: [{ start: '24:00', end: '25:00' }] }, 'out of range'],
    [
      {
        mon: [
          { start: '09:00', end: '13:00' },
          { start: '12:00', end: '18:00' },
        ],
      },
      'overlapping shifts',
    ],
    [{ monday: [] }, 'unknown day key'],
  ] as [unknown, string][])('rejects %j (%s)', (input) => {
    expect(workingHoursSchema.safeParse(input).success).toBe(false);
  });

  it('accepts back-to-back shifts', () => {
    expect(
      workingHoursSchema.safeParse({
        tue: [
          { start: '09:00', end: '12:00' },
          { start: '12:00', end: '18:00' },
        ],
      }).success,
    ).toBe(true);
  });
});

describe('staffInputSchema', () => {
  it('turns an empty phone into null and defaults serviceIds', () => {
    const parsed = staffInputSchema.parse({ name: 'An', phone: '  ', workingHours: {} });
    expect(parsed.phone).toBeNull();
    expect(parsed.serviceIds).toEqual([]);
  });
});

describe('staffUpdateSchema', () => {
  it('does not default serviceIds, so a partial update keeps existing services', () => {
    expect(staffUpdateSchema.parse({ name: 'An' })).toEqual({ name: 'An' });
  });
});
