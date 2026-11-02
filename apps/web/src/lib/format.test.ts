import { formatCurrency, formatDateTime } from './format';

describe('format', () => {
  // 08:00 UTC is 15:00 in Asia/Ho_Chi_Minh.
  const instant = '2026-11-02T08:00:00Z';

  it('formats date/time in the salon timezone per locale', () => {
    expect(formatDateTime(instant, 'vi')).toMatch(/15:00/);
    expect(formatDateTime(instant, 'vi')).toMatch(/02\/11\/2026|2\/11\/26/);
    expect(formatDateTime(instant, 'en')).toMatch(/3:00\s?PM/);
    expect(formatDateTime(instant, 'en')).toMatch(/11\/2\/26/);
  });

  it('formats VND per locale', () => {
    expect(formatCurrency(100000, 'vi').replace(/\s/g, ' ')).toBe('100.000 ₫');
    expect(formatCurrency(100000, 'en')).toBe('₫100,000');
  });
});
