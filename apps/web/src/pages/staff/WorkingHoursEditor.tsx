import { useTranslation } from 'react-i18next';
import { type Shift, WEEKDAYS, type Weekday, type WorkingHours } from '@booking/shared';

const DEFAULT_SHIFT: Shift = { start: '09:00', end: '18:00' };

interface Props {
  value: WorkingHours;
  onChange(value: WorkingHours): void;
  /** Error messages keyed by weekday. */
  errors?: Partial<Record<Weekday, string>>;
}

/** Edits shifts per weekday; a day without shifts is a day off. */
export function WorkingHoursEditor({ value, onChange, errors }: Props) {
  const { t } = useTranslation('staff');

  const setDay = (day: Weekday, shifts: Shift[]) => onChange({ ...value, [day]: shifts });

  return (
    <fieldset className="hours-editor">
      <legend>{t('fields.workingHours')}</legend>
      {WEEKDAYS.map((day) => {
        const shifts = value[day] ?? [];
        return (
          <div key={day} className="hours-row" data-testid={`day-${day}`}>
            <span className="hours-day">{t(`weekdays.${day}`)}</span>
            <div className="hours-shifts">
              {shifts.length === 0 && <span className="hours-off">{t('dayOff')}</span>}
              {shifts.map((shift, i) => (
                <span key={i} className="hours-shift">
                  <input
                    type="time"
                    aria-label={t('shiftStart', { day: t(`weekdays.${day}`), n: i + 1 })}
                    value={shift.start}
                    onChange={(e) =>
                      setDay(
                        day,
                        shifts.map((s, j) => (j === i ? { ...s, start: e.target.value } : s)),
                      )
                    }
                  />
                  –
                  <input
                    type="time"
                    aria-label={t('shiftEnd', { day: t(`weekdays.${day}`), n: i + 1 })}
                    value={shift.end}
                    onChange={(e) =>
                      setDay(
                        day,
                        shifts.map((s, j) => (j === i ? { ...s, end: e.target.value } : s)),
                      )
                    }
                  />
                  <button
                    type="button"
                    className="btn-link danger"
                    aria-label={t('removeShift', { day: t(`weekdays.${day}`), n: i + 1 })}
                    onClick={() =>
                      setDay(
                        day,
                        shifts.filter((_, j) => j !== i),
                      )
                    }
                  >
                    ×
                  </button>
                </span>
              ))}
              <button
                type="button"
                className="btn-link"
                aria-label={t('addShiftFor', { day: t(`weekdays.${day}`) })}
                onClick={() => {
                  const last = shifts.at(-1);
                  setDay(day, [
                    ...shifts,
                    last
                      ? { start: last.end, end: last.end < '22:00' ? '22:00' : '23:59' }
                      : DEFAULT_SHIFT,
                  ]);
                }}
              >
                {t('addShift')}
              </button>
            </div>
            {errors?.[day] && (
              <p className="field-error" role="alert">
                {errors[day]}
              </p>
            )}
          </div>
        );
      })}
    </fieldset>
  );
}
