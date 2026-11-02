import { z } from 'zod';
import { type Locale, localeSchema } from './locale.js';

export const PASSWORD_MIN_LENGTH = 8;

const email = z.string().trim().toLowerCase().pipe(z.email());
const password = z.string().min(PASSWORD_MIN_LENGTH).max(72); // bcrypt only uses 72 bytes

export const registerSchema = z.object({
  salonName: z.string().trim().min(2).max(150),
  fullName: z.string().trim().min(2).max(150),
  email,
  password,
  locale: localeSchema.optional(),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email,
  password: z.string().min(1).max(72),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({ email });
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(20).max(200),
  password,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const updateProfileSchema = z.object({ locale: localeSchema });
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  locale: Locale;
  salonId: string;
  salonName: string;
  salonSlug: string;
  /** IANA timezone of the salon; all wall-clock times are shown in it. */
  salonTimezone: string;
}

/** Body of register/login/refresh responses. The refresh token travels in an httpOnly cookie. */
export interface AuthResponse {
  accessToken: string;
  /** Access token lifetime in seconds. */
  expiresIn: number;
  user: AuthUser;
}

/** Claims carried by the access token. */
export interface AccessTokenPayload {
  sub: string;
  salonId: string;
}
