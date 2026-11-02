import { envValidationSchema } from './env.validation.js';

const base = { DB_HOST: 'localhost', DB_USER: 'u', DB_PASSWORD: 'p', DB_NAME: 'db' };

describe('envValidationSchema', () => {
  it('áp giá trị mặc định', () => {
    const { value, error } = envValidationSchema.validate(base);
    expect(error).toBeUndefined();
    expect(value).toMatchObject({
      PORT: 3000,
      DB_PORT: 5432,
      DB_SSL: false,
      NODE_ENV: 'development',
    });
  });

  it('báo lỗi khi thiếu DB_HOST', () => {
    const { error } = envValidationSchema.validate({ ...base, DB_HOST: undefined });
    expect(error?.message).toContain('DB_HOST');
  });

  it('parse DB_SSL dạng chuỗi', () => {
    const { value } = envValidationSchema.validate({ ...base, DB_SSL: 'true' });
    expect(value.DB_SSL).toBe(true);
  });
});
