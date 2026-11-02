import { envValidationSchema } from './env.validation.js';

const base = {
  DB_HOST: 'localhost',
  DB_USER: 'u',
  DB_PASSWORD: 'p',
  DB_NAME: 'db',
  JWT_ACCESS_SECRET: 'x'.repeat(32),
};

describe('envValidationSchema', () => {
  it('applies default values', () => {
    const { value, error } = envValidationSchema.validate(base);
    expect(error).toBeUndefined();
    expect(value).toMatchObject({
      PORT: 3000,
      DB_PORT: 5432,
      DB_SSL: false,
      NODE_ENV: 'development',
    });
  });

  it('fails when DB_HOST is missing', () => {
    const { error } = envValidationSchema.validate({ ...base, DB_HOST: undefined });
    expect(error?.message).toContain('DB_HOST');
  });

  it('rejects a short JWT secret', () => {
    const { error } = envValidationSchema.validate({ ...base, JWT_ACCESS_SECRET: 'short' });
    expect(error?.message).toContain('JWT_ACCESS_SECRET');
  });

  it('parses DB_SSL given as a string', () => {
    const { value } = envValidationSchema.validate({ ...base, DB_SSL: 'true' });
    expect(value.DB_SSL).toBe(true);
  });
});
