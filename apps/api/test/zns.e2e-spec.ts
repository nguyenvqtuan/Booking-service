import type { ConfigService } from '@nestjs/config';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import type { DataSource } from 'typeorm';
import { ProviderToken } from '../src/database/entities/index.js';
import { SendOutcome, type ReminderMessage } from '../src/messaging/message-provider.js';
import { ZNS_TOKEN_PROVIDER, ZnsTokenStore } from '../src/messaging/zns/zns-token.store.js';
import { ZnsProvider } from '../src/messaging/zns/zns.provider.js';
import { createTestDataSource } from './utils/test-data-source.js';

const API = 'https://zns.test';
const OAUTH = 'https://oauth.test';

const message = (overrides: Partial<ReminderMessage> = {}): ReminderMessage => ({
  to: '+84901234567',
  locale: 'vi',
  params: {
    customerName: 'Lê Chi',
    salonName: 'Tiệm A',
    serviceName: 'Cắt tóc',
    time: '15:00',
    date: '2026-11-02',
  },
  ...overrides,
});

describe('ZNS provider (e2e with mocked Zalo API)', () => {
  const server = setupServer();
  let ds: DataSource;
  let env: Record<string, string | undefined>;
  let sendRequests: { token: string | null; body: Record<string, unknown> }[];
  let refreshRequests: URLSearchParams[];
  let refreshCount: number;

  const config = {
    get: (key: string) => env[key],
    getOrThrow: (key: string) => {
      if (env[key] === undefined) throw new Error(`missing ${key}`);
      return env[key];
    },
  } as unknown as ConfigService;

  const tokens = () => new ZnsTokenStore(ds, config);
  const provider = () => new ZnsProvider(tokens(), config);
  const tokenRow = () =>
    ds.getRepository(ProviderToken).findOneBy({ provider: ZNS_TOKEN_PROVIDER });
  const setToken = (accessToken: string, expiresInMs: number, refreshToken = 'refresh-db') =>
    ds.getRepository(ProviderToken).save({
      provider: ZNS_TOKEN_PROVIDER,
      accessToken,
      refreshToken,
      expiresAt: new Date(Date.now() + expiresInMs),
    });

  /** Zalo send endpoint: accepts only `valid-*` tokens, responds with `error` for given phones. */
  const sendHandler = (errorsByPhone: Record<string, number> = {}) =>
    http.post(`${API}/message/template`, async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      const token = request.headers.get('access_token');
      sendRequests.push({ token, body });
      if (!token?.startsWith('valid'))
        return HttpResponse.json({ error: -124, message: 'Access token is invalid' });
      const error = errorsByPhone[String(body.phone)];
      if (error) return HttpResponse.json({ error, message: 'zalo error' });
      return HttpResponse.json({ error: 0, message: 'Success', data: { msg_id: 'msg-123' } });
    });

  const refreshHandler = http.post(`${OAUTH}/v4/oa/access_token`, async ({ request }) => {
    refreshCount++;
    const form = new URLSearchParams(await request.text());
    refreshRequests.push(form);
    await new Promise((r) => setTimeout(r, 50)); // widen the race window
    return HttpResponse.json({
      access_token: `valid-${refreshCount}`,
      refresh_token: `refresh-${refreshCount}`,
      expires_in: '90000',
    });
  });

  beforeAll(async () => {
    ds = await createTestDataSource();
    server.listen({ onUnhandledFrame: 'bypass' });
  });

  beforeEach(async () => {
    env = {
      ZNS_API_URL: API,
      ZNS_OAUTH_URL: OAUTH,
      ZNS_APP_ID: 'app-1',
      ZNS_APP_SECRET: 'secret-1',
      ZNS_REFRESH_TOKEN: 'refresh-env',
      ZNS_TEMPLATE_ID_VI: 'tpl-vi',
    };
    sendRequests = [];
    refreshRequests = [];
    refreshCount = 0;
    await ds.getRepository(ProviderToken).delete({ provider: ZNS_TOKEN_PROVIDER });
    server.use(sendHandler(), refreshHandler);
  });

  afterEach(() => server.resetHandlers());

  afterAll(async () => {
    server.close();
    await ds.getRepository(ProviderToken).delete({ provider: ZNS_TOKEN_PROVIDER });
    await ds.destroy();
  });

  it('sends the template with params, phone without "+" and the OA access token', async () => {
    await setToken('valid-db', 3_600_000);
    const result = await provider().send(message());
    expect(result).toEqual({ outcome: SendOutcome.Success, providerMsgId: 'msg-123' });
    expect(sendRequests[0]).toEqual({
      token: 'valid-db',
      body: {
        phone: '84901234567',
        template_id: 'tpl-vi',
        template_data: {
          customer_name: 'Lê Chi',
          salon_name: 'Tiệm A',
          service_name: 'Cắt tóc',
          time: '15:00',
          date: '2026-11-02',
        },
      },
    });
  });

  it('picks the template by customer locale, falling back to Vietnamese', async () => {
    await setToken('valid-db', 3_600_000);
    await provider().send(message({ locale: 'en' }));
    env.ZNS_TEMPLATE_ID_EN = 'tpl-en';
    await provider().send(message({ locale: 'en' }));
    expect(sendRequests.map((r) => r.body.template_id)).toEqual(['tpl-vi', 'tpl-en']);
  });

  it.each([
    [-118, SendOutcome.RecipientUnreachable],
    [-119, SendOutcome.RecipientUnreachable],
    [-32, SendOutcome.Transient],
    [-131, SendOutcome.Permanent],
    [-9999, SendOutcome.Permanent],
  ])('maps Zalo error %i to %s', async (code, outcome) => {
    await setToken('valid-db', 3_600_000);
    server.use(sendHandler({ '84901234567': code }));
    const result = await provider().send(message());
    expect(result.outcome).toBe(outcome);
    expect(result.error).toContain(String(code));
  });

  it('treats HTTP 5xx and network errors as transient', async () => {
    await setToken('valid-db', 3_600_000);
    server.use(http.post(`${API}/message/template`, () => new HttpResponse(null, { status: 502 })));
    expect((await provider().send(message())).outcome).toBe(SendOutcome.Transient);
    server.use(http.post(`${API}/message/template`, () => HttpResponse.error()));
    expect((await provider().send(message())).outcome).toBe(SendOutcome.Transient);
  });

  it('bootstraps the token from ZNS_REFRESH_TOKEN, stores it and reuses it', async () => {
    expect((await provider().send(message())).outcome).toBe(SendOutcome.Success);
    expect(refreshRequests[0].get('refresh_token')).toBe('refresh-env');
    expect(refreshRequests[0].get('app_id')).toBe('app-1');
    expect(await tokenRow()).toMatchObject({ accessToken: 'valid-1', refreshToken: 'refresh-1' });

    await provider().send(message());
    expect(refreshCount).toBe(1);
  });

  it('refreshes an expired token with the rotated refresh token from the database', async () => {
    await setToken('valid-old', -1000, 'refresh-db');
    await provider().send(message());
    expect(refreshRequests[0].get('refresh_token')).toBe('refresh-db');
    expect(await tokenRow()).toMatchObject({ accessToken: 'valid-1', refreshToken: 'refresh-1' });
  });

  it('refreshes and retries once when Zalo rejects the token (-124)', async () => {
    await setToken('revoked', 3_600_000);
    const result = await provider().send(message());
    expect(result.outcome).toBe(SendOutcome.Success);
    expect(sendRequests.map((r) => r.token)).toEqual(['revoked', 'valid-1']);
  });

  it('refreshes only once when several workers find the token expired at the same time', async () => {
    await setToken('valid-old', -1000);
    const results = await Promise.all([1, 2, 3].map(() => provider().send(message())));
    expect(results.every((r) => r.outcome === SendOutcome.Success)).toBe(true);
    expect(refreshCount).toBe(1); // the single-use refresh token is never reused
  });

  it('reports a failed refresh as transient instead of throwing', async () => {
    server.use(
      http.post(`${OAUTH}/v4/oa/access_token`, () =>
        HttpResponse.json({ error: -14014, error_name: 'Invalid refresh token' }, { status: 400 }),
      ),
    );
    const result = await provider().send(message());
    expect(result.outcome).toBe(SendOutcome.Transient);
    expect(result.error).toContain('refresh failed');
  });
});
