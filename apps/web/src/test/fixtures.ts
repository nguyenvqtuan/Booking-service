import type { AuthResponse } from '@booking/shared';

export const authResponse = (accessToken: string): AuthResponse => ({
  accessToken,
  expiresIn: 900,
  user: {
    id: 'u1',
    email: 'owner@example.com',
    fullName: 'Chủ Tiệm',
    locale: 'vi',
    salonId: 's1',
    salonName: 'Tiệm Mẫu',
    salonSlug: 'tiem-mau',
    salonTimezone: 'Asia/Ho_Chi_Minh',
  },
});
