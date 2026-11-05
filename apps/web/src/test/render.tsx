import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { AuthResponse } from '@booking/shared';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { AppRoutes } from '../App';
import { AuthProvider } from '../auth/AuthProvider';
import { authResponse } from './fixtures';
import { API, server } from './msw';

/** Renders the whole app at `path` with a signed-in owner (session restored via refresh). */
export function renderSignedIn(path: string, session: AuthResponse = authResponse('t')) {
  server.use(http.post(`${API}/auth/refresh`, () => HttpResponse.json(session)));
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter initialEntries={[path]}>
          <AppRoutes />
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}
