import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import type { AppointmentDto } from '@booking/shared';
import { setSession } from '../../lib/session';
import { API, server } from '../../test/msw';
import { renderSignedIn } from '../../test/render';

const now = new Date();
// An appointment at 15:00 salon time (08:00 UTC) today.
const startAt = new Date(
  Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 8, 0),
).toISOString();
const appointment = {
  id: 'a1',
  customerId: 'c1',
  customerName: 'Lê Chi',
  customerPhone: '+84901234567',
  staffId: 's1',
  staffName: 'An',
  serviceId: 'v1',
  serviceName: 'Cắt tóc',
  startAt,
  endAt: new Date(Date.parse(startAt) + 30 * 60_000).toISOString(),
  status: 'booked',
  source: 'admin',
  note: null,
} as AppointmentDto;

describe('AppointmentsCalendar', () => {
  let ranges: string[];

  beforeEach(() => {
    setSession(null);
    ranges = [];
    localStorage.setItem('bs_appointments_view', 'calendar');
    server.use(
      http.get(`${API}/staff`, () => HttpResponse.json([])),
      http.get(`${API}/services`, () => HttpResponse.json([])),
      http.get(`${API}/customers`, () => HttpResponse.json({ items: [], total: 0 })),
      http.get(`${API}/appointments`, ({ request }) => {
        const url = new URL(request.url);
        ranges.push(`${url.searchParams.get('from')}|${url.searchParams.get('to')}`);
        return HttpResponse.json([appointment]);
      }),
    );
  });

  it('loads the visible range and shows events in the salon timezone', async () => {
    renderSignedIn('/appointments');
    expect(await screen.findByText('Lê Chi · Cắt tóc')).toBeInTheDocument();
    expect(screen.getByText(/15:00/)).toBeInTheDocument();
    // The day view asks for exactly one salon-local day (17:00Z -> 17:00Z for UTC+7).
    expect(ranges[0]).toMatch(/T17:00:00\.000Z\|.*T17:00:00\.000Z$/);
  });

  it('opens the edit dialog when an event is clicked', async () => {
    renderSignedIn('/appointments');
    await userEvent.click(await screen.findByText('Lê Chi · Cắt tóc'));
    expect(await screen.findByRole('dialog', { name: 'Sửa lịch hẹn' })).toBeInTheDocument();
  });
});
