import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { AuthProvider } from '../auth/AuthProvider';
import { API, server } from '../test/msw';
import { authResponse } from '../test/fixtures';
import { setSession } from '../lib/session';
import { LoginPage } from './LoginPage';

function renderLogin() {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<p>home page</p>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    setSession(null);
    // No session on page load.
    server.use(
      http.post(`${API}/auth/refresh`, () =>
        HttpResponse.json({ code: 'AUTH_INVALID_REFRESH_TOKEN' }, { status: 401 }),
      ),
    );
  });

  it('shows validation errors without calling the API', async () => {
    renderLogin();
    await userEvent.type(screen.getByLabelText('Email'), 'not-an-email');
    await userEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    expect(await screen.findByText('Email không hợp lệ.')).toBeInTheDocument();
  });

  it('shows the API error for wrong credentials', async () => {
    server.use(
      http.post(`${API}/auth/login`, () =>
        HttpResponse.json(
          { statusCode: 401, code: 'AUTH_INVALID_CREDENTIALS', message: 'x' },
          { status: 401 },
        ),
      ),
    );
    renderLogin();
    await userEvent.type(screen.getByLabelText('Email'), 'owner@example.com');
    await userEvent.type(screen.getByLabelText('Mật khẩu'), 'wrong-password');
    await userEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    expect(await screen.findByText('Email hoặc mật khẩu không đúng.')).toBeInTheDocument();
  });

  it('logs in and navigates to the home page', async () => {
    let body: unknown;
    server.use(
      http.post(`${API}/auth/login`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(authResponse('token'));
      }),
    );
    renderLogin();
    await userEvent.type(screen.getByLabelText('Email'), ' Owner@Example.com ');
    await userEvent.type(screen.getByLabelText('Mật khẩu'), 'correct-horse-1');
    await userEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    expect(await screen.findByText('home page')).toBeInTheDocument();
    expect(body).toEqual({ email: 'owner@example.com', password: 'correct-horse-1' });
  });
});
