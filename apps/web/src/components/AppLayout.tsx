import { useTranslation } from 'react-i18next';
import { NavLink, Outlet } from 'react-router';
import { useAuth } from '../auth/auth-context';
import { LanguageSwitcher } from './LanguageSwitcher';

export function AppLayout() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  return (
    <div className="app-shell">
      <header className="app-header">
        <NavLink to="/" className="app-brand">
          {user?.salonName ?? t('appName')}
        </NavLink>
        <div className="app-header-right">
          <span className="app-user">{user?.fullName}</span>
          <LanguageSwitcher />
          <button type="button" className="btn-secondary" onClick={() => void logout()}>
            {t('logout')}
          </button>
        </div>
      </header>
      <nav className="app-nav" aria-label={t('appName')}>
        <NavLink to="/" end>
          {t('nav.overview')}
        </NavLink>
        <NavLink to="/appointments">{t('nav.appointments')}</NavLink>
        <NavLink to="/services">{t('nav.services')}</NavLink>
        <NavLink to="/staff">{t('nav.staff')}</NavLink>
        <NavLink to="/customers">{t('nav.customers')}</NavLink>
        <NavLink to="/settings/reminders">{t('nav.settings')}</NavLink>
      </nav>
      <main className="container">
        <Outlet />
      </main>
    </div>
  );
}
