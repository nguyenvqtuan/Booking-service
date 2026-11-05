import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { AppRoutes } from '../App';
import { AuthProvider } from '../auth/AuthProvider';
import i18n from '../i18n';
import { setSession } from '../lib/session';
import { authResponse } from '../test/fixtures';
import { API, server } from '../test/msw';

const renderAt = (path: string) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AuthProvider>
        <MemoryRouter initialEntries={[path]}>
          <AppRoutes />
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );

describe('language switching', () => {
  beforeEach(() => setSession(null));

  it('switches the whole UI between vi and en without reloading', async () => {
    server.use(
      http.post(`${API}/auth/refresh`, () =>
        HttpResponse.json({ code: 'AUTH_INVALID_REFRESH_TOKEN' }, { status: 401 }),
      ),
    );
    renderAt('/login');
    expect(await screen.findByRole('heading', { name: 'Đăng nhập' })).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('Ngôn ngữ'), 'en');

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(localStorage.getItem('bs_lang')).toBe('en');
  });

  it('saves the choice to the profile when signed in', async () => {
    let patched: unknown;
    server.use(
      http.post(`${API}/auth/refresh`, () => HttpResponse.json(authResponse('t'))),
      http.patch(`${API}/auth/me`, async ({ request }) => {
        patched = await request.json();
        return HttpResponse.json({ ...authResponse('t').user, locale: 'en' });
      }),
    );
    renderAt('/');
    await screen.findByRole('heading', { name: 'Tổng quan' });

    await userEvent.selectOptions(screen.getByLabelText('Ngôn ngữ'), 'en');

    expect(await screen.findByRole('heading', { name: 'Overview' })).toBeInTheDocument();
    expect(patched).toEqual({ locale: 'en' });
  });

  it('applies the language saved in the profile after sign-in', async () => {
    const enUser = authResponse('t');
    enUser.user.locale = 'en';
    server.use(http.post(`${API}/auth/refresh`, () => HttpResponse.json(enUser)));
    renderAt('/');
    expect(await screen.findByRole('heading', { name: 'Overview' })).toBeInTheDocument();
    expect(i18n.language).toBe('en');
  });
});
