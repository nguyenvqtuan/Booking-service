import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectDataSource } from '@nestjs/typeorm';
import bcrypt from 'bcryptjs';
import { DataSource, type EntityManager, IsNull, MoreThan } from 'typeorm';
import {
  type AccessTokenPayload,
  type AuthResponse,
  type AuthUser,
  DEFAULT_REMINDER_OFFSETS_MIN,
  ErrorCode,
  type ForgotPasswordInput,
  type LoginInput,
  type RegisterInput,
  RESERVED_SLUGS,
  type ResetPasswordInput,
  type UpdateProfileInput,
} from '@booking/shared';
import { AppException } from '../common/app.exception.js';
import { isPgError, PgErrorCode } from '../common/pg-errors.js';
import { slugify } from '../common/slugify.js';
import { PasswordResetToken, ReminderSetting, Salon, User } from '../database/entities/index.js';
import { MailService } from '../mail/mail.service.js';
import { type IssuedRefreshToken, RefreshTokenService } from './refresh-token.service.js';
import { generateOpaqueToken, hashToken } from './token-hash.js';

export interface AuthResult {
  response: AuthResponse;
  refreshToken: IssuedRefreshToken;
}

interface UserWithSalon {
  user: User;
  salon: Salon;
}

/** Compared against when the email is unknown, so login timing does not reveal accounts. */
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('dummy-password-for-timing', 10);

