import type { ConfigService } from '@nestjs/config';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { SendOutcome } from '../message-provider.js';
import { EsmsProvider } from './esms.provider.js';

const API = 'https://esms.test/json';

describe('EsmsProvider (mocked eSMS API)', () => {
  const server = setupServer();
  let env: Record<string, unknown>;
  let requests: Record<string, string>[];

  const config = {
    get: (k: string) => env[k],
    getOrThrow: (k: string) => {
      if (env[k] === undefined) throw new Error(`missing ${k}`);
      return env[k];
    },
  } as unknown as ConfigService;
  const provider = () => new EsmsProvider(config);
  const message = {
    to: '+84901234567',
    locale: 'vi' as const,
    params: {
      customerName: 'Chi',
      salonName: 'Tiệm A',
      serviceName: 'Cắt tóc',
      time: '09:30',
      date: '2026-11-02',
    },
  };
  const respond = (body: object, status = 200) =>
    server.use(
      http.post(`${API}/SendMultipleMessage_V4_post_json/`, async ({ request }) => {
        requests.push((await request.json()) as Record<string, string>);
        return HttpResponse.json(body, { status });
      }),
    );

  beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
  beforeEach(() => {
    requests = [];
    env = {
      SMS_API_URL: API,
      SMS_API_KEY: 'k',
      SMS_SECRET_KEY: 's',
      SMS_BRANDNAME: 'BOOKING',
      SMS_SANDBOX: false,
    };
  });
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it('sends the rendered template with brandname and national phone format', async () => {
    respond({ CodeResult: '100', SMSID: 'sms-1' });
    const result = await provider().send(message);
    expect(result).toEqual({ outcome: SendOutcome.Success, providerMsgId: 'sms-1' });
    expect(requests[0]).toMatchObject({
      ApiKey: 'k',
      SecretKey: 's',
      Brandname: 'BOOKING',
      Phone: '0901234567',
      SmsType: '2',
      IsUnicode: '0',
      Sandbox: '0',
      Content: 'Tiem A: Nhac lich hen Cat toc luc 09:30 ngay 02/11/2026. Hen gap quy khach!',
    });
  });

  it('uses the configured (carrier-approved) template and sandbox flag', async () => {
    env.SMS_TEMPLATE_VI = 'Lich hen tai {salon} luc {time}';
    env.SMS_SANDBOX = true;
    respond({ CodeResult: '100', SMSID: 'sms-2' });
    await provider().send(message);
    expect(requests[0]).toMatchObject({ Content: 'Lich hen tai Tiem A luc 09:30', Sandbox: '1' });
  });

  it.each([
    ['146', SendOutcome.Permanent],
    ['103', SendOutcome.Permanent],
    ['99', SendOutcome.Transient],
    ['777', SendOutcome.Permanent],
  ])('maps CodeResult %s to %s', async (code, outcome) => {
    respond({ CodeResult: code, ErrorMessage: 'eSMS error' });
    const result = await provider().send(message);
    expect(result.outcome).toBe(outcome);
    expect(result.error).toContain(code);
  });

  it('treats HTTP 5xx and network errors as transient', async () => {
    respond({}, 503);
    expect((await provider().send(message)).outcome).toBe(SendOutcome.Transient);
    server.use(http.post(`${API}/SendMultipleMessage_V4_post_json/`, () => HttpResponse.error()));
    expect((await provider().send(message)).outcome).toBe(SendOutcome.Transient);
  });
});
