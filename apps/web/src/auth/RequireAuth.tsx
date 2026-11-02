import { useTranslation } from 'react-i18next';
import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from './auth-context';

/** Renders child routes only for signed-in users; others are sent to /login and back afterwards. */
export function RequireAuth() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <FullPageSpinner />;
  if (status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return <Outlet />;
}

/** Login/register pages: signed-in users go straight to the app. */
export function GuestOnly() {
  const { status } = useAuth();
  if (status === 'loading') return <FullPageSpinner />;
  if (status === 'authenticated') return <Navigate to="/" replace />;
  return <Outlet />;
}

function FullPageSpinner() {
  const { t } = useTranslation();
  return (
    <p className="container" role="status">
      {t('loading')}
    </p>
  );
}
