import { type AuthResponse, SalonRole } from '@booking/shared';

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
    salons: [{ id: 's1', name: 'Tiệm Mẫu', slug: 'tiem-mau', role: SalonRole.Owner }],
  },
});
