import { render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { AppRoutes } from '../App';
import { setSession } from '../lib/session';
import { authResponse } from '../test/fixtures';
import { API, server } from '../test/msw';
import { AuthProvider } from './AuthProvider';

const renderAt = (path: string) =>
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </AuthProvider>,
  );

describe('route guards', () => {
  beforeEach(() => setSession(null));

  it('redirects anonymous users from a protected page to /login', async () => {
    server.use(
      http.post(`${API}/auth/refresh`, () =>
        HttpResponse.json({ code: 'AUTH_INVALID_REFRESH_TOKEN' }, { status: 401 }),
      ),
    );
    renderAt('/');
    expect(await screen.findByRole('heading', { name: 'Đăng nhập' })).toBeInTheDocument();
  });

  it('restores the session from the refresh cookie and shows the protected page', async () => {
    server.use(http.post(`${API}/auth/refresh`, () => HttpResponse.json(authResponse('t'))));
    renderAt('/');
    expect(await screen.findByRole('heading', { name: 'Tổng quan' })).toBeInTheDocument();
    expect(screen.getByText('Tiệm Mẫu')).toBeInTheDocument();
  });

  it('sends signed-in users away from /login', async () => {
    server.use(http.post(`${API}/auth/refresh`, () => HttpResponse.json(authResponse('t'))));
    renderAt('/login');
    expect(await screen.findByRole('heading', { name: 'Tổng quan' })).toBeInTheDocument();
  });

  it('goes back to /login when the session expires while using the app', async () => {
    server.use(http.post(`${API}/auth/refresh`, () => HttpResponse.json(authResponse('t'))));
    renderAt('/');
    await screen.findByRole('heading', { name: 'Tổng quan' });

    setSession(null); // e.g. a later refresh failed
    expect(await screen.findByRole('heading', { name: 'Đăng nhập' })).toBeInTheDocument();
  });
});
