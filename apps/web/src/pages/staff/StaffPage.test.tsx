import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import type { ServiceDto, StaffDto } from '@booking/shared';
import { setSession } from '../../lib/session';
import { API, server } from '../../test/msw';
import { renderSignedIn } from '../../test/render';

const services: ServiceDto[] = [
  {
    id: '0b6f7d6e-1c1a-4b8e-9a8f-1a2b3c4d5e01',
    name: 'Cắt tóc',
    durationMin: 30,
    price: 100000,
    isActive: true,
  },
  {
    id: '0b6f7d6e-1c1a-4b8e-9a8f-1a2b3c4d5e02',
    name: 'Làm móng',
    durationMin: 60,
    price: 200000,
    isActive: true,
  },
];

/** jsdom does not support typing into <input type="time">. */
const setTime = (input: HTMLElement, value: string) =>
  fireEvent.change(input, { target: { value } });

describe('StaffPage', () => {
  let posted: unknown;

  beforeEach(() => {
    setSession(null);
    posted = undefined;
    server.use(
      http.get(`${API}/services`, () => HttpResponse.json(services)),
      http.get(`${API}/staff`, () => HttpResponse.json([])),
      http.post(`${API}/staff`, async ({ request }) => {
        posted = await request.json();
        return HttpResponse.json({ id: 'st1', isActive: true, ...(posted as object) } as StaffDto, {
          status: 201,
        });
      }),
    );
  });

  async function openForm() {
    renderSignedIn('/staff');
    await screen.findByText('Chưa có nhân viên nào.');
    await userEvent.click(screen.getByRole('button', { name: 'Thêm nhân viên' }));
    return screen.getByRole('dialog', { name: 'Thêm nhân viên' });
  }

  it('creates a staff member with two shifts on Monday, days off and services', async () => {
    const dialog = await openForm();
    await userEvent.type(within(dialog).getByLabelText('Họ tên'), 'Nguyễn An');

    await userEvent.click(within(dialog).getByRole('button', { name: 'Thêm ca cho Thứ 2' }));
    const start1 = within(dialog).getByLabelText('Giờ bắt đầu ca 1 Thứ 2');
    const end1 = within(dialog).getByLabelText('Giờ kết thúc ca 1 Thứ 2');
    setTime(start1, '09:00');
    setTime(end1, '12:00');

    await userEvent.click(within(dialog).getByRole('button', { name: 'Thêm ca cho Thứ 2' }));
    const start2 = within(dialog).getByLabelText('Giờ bắt đầu ca 2 Thứ 2');
    const end2 = within(dialog).getByLabelText('Giờ kết thúc ca 2 Thứ 2');
    setTime(start2, '13:30');
    setTime(end2, '20:00');

    await userEvent.click(within(dialog).getByLabelText('Cắt tóc'));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Lưu' }));

    await screen.findByRole('heading', { name: 'Nhân viên' });
    await vi.waitFor(() => expect(posted).toBeDefined());
    expect(posted).toMatchObject({
      name: 'Nguyễn An',
      phone: null,
      serviceIds: ['0b6f7d6e-1c1a-4b8e-9a8f-1a2b3c4d5e01'],
      workingHours: {
        mon: [
          { start: '09:00', end: '12:00' },
          { start: '13:30', end: '20:00' },
        ],
        sun: [],
      },
    });
  });

  it('blocks overlapping shifts before calling the API', async () => {
    const dialog = await openForm();
    await userEvent.type(within(dialog).getByLabelText('Họ tên'), 'X');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Thêm ca cho Thứ 3' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Thêm ca cho Thứ 3' }));
    const start2 = within(dialog).getByLabelText('Giờ bắt đầu ca 2 Thứ 3');
    setTime(start2, '10:00');

    await userEvent.click(within(dialog).getByRole('button', { name: 'Lưu' }));

    expect(
      await within(dialog).findByText(
        'Giờ kết thúc phải sau giờ bắt đầu và các ca không được chồng nhau.',
      ),
    ).toBeInTheDocument();
    expect(posted).toBeUndefined();
  });
});