@Injectable()
export class AuthService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly refreshTokens: RefreshTokenService,
    private readonly mail: MailService,
  ) {}

  /** Creates the salon, its default reminder settings and the owner account in one transaction. */
  async register(input: RegisterInput): Promise<AuthResult> {
    const passwordHash = await bcrypt.hash(input.password, this.bcryptRounds());

    // Two concurrent sign-ups can pick the same free slug; retry so the next one picks "-2".
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.authenticate(await this.createOwner(input, passwordHash));
      } catch (err) {
        if (isPgError(err, PgErrorCode.UniqueViolation, 'UQ_users_email')) {
          throw new AppException(
            HttpStatus.CONFLICT,
            ErrorCode.AuthEmailTaken,
            'Email already registered',
          );
        }
        if (attempt < 5 && isPgError(err, PgErrorCode.UniqueViolation, 'UQ_salons_slug')) continue;
        throw err;
      }
    }
  }

  private createOwner(input: RegisterInput, passwordHash: string): Promise<UserWithSalon> {
    return this.dataSource.transaction(async (em) => {
      if (await em.exists(User, { where: { email: input.email } })) {
        throw new AppException(
          HttpStatus.CONFLICT,
          ErrorCode.AuthEmailTaken,
          'Email already registered',
        );
      }
      const salon = await em.save(
        em.create(Salon, {
          name: input.salonName,
          slug: await this.uniqueSlug(input.salonName, em),
        }),
      );
      await em.insert(ReminderSetting, {
        salonId: salon.id,
        offsets: DEFAULT_REMINDER_OFFSETS_MIN,
      });
      const created = await em.save(
        em.create(User, {
          salonId: salon.id,
          email: input.email,
          passwordHash,
          fullName: input.fullName,
          ...(input.locale && { locale: input.locale }),
        }),
      );
      return { user: created, salon };
    });
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const user = await this.dataSource.getRepository(User).findOneBy({ email: input.email });
    const valid = await bcrypt.compare(input.password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
    if (!user || !valid) {
      throw new AppException(
        HttpStatus.UNAUTHORIZED,
        ErrorCode.AuthInvalidCredentials,
        'Invalid email or password',
      );
    }
    return this.authenticate(await this.withSalon(user));
  }

  async refresh(rawRefreshToken: string | undefined): Promise<AuthResult> {
    if (!rawRefreshToken) {
      throw new AppException(
        HttpStatus.UNAUTHORIZED,
        ErrorCode.AuthInvalidRefreshToken,
        'Missing refresh token',
      );
    }
    const rotated = await this.refreshTokens.rotate(rawRefreshToken);
    const user = await this.findUserWithSalon(rotated.userId);
    return {
      response: await this.buildResponse(user),
      refreshToken: { token: rotated.token, expiresAt: rotated.expiresAt },
    };
  }

  async logout(rawRefreshToken: string | undefined): Promise<void> {
    if (rawRefreshToken) await this.refreshTokens.revoke(rawRefreshToken);
  }

  async me(userId: string): Promise<AuthUser> {
    return this.toAuthUser(await this.findUserWithSalon(userId));
  }

  async updateProfile(userId: string, input: UpdateProfileInput): Promise<AuthUser> {
    await this.dataSource.getRepository(User).update({ id: userId }, { locale: input.locale });
    return this.me(userId);
  }

  /** Always succeeds so the endpoint cannot be used to discover registered emails. */
  async forgotPassword(input: ForgotPasswordInput): Promise<void> {
    const user = await this.dataSource.getRepository(User).findOneBy({ email: input.email });
    if (!user) return;

    const token = generateOpaqueToken();
    const ttlMin = this.config.getOrThrow<number>('PASSWORD_RESET_TTL_MIN');
    await this.dataSource.getRepository(PasswordResetToken).insert({
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + ttlMin * 60 * 1000),
    });

    const link = `${this.config.getOrThrow<string>('APP_WEB_URL')}/reset-password?token=${token}`;
    await this.mail.send({
      to: user.email,
      subject: 'Đặt lại mật khẩu Booking Service',
      text: `Mở liên kết sau để đặt lại mật khẩu (hết hạn sau ${ttlMin} phút):\n${link}`,
    });
  }

  /** Consumes a reset token, sets the new password and signs the user out everywhere. */
  async resetPassword(input: ResetPasswordInput): Promise<void> {
    const passwordHash = await bcrypt.hash(input.password, this.bcryptRounds());

    await this.dataSource.transaction(async (em) => {
      const tokenHash = hashToken(input.token);
      const { affected } = await em.update(
        PasswordResetToken,
        { tokenHash, usedAt: IsNull(), expiresAt: MoreThan(new Date()) },
        { usedAt: new Date() },
      );
      if (!affected) {
        throw new AppException(
          HttpStatus.BAD_REQUEST,
          ErrorCode.AuthInvalidResetToken,
          'Invalid or expired reset token',
        );
      }
      const { userId } = await em.findOneByOrFail(PasswordResetToken, { tokenHash });
      await em.update(User, { id: userId }, { passwordHash });
      await this.refreshTokens.revokeAllForUser(userId, em);
    });
  }

  private async authenticate(owner: UserWithSalon): Promise<AuthResult> {
    return {
      response: await this.buildResponse(owner),
      refreshToken: await this.refreshTokens.issue(owner.user.id),
    };
  }

  private async buildResponse({ user, salon }: UserWithSalon): Promise<AuthResponse> {
    const payload: AccessTokenPayload = { sub: user.id, salonId: user.salonId };
    return {
      accessToken: await this.jwt.signAsync(payload),
      expiresIn: this.config.getOrThrow<number>('JWT_ACCESS_TTL_SEC'),
      user: this.toAuthUser({ user, salon }),
    };
  }

  private toAuthUser({ user, salon }: UserWithSalon): AuthUser {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      locale: user.locale,
      salonId: user.salonId,
      salonName: salon.name,
      salonSlug: salon.slug,
      salonTimezone: salon.timezone,
    };
  }

  private async findUserWithSalon(userId: string): Promise<UserWithSalon> {
    return this.withSalon(
      await this.dataSource.getRepository(User).findOneByOrFail({ id: userId }),
    );
  }

  /** Loads the user's salon through the implicit users.salon_id relation (BS-70). */
  private async withSalon(user: User): Promise<UserWithSalon> {
    const salon = await this.dataSource.getRepository(Salon).findOneByOrFail({ id: user.salonId });
    return { user, salon };
  }

  /** "Tiệm A" -> "tiem-a", then "tiem-a-2", "tiem-a-3"... if taken. */
  private async uniqueSlug(name: string, em: EntityManager): Promise<string> {
    const base = slugify(name) || 'salon';
    for (let n = 1; ; n++) {
      const candidate = n === 1 ? base : `${base}-${n}`;
      if (RESERVED_SLUGS.includes(candidate)) continue;
      if (!(await em.exists(Salon, { where: { slug: candidate } }))) return candidate;
    }
  }

  private bcryptRounds(): number {
    return this.config.getOrThrow<number>('BCRYPT_ROUNDS');
  }
}
