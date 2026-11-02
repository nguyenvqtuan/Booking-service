import { http, HttpResponse } from 'msw';
import { API, server } from '../test/msw';
import { authResponse } from '../test/fixtures';
import { api } from './api';
import { getAccessToken, setSession } from './session';

/** A protected endpoint that only accepts `Bearer fresh`. */
const protectedEndpoint = http.get(`${API}/protected`, ({ request }) =>
  request.headers.get('Authorization') === 'Bearer fresh'
    ? HttpResponse.json({ ok: true })
    : HttpResponse.json({ code: 'UNAUTHORIZED' }, { status: 401 }),
);

describe('api client', () => {
  beforeEach(() => setSession(authResponse('stale')));

  it('refreshes the access token on 401 and retries the request', async () => {
    let refreshCalls = 0;
    server.use(
      protectedEndpoint,
      http.post(`${API}/auth/refresh`, () => {
        refreshCalls++;
        return HttpResponse.json(authResponse('fresh'));
      }),
    );

    const res = await api.get('/protected');

    expect(res.data).toEqual({ ok: true });
    expect(refreshCalls).toBe(1);
    expect(getAccessToken()).toBe('fresh');
  });

  it('shares a single refresh between concurrent 401 responses', async () => {
    let refreshCalls = 0;
    server.use(
      protectedEndpoint,
      http.post(`${API}/auth/refresh`, async () => {
        refreshCalls++;
        await new Promise((r) => setTimeout(r, 20));
        return HttpResponse.json(authResponse('fresh'));
      }),
    );

    const results = await Promise.all([
      api.get('/protected'),
      api.get('/protected'),
      api.get('/protected'),
    ]);

    expect(results.every((r) => r.data.ok)).toBe(true);
    expect(refreshCalls).toBe(1);
  });

  it('clears the session when the refresh token is rejected', async () => {
    server.use(
      protectedEndpoint,
      http.post(`${API}/auth/refresh`, () =>
        HttpResponse.json({ code: 'AUTH_INVALID_REFRESH_TOKEN' }, { status: 401 }),
      ),
    );

    await expect(api.get('/protected')).rejects.toMatchObject({ response: { status: 401 } });
    expect(getAccessToken()).toBeNull();
  });

  it('does not try to refresh when login itself returns 401', async () => {
    let refreshCalls = 0;
    server.use(
      http.post(`${API}/auth/login`, () =>
        HttpResponse.json({ code: 'AUTH_INVALID_CREDENTIALS' }, { status: 401 }),
      ),
      http.post(`${API}/auth/refresh`, () => {
        refreshCalls++;
        return HttpResponse.json(authResponse('fresh'));
      }),
    );

    await expect(api.post('/auth/login', {})).rejects.toBeDefined();
    expect(refreshCalls).toBe(0);
  });
});
