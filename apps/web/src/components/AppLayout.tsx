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
      <main className="container">
        <Outlet />
      </main>
    </div>
  );
}
