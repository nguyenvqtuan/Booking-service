import Joi from 'joi';

/** Required/optional API environment variables. The app refuses to start when invalid. */
export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().port().default(3000),
  CORS_ORIGIN: Joi.string().default('http://localhost:5173'),

  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().port().default(5432),
  DB_USER: Joi.string().required(),
  DB_PASSWORD: Joi.string().allow('').required(),
  DB_NAME: Joi.string().required(),
  DB_SSL: Joi.boolean().truthy('true').falsy('false').default(false),
  DB_LOGGING: Joi.boolean().truthy('true').falsy('false').default(false),

  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_TTL_SEC: Joi.number().integer().min(60).default(900),
  REFRESH_TOKEN_TTL_DAYS: Joi.number().integer().min(1).default(7),
  PASSWORD_RESET_TTL_MIN: Joi.number().integer().min(5).default(30),
  BCRYPT_ROUNDS: Joi.number().integer().min(4).max(15).default(10),
  COOKIE_SECURE: Joi.boolean().truthy('true').falsy('false').default(false),
  APP_WEB_URL: Joi.string().uri().default('http://localhost:5173'),

  REDIS_URL: Joi.string()
    .uri({ scheme: ['redis', 'rediss'] })
    .default('redis://localhost:6379'),
  /** Run the reminder dispatch cron in this API instance (BS-27). */
  REMINDER_CRON_ENABLED: Joi.boolean().truthy('true').falsy('false').default(true),
  /** Message provider: 'fake' logs messages instead of sending them (dev/tests). */
  MESSAGE_PROVIDER: Joi.string().valid('fake', 'live').default('fake'),
  /** Delays between reminder retries for transient errors, in ms (BS-32): 1, 5, 15 minutes. */
  REMINDER_RETRY_DELAYS_MS: Joi.string()
    .pattern(/^\d+(,\d+)*$/)
    .default('60000,300000,900000'),

  // Zalo ZNS (BS-29) — required when MESSAGE_PROVIDER=live.
  ZNS_API_URL: Joi.string().uri().default('https://business.openapi.zalo.me'),
  ZNS_OAUTH_URL: Joi.string().uri().default('https://oauth.zaloapp.com'),
  ZNS_APP_ID: Joi.string().when('MESSAGE_PROVIDER', { is: 'live', then: Joi.required() }),
  ZNS_APP_SECRET: Joi.string().when('MESSAGE_PROVIDER', { is: 'live', then: Joi.required() }),
  /** Seeds provider_tokens on first start; later refresh tokens are rotated in the database. */
  ZNS_REFRESH_TOKEN: Joi.string().optional(),
  ZNS_TEMPLATE_ID_VI: Joi.string().when('MESSAGE_PROVIDER', { is: 'live', then: Joi.required() }),
  ZNS_TEMPLATE_ID_EN: Joi.string().optional(),

  // SMS brandname via eSMS (BS-30) — required when MESSAGE_PROVIDER=live.
  SMS_API_URL: Joi.string().uri().default('https://rest.esms.vn/MainService.svc/json'),
  SMS_API_KEY: Joi.string().when('MESSAGE_PROVIDER', { is: 'live', then: Joi.required() }),
  SMS_SECRET_KEY: Joi.string().when('MESSAGE_PROVIDER', { is: 'live', then: Joi.required() }),
  SMS_BRANDNAME: Joi.string().when('MESSAGE_PROVIDER', { is: 'live', then: Joi.required() }),
  /** Must match the template approved by the carriers; placeholders {salon} {service} {time} {date} {name}. */
  SMS_TEMPLATE_VI: Joi.string().optional(),
  SMS_TEMPLATE_EN: Joi.string().optional(),
  /** eSMS sandbox: requests are validated but no SMS is delivered or charged. */
  SMS_SANDBOX: Joi.boolean().truthy('true').falsy('false').default(false),
});
