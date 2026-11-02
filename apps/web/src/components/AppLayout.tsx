import { NavLink, Outlet } from 'react-router';
import { useAuth } from '../auth/auth-context';

export function AppLayout() {
  const { user, logout } = useAuth();
  return (
    <div className="app-shell">
      <header className="app-header">
        <NavLink to="/" className="app-brand">
          {user?.salonName ?? 'Booking Service'}
        </NavLink>
        <div className="app-header-right">
          <span className="app-user">{user?.fullName}</span>
          <button type="button" className="btn-secondary" onClick={() => void logout()}>
            Đăng xuất
          </button>
        </div>
      </header>
      <main className="container">
        <Outlet />
      </main>
    </div>
  );
}
