import { useQuery } from '@tanstack/react-query';
import { DateTime } from 'luxon';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ReportDto } from '@booking/shared';
import { useAuth } from '../../auth/auth-context';
import { currentLocale } from '../../i18n';
import { api } from '../../lib/api';
import { salonToday } from '../../lib/salon-time';
import { monthLabel } from './chart-helpers';
import { MonthlyOutcomesChart } from './MonthlyOutcomesChart';

const percent = (value: number | null, locale: string) =>
  value === null
    ? '—'
    : new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : 'en-US', {
        style: 'percent',
        maximumFractionDigits: 1,
      }).format(value);

/** Statistics that show whether reminders reduce no-shows (BS-40). */
export function ReportsPage() {
  const { t } = useTranslation(['reports', 'common', 'errors']);
  const { user } = useAuth();
  const locale = currentLocale();
  const [to, setTo] = useState(() => salonToday(user?.salonTimezone));
  const [from, setFrom] = useState(() =>
    DateTime.fromISO(salonToday(user?.salonTimezone))
      .minus({ months: 5 })
      .startOf('month')
      .toISODate()!,
  );
  const validRange = !!from && !!to && from <= to;
  const { data, isPending, isError } = useQuery({
    queryKey: ['reports', from, to],
    queryFn: async () =>
      (await api.get<ReportDto>('/reports/summary', { params: { from, to } })).data,
    enabled: validRange,
  });
  const empty = data && data.totals.appointments === 0 && data.totals.messages === 0;

  const tiles = data && [
    { label: t('appointments'), value: String(data.totals.appointments) },
    { label: t('completed'), value: String(data.totals.completed) },
    { label: t('noShow'), value: String(data.totals.noShow) },
    { label: t('noShowRate'), value: percent(data.totals.noShowRate, locale) },
    { label: t('messages'), value: String(data.totals.messages) },
    { label: t('messageSuccessRate'), value: percent(data.totals.messageSuccessRate, locale) },
  ];

  return (
    <>
      <h1>{t('title')}</h1>
      <div className="toolbar">
        <label>
          {t('from')} <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          {t('to')} <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
      </div>

      {!validRange && <p className="form-error">{t('invalidRange')}</p>}
      {validRange && isPending && <p role="status">{t('common:loading')}</p>}
      {isError && <p className="form-error">{t('errors:fallback')}</p>}
      {empty && <p className="empty">{t('empty')}</p>}

      {data && !empty && (
        <>
          <dl className="stat-row">
            {tiles?.map((tile) => (
              <div key={tile.label} className="stat-tile">
                <dt>{tile.label}</dt>
                <dd>{tile.value}</dd>
              </div>
            ))}
          </dl>
          <p className="muted">{t('rateHint')}</p>

          <MonthlyOutcomesChart months={data.months} />

          <details className="viz-table">
            <summary>{t('tableView')}</summary>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('month')}</th>
                    <th>{t('appointments')}</th>
                    <th>{t('completed')}</th>
                    <th>{t('noShow')}</th>
                    <th>{t('cancelled')}</th>
                    <th>{t('noShowRate')}</th>
                    <th>{t('messages')}</th>
                    <th>{t('messageSuccessRate')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.months.map((m) => (
                    <tr key={m.month}>
                      <td>{monthLabel(m.month, locale)}</td>
                      <td>{m.appointments}</td>
                      <td>{m.completed}</td>
                      <td>{m.noShow}</td>
                      <td>{m.cancelled}</td>
                      <td>{percent(m.noShowRate, locale)}</td>
                      <td>{m.messages}</td>
                      <td>{percent(m.messageSuccessRate, locale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </>
  );
}
