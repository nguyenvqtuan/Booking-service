import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { SalonRole } from '@booking/shared';
import { setSession } from '../lib/session';
import { authResponse } from '../test/fixtures';
import { API, server } from '../test/msw';
import { renderSignedIn } from '../test/render';

const BRANCH_2 = { id: 's2', name: 'Chi nhánh 2', slug: 'cn-2', role: SalonRole.Owner };

function sessionFor(salonId: string) {
  const res = authResponse(`token-${salonId}`);
  res.user.salons = [...res.user.salons, BRANCH_2];
  res.user.salonId = salonId;
  res.user.salonName = salonId === 's2' ? 'Chi nhánh 2' : 'Tiệm Mẫu';
  return res;
}

describe('SalonSwitcher', () => {
  let authHeaders: (string | null)[];

  beforeEach(() => {
    setSession(null);
    authHeaders = [];
    server.use(
      http.get(`${API}/services`, ({ request }) => {
        const auth = request.headers.get('Authorization');
        authHeaders.push(auth);
        const name = auth === 'Bearer token-s2' ? 'Dịch vụ CN2' : 'Dịch vụ CN1';
        return HttpResponse.json([{ id: 'x', name, durationMin: 30, price: 0, isActive: true }]);
      }),
    );
  });

  it('switches branch, and refetches so no data of the previous branch stays on screen', async () => {
    let body: unknown;
    server.use(
      http.post(`${API}/auth/switch-salon`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(sessionFor('s2'));
      }),
    );
    renderSignedIn('/services', sessionFor('s1'));
    await screen.findByText('Dịch vụ CN1');

    await userEvent.selectOptions(screen.getByLabelText('Chi nhánh'), 's2');

    expect(await screen.findByText('Dịch vụ CN2')).toBeInTheDocument();
    expect(screen.queryByText('Dịch vụ CN1')).not.toBeInTheDocument();
    expect(body).toEqual({ salonId: 's2' });
    expect(authHeaders.at(-1)).toBe('Bearer token-s2');
    expect(screen.getByLabelText('Chi nhánh')).toHaveValue('s2');
  });

  it('creates a branch and switches to it', async () => {
    let created: unknown;
    server.use(
      http.post(`${API}/salons`, async ({ request }) => {
        created = await request.json();
        return HttpResponse.json(BRANCH_2, { status: 201 });
      }),
      http.post(`${API}/auth/switch-salon`, () => HttpResponse.json(sessionFor('s2'))),
    );
    renderSignedIn('/services', sessionFor('s1'));
    await screen.findByText('Dịch vụ CN1');

    await userEvent.selectOptions(screen.getByLabelText('Chi nhánh'), '__add__');
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Tên chi nhánh'), 'Chi nhánh 2');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Tạo chi nhánh' }));

    expect(await screen.findByText('Dịch vụ CN2')).toBeInTheDocument();
    expect(created).toEqual({ name: 'Chi nhánh 2' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows an error and stays on the branch when switching fails', async () => {
    server.use(
      http.post(`${API}/auth/switch-salon`, () =>
        HttpResponse.json({ statusCode: 404, code: 'NOT_FOUND', message: 'x' }, { status: 404 }),
      ),
    );
    renderSignedIn('/services', sessionFor('s1'));
    await screen.findByText('Dịch vụ CN1');
    await userEvent.selectOptions(screen.getByLabelText('Chi nhánh'), 's2');
    expect(await screen.findByRole('alert')).toHaveTextContent('Không tìm thấy dữ liệu.');
    expect(screen.getByLabelText('Chi nhánh')).toHaveValue('s1');
  });

  it('drops cached data on logout', async () => {
    server.use(http.post(`${API}/auth/logout`, () => new HttpResponse(null, { status: 204 })));
    renderSignedIn('/services', sessionFor('s1'));
    await screen.findByText('Dịch vụ CN1');
    await userEvent.click(screen.getByRole('button', { name: 'Đăng xuất' }));
    await screen.findByRole('heading', { name: 'Đăng nhập' });
    expect(screen.queryByText('Dịch vụ CN1')).not.toBeInTheDocument();
  });
});
