import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { AppRoutes } from '../../App';
import { AuthProvider } from '../../auth/AuthProvider';
import { setSession } from '../../lib/session';
import { API, server } from '../../test/msw';

const view = {
  salonName: 'Tiệm A',
  timezone: 'Asia/Ho_Chi_Minh',
  serviceName: 'Cắt tóc',
  staffName: 'An',
  startAt: '2030-01-07T08:00:00.000Z',
  endAt: '2030-01-07T08:30:00.000Z',
  status: 'booked',
};
const BASE = `${API}/appointment-actions/tok123`;

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter initialEntries={['/appointment/tok123']}>
          <AppRoutes />
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe('AppointmentActionPage', () => {
  beforeEach(() => {
    setSession(null);
    server.use(
      http.post(`${API}/auth/refresh`, () => HttpResponse.json({}, { status: 401 })),
      http.get(BASE, () => HttpResponse.json(view)),
    );
  });

  it('shows the appointment in the salon timezone and confirms it', async () => {
    server.use(
      http.post(`${BASE}/confirm`, () => HttpResponse.json({ ...view, status: 'confirmed' })),
    );
    renderPage();
    await screen.findByText('Cắt tóc · An');
    expect(screen.getByText(/15:00/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Xác nhận sẽ đến' }));
    expect(await screen.findByRole('heading', { name: /Đã xác nhận/ })).toBeInTheDocument();
  });

  it('cancels after asking', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    server.use(
      http.post(`${BASE}/cancel`, () => HttpResponse.json({ ...view, status: 'cancelled' })),
    );
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Huỷ lịch' }));
    expect(await screen.findByRole('heading', { name: 'Đã huỷ lịch hẹn.' })).toBeInTheDocument();
  });

  it('reschedules by choosing a free time', async () => {
    let body: unknown;
    server.use(
      http.get(`${BASE}/slots`, () =>
        HttpResponse.json([{ startAt: '2030-01-07T09:00:00.000Z', time: '16:00' }]),
      ),
      http.post(`${BASE}/reschedule`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ ...view, startAt: '2030-01-07T09:00:00.000Z' });
      }),
    );
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Dời lịch' }));
    await userEvent.click(await screen.findByRole('button', { name: '16:00' }));
    expect(await screen.findByRole('heading', { name: 'Đã dời lịch hẹn.' })).toBeInTheDocument();
    expect(body).toEqual({ startAt: '2030-01-07T09:00:00.000Z' });
  });

  it('explains an invalid or used link', async () => {
    server.use(
      http.get(BASE, () =>
        HttpResponse.json(
          { statusCode: 410, code: 'ACTION_TOKEN_INVALID', message: 'x' },
          { status: 410 },
        ),
      ),
    );
    renderPage();
    expect(await screen.findByText(/đã được sử dụng/)).toBeInTheDocument();
  });

  it('offers no actions for a finished appointment', async () => {
    server.use(http.get(BASE, () => HttpResponse.json({ ...view, status: 'completed' })));
    renderPage();
    expect(await screen.findByText(/đã kết thúc hoặc đã huỷ/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Xác nhận sẽ đến' })).not.toBeInTheDocument();
  });
});
