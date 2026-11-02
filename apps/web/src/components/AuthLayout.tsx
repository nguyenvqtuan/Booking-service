import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from './LanguageSwitcher';

export function AuthLayout({ title, children }: { title: string; children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="auth-card-top">
          <p className="brand">{t('appName')}</p>
          <LanguageSwitcher />
        </div>
        <h1>{title}</h1>
        {children}
      </div>
    </main>
  );
}
