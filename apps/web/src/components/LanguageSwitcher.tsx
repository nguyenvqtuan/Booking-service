import { useTranslation } from 'react-i18next';
import { type Locale, SUPPORTED_LOCALES } from '@booking/shared';
import { useAuth } from '../auth/auth-context';
import { currentLocale } from '../i18n';

export function LanguageSwitcher() {
  const { t } = useTranslation();
  const { setLocale } = useAuth();
  return (
    <select
      className="lang-switcher"
      aria-label={t('language')}
      value={currentLocale()}
      onChange={(e) => void setLocale(e.target.value as Locale)}
    >
      {SUPPORTED_LOCALES.map((lng) => (
        <option key={lng} value={lng}>
          {t(`languages.${lng}`)}
        </option>
      ))}
    </select>
  );
}
