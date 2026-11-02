import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setSession } from '../../lib/session';
import { API, server } from '../../test/msw';
import { renderSignedIn } from '../../test/render';

describe('ReminderSettingsPage', () => {
  let saved: unknown;

  beforeEach(() => {
    setSession(null);
    saved = undefined;
    server.use(
      http.get(`${API}/reminder-settings`, () =>
        HttpResponse.json({ offsets: [1440, 120], fallbackEnabled: true }),
      ),
      http.put(`${API}/reminder-settings`, async ({ request }) => {
        saved = await request.json();
        return HttpResponse.json(saved as object);
      }),
    );
  });

  it('shows the current settings and saves changes', async () => {
    renderSignedIn('/settings/reminders');
    expect(await screen.findByLabelText('Trước 1 ngày')).toBeChecked();
    expect(screen.getByLabelText('Trước 2 giờ')).toBeChecked();
    expect(screen.getByLabelText('Trước 1 giờ')).not.toBeChecked();

    await userEvent.click(screen.getByLabelText('Trước 2 giờ'));
    await userEvent.click(screen.getByLabelText('Trước 1 giờ'));
    await userEvent.type(screen.getByLabelText('Giờ'), '3');
    await userEvent.type(screen.getByLabelText('Phút'), '30');
    await userEvent.click(screen.getByRole('button', { name: 'Thêm mốc' }));
    await userEvent.click(screen.getByLabelText('Gửi SMS khi khách không nhận được tin Zalo'));
    await userEvent.click(screen.getByRole('button', { name: 'Lưu cài đặt' }));

    expect(await screen.findByText(/Đã lưu/)).toBeInTheDocument();
    expect(saved).toEqual({ offsets: [1440, 210, 60], fallbackEnabled: false });
    expect(screen.getByLabelText('Trước 3 giờ 30 phút')).toBeChecked();
  });

  it('warns when no reminder time is selected', async () => {
    renderSignedIn('/settings/reminders');
    await userEvent.click(await screen.findByLabelText('Trước 1 ngày'));
    await userEvent.click(screen.getByLabelText('Trước 2 giờ'));
    expect(screen.getByText(/khách sẽ không nhận được tin nhắc/)).toBeInTheDocument();
  });
});
