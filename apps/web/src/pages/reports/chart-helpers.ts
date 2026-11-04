/** Largest gridline value: a round number at or above the data maximum. */
export function niceMax(value: number): number {
  if (value <= 4) return 4;
  const rawStep = value / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * magnitude >= rawStep) ?? 10;
  return step * magnitude * 4;
}

export function monthLabel(month: string, locale: string): string {
  return new Intl.DateTimeFormat(locale === 'vi' ? 'vi-VN' : 'en-US', {
    month: 'short',
    year: '2-digit',
    timeZone: 'UTC',
  }).format(new Date(`${month}-01T00:00:00Z`));
}
