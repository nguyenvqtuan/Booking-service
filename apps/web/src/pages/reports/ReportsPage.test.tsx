import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import type { ReportDto, ReportMonth } from '@booking/shared';
import { setSession } from '../../lib/session';
import { API, server } from '../../test/msw';
import { renderSignedIn } from '../../test/render';
import { monthLabel, niceMax } from './chart-helpers';

const month = (m: string, completed: number, noShow: number): ReportMonth => ({
  month: m,
  appointments: completed + noShow,
  completed,
  noShow,
  cancelled: 0,
  noShowRate: completed + noShow ? noShow / (completed + noShow) : null,
  messages: 4,
  messagesSucceeded: 3,
  messageSuccessRate: 0.75,
});
const report: ReportDto = {
  totals: month('total', 4, 1),
  months: [month('2030-01', 3, 1), month('2030-02', 1, 0)],
};

describe('ReportsPage', () => {
  let queries: { from: string | null; to: string | null }[];
  let response: ReportDto;

  beforeEach(() => {
    setSession(null);
    queries = [];
    response = report;
    server.use(
      http.get(`${API}/reports/summary`, ({ request }) => {
        const url = new URL(request.url);
        queries.push({ from: url.searchParams.get('from'), to: url.searchParams.get('to') });
        return HttpResponse.json(response);
      }),
    );
  });

  it('shows the KPI tiles with computed rates', async () => {
    renderSignedIn('/reports');
    const tile = (await screen.findByText('Tỷ lệ không đến', { selector: 'dt' })).parentElement!;
    expect(within(tile).getByText('20%')).toBeInTheDocument();
    const delivery = screen.getByText('Tỷ lệ gửi thành công', { selector: 'dt' }).parentElement!;
    expect(within(delivery).getByText('75%')).toBeInTheDocument();
  });

  it('reloads when the period changes', async () => {
    renderSignedIn('/reports');
    await screen.findByText('Tỷ lệ không đến', { selector: 'dt' });
    fireEvent.change(screen.getByLabelText('Từ ngày'), { target: { value: '2020-01-01' } });
    await vi.waitFor(() => expect(queries.at(-1)?.from).toBe('2020-01-01'));
  });

  it('refuses an inverted period', async () => {
    renderSignedIn('/reports');
    await screen.findByText('Tỷ lệ không đến', { selector: 'dt' });
    fireEvent.change(screen.getByLabelText('Từ ngày'), { target: { value: '2999-01-01' } });
    expect(await screen.findByText(/phải trước ngày kết thúc/)).toBeInTheDocument();
  });

  it('shows an empty state for a salon without data', async () => {
    response = { totals: month('total', 0, 0), months: [] };
    response.totals.messages = 0;
    renderSignedIn('/reports');
    expect(await screen.findByText(/Chưa có dữ liệu/)).toBeInTheDocument();
    expect(screen.queryByRole('figure')).not.toBeInTheDocument();
  });

  it('draws one labelled column per month with a tooltip and a data table', async () => {
    renderSignedIn('/reports');
    const column = await screen.findByTestId('month-2030-01');
    expect(column).toHaveAttribute(
      'aria-label',
      expect.stringContaining('Hoàn thành 3, Không đến 1'),
    );
    expect(column.querySelectorAll('path')).toHaveLength(2);
    expect(screen.getByTestId('month-2030-02').querySelectorAll('path')).toHaveLength(1);

    await userEvent.hover(column);
    expect(await screen.findByRole('status')).toHaveTextContent('Hoàn thành: 3');

    const table = screen.getByRole('table', { hidden: true });
    expect(within(table).getAllByRole('row', { hidden: true })).toHaveLength(3);
  });
});

describe('chart helpers', () => {
  it.each([
    [1, 4],
    [4, 4],
    [5, 8],
    [37, 40],
    [101, 200],
  ])('niceMax(%i) = %i', (value, expected) => {
    expect(niceMax(value)).toBe(expected);
  });

  it('labels months in the UI language', () => {
    expect(monthLabel('2030-01', 'en')).toMatch(/Jan/);
    expect(monthLabel('2030-01', 'vi')).toMatch(/1/);
  });
});
