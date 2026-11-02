import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { AppRoutes } from '../App';
import { AuthProvider } from '../auth/AuthProvider';
import { authResponse } from './fixtures';
import { API, server } from './msw';

/** Renders the whole app at `path` with a signed-in owner (session restored via refresh). */
export function renderSignedIn(path: string) {
  server.use(http.post(`${API}/auth/refresh`, () => HttpResponse.json(authResponse('t'))));
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
