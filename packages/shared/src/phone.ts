/**
 * Phone numbers are stored in E.164 (BS-20, BS-66). Vietnamese numbers may be typed as
 * 0901234567, 84901234567, +84 90 123 4567, 0084901234567, "090.123.4567"...
 */
const VN_E164 = /^\+84[35789]\d{8}$/;
const INTL_E164 = /^\+[1-9]\d{7,14}$/;

/** Returns the E.164 form, or null when the input is not a valid phone number. */
export function normalizePhone(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  const hasPlus = raw.startsWith('+');
  let digits = raw.replace(/\D/g, '');
  if (!digits) return null;

  if (!hasPlus) {
    if (digits.startsWith('00')) digits = digits.slice(2);
    else if (digits.startsWith('0')) digits = `84${digits.slice(1)}`;
    else if (!(digits.startsWith('84') && digits.length === 11)) digits = `84${digits}`;
  }
  const e164 = `+${digits}`;
  if (e164.startsWith('+84')) return VN_E164.test(e164) ? e164 : null;
  return INTL_E164.test(e164) ? e164 : null;
}

/** Human-friendly display: +84901234567 -> "0901 234 567"; other countries unchanged. */
export function formatPhone(e164: string): string {
  const m = /^\+84(\d{3})(\d{3})(\d{3})$/.exec(e164);
  return m ? `0${m[1]} ${m[2]} ${m[3]}` : e164;
}

/** Digits to search a stored E.164 phone by: "0901 23" -> "90123". */
export function phoneSearchDigits(query: string): string {
  const digits = query.replace(/\D/g, '');
  if (digits.startsWith('84') && digits.length > 9) return digits.slice(2);
  return digits.startsWith('0') ? digits.slice(1) : digits;
}
