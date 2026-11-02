import { DEFAULT_TIMEZONE } from '@booking/shared';

export function App() {
  return (
    <main className="container">
      <h1>Booking Service</h1>
      <p>Đặt lịch và nhắc hẹn tự động cho tiệm.</p>
      <small>Múi giờ mặc định: {DEFAULT_TIMEZONE}</small>
    </main>
  );
}
