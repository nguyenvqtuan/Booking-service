import { useAuth } from '../auth/auth-context';

export function HomePage() {
  const { user } = useAuth();
  return (
    <>
      <h1>Tổng quan</h1>
      <p>
        Xin chào <strong>{user?.fullName}</strong>. Trang đặt lịch công khai của tiệm:{' '}
        <code>/{user?.salonSlug}</code>
      </p>
    </>
  );
}
