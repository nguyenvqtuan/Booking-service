import { formatPhone, normalizePhone, phoneSearchDigits } from './phone.js';

describe('normalizePhone', () => {
  it.each([
    ['0901234567', '+84901234567'],
    ['84901234567', '+84901234567'],
    ['+84901234567', '+84901234567'],
    ['090 123 4567', '+84901234567'],
    ['+84 90-123-4567', '+84901234567'],
    ['0084901234567', '+84901234567'],
    ['(090) 123.4567', '+84901234567'],
    ['0351234567', '+84351234567'],
    ['+14155552671', '+14155552671'],
  ])('%s -> %s', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each(['', '   ', 'abc', '12345', '0201234567', '090123456789', '+84123'])(
    'rejects %j',
    (input) => {
      expect(normalizePhone(input)).toBeNull();
    },
  );
});

describe('formatPhone / phoneSearchDigits', () => {
  it('formats Vietnamese numbers for display', () => {
    expect(formatPhone('+84901234567')).toBe('0901 234 567');
    expect(formatPhone('+14155552671')).toBe('+14155552671');
  });

  it('turns any typed form into searchable digits', () => {
    expect(phoneSearchDigits('0901 23')).toBe('90123');
    expect(phoneSearchDigits('+84901234567')).toBe('901234567');
    expect(phoneSearchDigits('4567')).toBe('4567');
  });
});
