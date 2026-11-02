import { Link } from 'react-router';
import { useAuth } from '../auth/auth-context';

export function HomePage() {
  const { status, user, logout } = useAuth();

  if (status === 'loading') return <p className="container">Đang tải…</p>;

  return (
    <main className="container">
      <h1>Booking Service</h1>
      {user ? (
        <>
          <p>
            Xin chào <strong>{user.fullName}</strong> — {user.salonName}
          </p>
          <button type="button" className="btn-secondary" onClick={() => void logout()}>
            Đăng xuất
          </button>
        </>
      ) : (
        <p>
          <Link to="/login">Đăng nhập</Link> hoặc <Link to="/register">đăng ký tiệm mới</Link>.
        </p>
      )}
    </main>
  );
}
