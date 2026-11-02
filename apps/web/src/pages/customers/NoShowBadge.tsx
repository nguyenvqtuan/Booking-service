import { useTranslation } from 'react-i18next';
import { NO_SHOW_WARNING_THRESHOLD } from '@booking/shared';

export function NoShowBadge({ count }: { count: number }) {
  const { t } = useTranslation('customers');
  if (count < NO_SHOW_WARNING_THRESHOLD) return null;
  return (
    <span className="badge badge-warning" title={t('noShowWarning')}>
      {t('noShowBadge', { count })}
    </span>
  );
}
