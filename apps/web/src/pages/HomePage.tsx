import { Trans, useTranslation } from 'react-i18next';
import { useAuth } from '../auth/auth-context';

export function HomePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  return (
    <>
      <h1>{t('home.title')}</h1>
      <p>
        <Trans
          i18nKey="home.greeting"
          values={{ name: user?.fullName, slug: user?.salonSlug }}
          components={{ strong: <strong />, code: <code /> }}
        />
      </p>
    </>
  );
}
