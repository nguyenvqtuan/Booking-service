import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import type { AppointmentDto, CustomerDto, ServiceDto, StaffDto } from '@booking/shared';
import { setSession } from '../../lib/session';
import { API, server } from '../../test/msw';
import { renderSignedIn } from '../../test/render';

const id = (n: number) => `0b6f7d6e-1c1a-4b8e-9a8f-1a2b3c4d5e${String(n).padStart(2, '0')}`;
const services: ServiceDto[] = [
  { id: id(1), name: 'Cắt tóc', durationMin: 30, price: 0, isActive: true },
  { id: id(2), name: 'Làm móng', durationMin: 60, price: 0, isActive: true },
];
const week = { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] };
const staff: StaffDto[] = [
  { id: id(11), name: 'An', phone: null, workingHours: week, isActive: true, serviceIds: [id(1)] },
  {
    id: id(12),
    name: 'Bình',
    phone: null,
    workingHours: week,
    isActive: true,
    serviceIds: [id(2)],
  },
];
const customer: CustomerDto = {
  id: id(21),
  name: 'Lê Chi',
  phone: '+84901234567',
  note: null,
  locale: 'vi',
  noShowCount: 0,
};
const existing: AppointmentDto = {
  id: id(31),
  customerId: customer.id,
  customerName: customer.name,
  customerPhone: customer.phone,
  staffId: id(11),
  staffName: 'An',
  serviceId: id(1),
  serviceName: 'Cắt tóc',
  startAt: '2026-11-02T08:00:00.000Z',
  endAt: '2026-11-02T08:30:00.000Z',
  status: 'booked' as AppointmentDto['status'],
  source: 'admin' as AppointmentDto['source'],
  note: null,
};

const setInput = (el: HTMLElement, value: string) => fireEvent.change(el, { target: { value } });

describe('AppointmentsPage', () => {
  let listRanges: { from: string | null; to: string | null }[];
  let posted: Record<string, unknown> | undefined;
  let statusChange: unknown;

  beforeEach(() => {
    setSession(null);
    listRanges = [];
    posted = undefined;
    statusChange = undefined;
    server.use(
      http.get(`${API}/services`, () => HttpResponse.json(services)),
      http.get(`${API}/staff`, () => HttpResponse.json(staff)),
      http.get(`${API}/customers`, () => HttpResponse.json({ items: [customer], total: 1 })),
      http.get(`${API}/appointments`, ({ request }) => {
        const url = new URL(request.url);
        listRanges.push({ from: url.searchParams.get('from'), to: url.searchParams.get('to') });
        return HttpResponse.json(
          url.searchParams.get('from') === '2026-11-01T17:00:00.000Z' ? [existing] : [],
        );
      }),
      http.post(`${API}/appointments`, async ({ request }) => {
        posted = (await request.json()) as Record<string, unknown>;
        if (posted.startAt === '2026-11-02T08:15:00.000Z') {
          return HttpResponse.json(
            { statusCode: 409, code: 'APPOINTMENT_OVERLAP', message: 'x' },
            { status: 409 },
          );
        }
        return HttpResponse.json({ ...existing, id: id(32) }, { status: 201 });
      }),
      http.post(`${API}/appointments/:id/status`, async ({ request }) => {
        statusChange = await request.json();
        return HttpResponse.json({ ...existing, status: 'cancelled' });
      }),
    );
  });

  async function openDay() {
    localStorage.setItem('bs_appointments_view', 'list');
    renderSignedIn('/appointments');
    await screen.findByRole('heading', { name: 'Lịch hẹn' });
    setInput(screen.getByLabelText('Ngày'), '2026-11-02');
    return screen.findByText('Lê Chi');
  }

  it('queries the salon-local day and shows times in the salon timezone', async () => {
    const name = await openDay();
    // 2026-11-02 in Asia/Ho_Chi_Minh = [2026-11-01T17:00Z, 2026-11-02T17:00Z)
    expect(listRanges).toContainEqual({
      from: '2026-11-01T17:00:00.000Z',
      to: '2026-11-02T17:00:00.000Z',
    });
    const row = name.closest('li')!;
    expect(within(row).getByText('15:00–15:30')).toBeInTheDocument();
    expect(within(row).getByText('Đã đặt')).toBeInTheDocument();
  });

  async function fillForm(time: string) {
    await userEvent.click(screen.getByRole('button', { name: 'Tạo lịch hẹn' }));
    const dialog = screen.getByRole('dialog');
    await within(dialog).findByRole('option', { name: /Lê Chi/ });
    await userEvent.selectOptions(
      within(dialog).getByRole('combobox', { name: 'Khách hàng' }),
      customer.id,
    );
    await userEvent.selectOptions(within(dialog).getByLabelText('Dịch vụ'), id(1));
    // Only staff offering "Cắt tóc" are listed.
    const staffSelect = within(dialog).getByLabelText('Nhân viên');
    expect(within(staffSelect).queryByRole('option', { name: 'Bình' })).not.toBeInTheDocument();
    await userEvent.selectOptions(staffSelect, id(11));
    setInput(within(dialog).getByLabelText('Giờ'), time);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Lưu' }));
    return dialog;
  }

  it('converts the salon-local date/time to UTC when creating', async () => {
    await openDay();
    await fillForm('15:00');
    await vi.waitFor(() => expect(posted).toBeDefined());
    expect(posted).toMatchObject({
      customerId: customer.id,
      serviceId: id(1),
      staffId: id(11),
      startAt: '2026-11-02T08:00:00.000Z',
    });
  });

  it('explains an overlapping booking', async () => {
    await openDay();
    const dialog = await fillForm('15:15');
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Nhân viên đã có lịch hẹn trùng khung giờ này',
    );
  });

  it('cancels an appointment after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const row = (await openDay()).closest('li')!;
    await userEvent.click(within(row).getByRole('button', { name: 'Huỷ lịch' }));
    await vi.waitFor(() => expect(statusChange).toEqual({ status: 'cancelled' }));
  });

  it('offers no-show only once the appointment has started and asks first', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    let called = 0;
    server.use(
      http.post(`${API}/appointments/:id/no-show`, () => {
        called++;
        return HttpResponse.json({ ...existing, status: 'no_show' });
      }),
    );
    // `existing` starts on 2026-11-02, which is in the past for the test clock.
    const row = (await openDay()).closest('li')!;
    await userEvent.click(within(row).getByRole('button', { name: 'Không đến' }));
    await vi.waitFor(() => expect(called).toBe(1));
    expect(confirm).toHaveBeenCalled();
  });

  it('hides no-show for a future appointment', async () => {
    server.use(
      http.get(`${API}/appointments`, () =>
        HttpResponse.json([
          { ...existing, startAt: '2099-01-01T08:00:00.000Z', endAt: '2099-01-01T08:30:00.000Z' },
        ]),
      ),
    );
    const row = (await openDay()).closest('li')!;
    expect(within(row).queryByRole('button', { name: 'Không đến' })).not.toBeInTheDocument();
  });
});
