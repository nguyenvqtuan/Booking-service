import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { AppRoutes } from '../../App';
import { AuthProvider } from '../../auth/AuthProvider';
import { setSession } from '../../lib/session';
import { API, server } from '../../test/msw';

const SERVICE = '0b6f7d6e-1c1a-4b8e-9a8f-1a2b3c4d5e01';
const STAFF = '0b6f7d6e-1c1a-4b8e-9a8f-1a2b3c4d5e02';
const SLOT = '2030-01-07T02:00:00.000Z';

function renderPage(path = '/tiem-a') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter initialEntries={[path]}>
          <AppRoutes />
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe('PublicBookingPage', () => {
  let posted: Record<string, unknown> | undefined;

  beforeEach(() => {
    setSession(null);
    posted = undefined;
    server.use(
      http.post(`${API}/auth/refresh`, () => HttpResponse.json({}, { status: 401 })),
      http.get(`${API}/public/tiem-a`, () =>
        HttpResponse.json({ name: 'Tiệm A', slug: 'tiem-a', timezone: 'Asia/Ho_Chi_Minh' }),
      ),
      http.get(`${API}/public/tiem-a/services`, () =>
        HttpResponse.json([{ id: SERVICE, name: 'Cắt tóc', durationMin: 30, price: 100000 }]),
      ),
      http.get(`${API}/public/tiem-a/staff`, () => HttpResponse.json([{ id: STAFF, name: 'An' }])),
      http.get(`${API}/public/tiem-a/slots`, () =>
        HttpResponse.json([{ startAt: SLOT, time: '09:00' }]),
      ),
      http.post(`${API}/public/tiem-a/appointments`, async ({ request }) => {
        posted = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          {
            salonName: 'Tiệm A',
            serviceName: 'Cắt tóc',
            staffName: 'An',
            startAt: SLOT,
            endAt: '2030-01-07T02:30:00.000Z',
          },
          { status: 201 },
        );
      }),
    );
  });

  async function chooseSlot() {
    renderPage();
    await screen.findByRole('heading', { name: 'Tiệm A' });
    await screen.findByRole('option', { name: /Cắt tóc/ });
    await userEvent.selectOptions(screen.getByLabelText('Dịch vụ'), SERVICE);
    await screen.findByRole('option', { name: 'An' });
    await userEvent.selectOptions(screen.getByLabelText('Nhân viên'), STAFF);
    await userEvent.click(await screen.findByRole('button', { name: '09:00' }));
  }

  it('books without an account and shows a confirmation', async () => {
    await chooseSlot();
    await userEvent.type(screen.getByLabelText('Họ tên'), 'Lan');
    await userEvent.type(screen.getByLabelText('Số điện thoại'), '0912345678');
    await userEvent.click(screen.getByRole('button', { name: 'Đặt lịch' }));

    expect(await screen.findByRole('heading', { name: 'Đặt lịch thành công' })).toBeInTheDocument();
    expect(posted).toEqual({
      serviceId: SERVICE,
      staffId: STAFF,
      startAt: SLOT,
      name: 'Lan',
      phone: '0912345678',
      locale: 'vi',
    });
  });

  it('rejects an invalid phone on the client', async () => {
    await chooseSlot();
    await userEvent.type(screen.getByLabelText('Họ tên'), 'Lan');
    await userEvent.type(screen.getByLabelText('Số điện thoại'), '123');
    await userEvent.click(screen.getByRole('button', { name: 'Đặt lịch' }));
    expect(await screen.findByText('Số điện thoại không hợp lệ.')).toBeInTheDocument();
    expect(posted).toBeUndefined();
  });

  it('explains when the slot was just taken and asks to choose again', async () => {
    server.use(
      http.post(`${API}/public/tiem-a/appointments`, () =>
        HttpResponse.json(
          { statusCode: 409, code: 'SLOT_UNAVAILABLE', message: 'x' },
          { status: 409 },
        ),
      ),
    );
    await chooseSlot();
    await userEvent.type(screen.getByLabelText('Họ tên'), 'Lan');
    await userEvent.type(screen.getByLabelText('Số điện thoại'), '0912345678');
    await userEvent.click(screen.getByRole('button', { name: 'Đặt lịch' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Giờ này vừa có người đặt');
    expect(screen.getByRole('button', { name: '09:00' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('shows a message for an unknown salon', async () => {
    server.use(http.get(`${API}/public/khong-co`, () => HttpResponse.json({}, { status: 404 })));
    renderPage('/khong-co');
    expect(await screen.findByText(/Không tìm thấy tiệm/)).toBeInTheDocument();
  });
});
