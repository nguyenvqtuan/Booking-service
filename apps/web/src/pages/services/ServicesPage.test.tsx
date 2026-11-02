import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import type { ServiceDto } from '@booking/shared';
import { setSession } from '../../lib/session';
import { API, server } from '../../test/msw';
import { renderSignedIn } from '../../test/render';

describe('ServicesPage', () => {
  let services: ServiceDto[];

  beforeEach(() => {
    setSession(null);
    services = [{ id: 's1', name: 'Cắt tóc', durationMin: 30, price: 100000, isActive: true }];
    server.use(
      http.get(`${API}/services`, () => HttpResponse.json(services)),
      http.post(`${API}/services`, async ({ request }) => {
        const body = (await request.json()) as Omit<ServiceDto, 'id' | 'isActive'>;
        const created = { ...body, id: `s${services.length + 1}`, isActive: true };
        services = [...services, created];
        return HttpResponse.json(created, { status: 201 });
      }),
    );
  });

  it('lists services with formatted duration and price', async () => {
    renderSignedIn('/services');
    const row = (await screen.findByText('Cắt tóc')).closest('tr')!;
    expect(within(row).getByText('30 phút')).toBeInTheDocument();
    expect(within(row).getByText(/100\.000\s₫/)).toBeInTheDocument();
  });

  it('adds a service through the form', async () => {
    renderSignedIn('/services');
    await screen.findByText('Cắt tóc');

    await userEvent.click(screen.getByRole('button', { name: 'Thêm dịch vụ' }));
    const dialog = screen.getByRole('dialog', { name: 'Thêm dịch vụ' });
    await userEvent.type(within(dialog).getByLabelText('Tên dịch vụ'), 'Làm móng');
    await userEvent.clear(within(dialog).getByLabelText('Thời lượng (phút)'));
    await userEvent.type(within(dialog).getByLabelText('Thời lượng (phút)'), '60');
    await userEvent.clear(within(dialog).getByLabelText('Giá (VND)'));
    await userEvent.type(within(dialog).getByLabelText('Giá (VND)'), '200000');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Lưu' }));

    expect(await screen.findByText('Làm móng')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('blocks a zero duration on the client', async () => {
    renderSignedIn('/services');
    await screen.findByText('Cắt tóc');
    await userEvent.click(screen.getByRole('button', { name: 'Thêm dịch vụ' }));
    const dialog = screen.getByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Tên dịch vụ'), 'X');
    await userEvent.clear(within(dialog).getByLabelText('Thời lượng (phút)'));
    await userEvent.type(within(dialog).getByLabelText('Thời lượng (phút)'), '0');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Lưu' }));

    expect(
      await within(dialog).findByText('Thời lượng phải là số phút lớn hơn 0.'),
    ).toBeInTheDocument();
  });

  it('explains why a service in use cannot be deleted', async () => {
    server.use(
      http.delete(`${API}/services/s1`, () =>
        HttpResponse.json(
          { statusCode: 409, code: 'SERVICE_IN_USE', message: 'x' },
          { status: 409 },
        ),
      ),
    );
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderSignedIn('/services');
    const row = (await screen.findByText('Cắt tóc')).closest('tr')!;

    await userEvent.click(within(row).getByRole('button', { name: 'Xoá' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Hãy ẩn dịch vụ thay vì xoá');
  });
});
