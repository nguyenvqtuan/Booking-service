import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import type { CustomerDto } from '@booking/shared';
import { setSession } from '../../lib/session';
import { API, server } from '../../test/msw';
import { renderSignedIn } from '../../test/render';

const all: CustomerDto[] = [
  {
    id: 'c1',
    name: 'Nguyễn Văn An',
    phone: '+84901111111',
    note: null,
    locale: 'vi',
    noShowCount: 0,
  },
  {
    id: 'c2',
    name: 'Trần Thị Bình',
    phone: '+84902222222',
    note: null,
    locale: 'vi',
    noShowCount: 3,
  },
];

describe('CustomersPage', () => {
  let queries: (string | null)[];
  let posted: unknown;

  beforeEach(() => {
    setSession(null);
    queries = [];
    posted = undefined;
    server.use(
      http.get(`${API}/customers`, ({ request }) => {
        const q = new URL(request.url).searchParams.get('q');
        queries.push(q);
        const items = q ? all.filter((c) => c.name.includes(q)) : all;
        return HttpResponse.json({ items, total: items.length });
      }),
      http.post(`${API}/customers`, async ({ request }) => {
        posted = await request.json();
        if ((posted as { phone: string }).phone === '+84902222222') {
          return HttpResponse.json(
            { statusCode: 409, code: 'CUSTOMER_PHONE_TAKEN', message: 'x' },
            { status: 409 },
          );
        }
        return HttpResponse.json(
          { id: 'c3', noShowCount: 0, locale: 'vi', note: null, ...(posted as object) },
          { status: 201 },
        );
      }),
    );
  });

  it('shows formatted phones and a warning badge for frequent no-shows', async () => {
    renderSignedIn('/customers');
    const binh = (await screen.findByText('Trần Thị Bình')).closest('tr')!;
    expect(within(binh).getByText('0902 222 222')).toBeInTheDocument();
    expect(within(binh).getByText('Bỏ hẹn 3 lần')).toBeInTheDocument();
    const an = screen.getByText('Nguyễn Văn An').closest('tr')!;
    expect(within(an).queryByText(/Bỏ hẹn/)).not.toBeInTheDocument();
  });

  it('searches with a debounced query', async () => {
    renderSignedIn('/customers');
    await screen.findByText('Nguyễn Văn An');
    await userEvent.type(screen.getByLabelText('Tìm khách hàng'), 'Bình');
    await vi.waitFor(() => expect(screen.queryByText('Nguyễn Văn An')).not.toBeInTheDocument());
    expect(screen.getByText('Trần Thị Bình')).toBeInTheDocument();
    // One request for the initial list and one for the final query, not one per keystroke.
    expect(queries.filter((q) => q !== null)).toEqual(['Bình']);
  });

  it('normalizes the phone before sending and shows a duplicate phone error on the field', async () => {
    renderSignedIn('/customers');
    await screen.findByText('Nguyễn Văn An');
    await userEvent.click(screen.getByRole('button', { name: 'Thêm khách hàng' }));
    const dialog = screen.getByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Họ tên'), 'Bình 2');
    await userEvent.type(within(dialog).getByLabelText('Số điện thoại'), '090 222 2222');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Lưu' }));

    expect(
      await within(dialog).findByText('Số điện thoại này đã thuộc về khách hàng khác.'),
    ).toBeInTheDocument();
    expect(posted).toMatchObject({ phone: '+84902222222' });
  });

  it('rejects an invalid phone on the client', async () => {
    renderSignedIn('/customers');
    await screen.findByText('Nguyễn Văn An');
    await userEvent.click(screen.getByRole('button', { name: 'Thêm khách hàng' }));
    const dialog = screen.getByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Họ tên'), 'X');
    await userEvent.type(within(dialog).getByLabelText('Số điện thoại'), '12345');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Lưu' }));

    expect(await within(dialog).findByText('Số điện thoại không hợp lệ.')).toBeInTheDocument();
    expect(posted).toBeUndefined();
  });
});
