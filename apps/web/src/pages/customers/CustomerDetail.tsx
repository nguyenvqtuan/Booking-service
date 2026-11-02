import { useTranslation } from 'react-i18next';
import { formatPhone } from '@booking/shared';
import { useAuth } from '../../auth/auth-context';
import { useCustomer } from '../../hooks/useCustomers';
import { currentLocale } from '../../i18n';
import { formatDateTime } from '../../lib/format';
import { NoShowBadge } from './NoShowBadge';

export function CustomerDetail({ id }: { id: string }) {
  const { t } = useTranslation(['customers', 'common']);
  const { user } = useAuth();
  const { data, isPending } = useCustomer(id);

  if (isPending || !data) return <p role="status">{t('common:loading')}</p>;

  return (
    <div className="customer-detail">
      <p>
        <strong>{data.name}</strong> <NoShowBadge count={data.noShowCount} />
      </p>
      <p>{formatPhone(data.phone)}</p>
      {data.note && <p className="muted">{data.note}</p>}
      <p>{t('noShowCount', { count: data.noShowCount })}</p>

      <h3>{t('history')}</h3>
      {data.history.length === 0 ? (
        <p className="empty">{t('noHistory')}</p>
      ) : (
        <ul className="history-list">
          {data.history.map((h) => (
            <li key={h.id}>
              <span>{formatDateTime(h.startAt, currentLocale(), user?.salonTimezone)}</span>
              <span>
                {h.serviceName} · {h.staffName}
              </span>
              <span className={`status status-${h.status}`}>{t(`status.${h.status}`)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
