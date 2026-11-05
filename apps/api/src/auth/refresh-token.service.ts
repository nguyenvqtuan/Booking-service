import { randomUUID } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, type EntityManager, IsNull } from 'typeorm';
import { ErrorCode } from '@booking/shared';
import { AppException } from '../common/app.exception.js';
import { RefreshToken } from '../database/entities/index.js';
import { generateOpaqueToken, hashToken } from './token-hash.js';

export interface IssuedRefreshToken {
  token: string;
  expiresAt: Date;
}

const invalidRefreshToken = () =>
  new AppException(
    HttpStatus.UNAUTHORIZED,
    ErrorCode.AuthInvalidRefreshToken,
    'Invalid refresh token',
  );

@Injectable()
export class RefreshTokenService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  /** Issues a new refresh token; a new family is started unless `familyId` is given. */
  async issue(
    userId: string,
    familyId: string = randomUUID(),
    em: EntityManager = this.dataSource.manager,
    salonId: string | null = null,
  ): Promise<IssuedRefreshToken> {
    const token = generateOpaqueToken();
    const ttlDays = this.config.getOrThrow<number>('REFRESH_TOKEN_TTL_DAYS');
    const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);
    await em.insert(RefreshToken, {
      userId,
      familyId,
      salonId,
      tokenHash: hashToken(token),
      expiresAt,
    });
    return { token, expiresAt };
  }

  /**
   * Rotates a refresh token: the presented token is revoked and a new one in the same family is
   * issued. The row lock serializes concurrent rotations of the same token.
   *
   * Presenting a token rotated moments ago is normal: the page was reloaded during the request
   * (the browser never stored the new cookie) or another tab refreshed at the same time. Within
   * the grace period, and while the session is still alive, it gets a new token. Any other reuse
   * of a revoked token is treated as theft and revokes the family. A session ended by logout, a
   * password reset or a theft alarm has no active token left, so the grace period cannot revive it.
   */
  async rotate(
    rawToken: string,
  ): Promise<{ userId: string; salonId: string | null } & IssuedRefreshToken> {
    const result = await this.dataSource.transaction(async (em) => {
      const existing = await em
        .getRepository(RefreshToken)
        .createQueryBuilder('t')
        .setLock('pessimistic_write')
        .where('t.token_hash = :hash', { hash: hashToken(rawToken) })
        .getOne();
      if (!existing) return { ok: false as const };

      if (existing.revokedAt) {
        const graceMs = this.config.getOrThrow<number>('REFRESH_REUSE_GRACE_SEC') * 1000;
        const recent = Date.now() - existing.revokedAt.getTime() <= graceMs;
        const sessionAlive = await em.exists(RefreshToken, {
          where: { familyId: existing.familyId, revokedAt: IsNull() },
        });
        if (!recent || !sessionAlive) {
          await this.revokeFamily(existing.familyId, em);
          return { ok: false as const };
        }
      } else {
        if (existing.expiresAt.getTime() <= Date.now()) return { ok: false as const };
        await em.update(RefreshToken, { id: existing.id }, { revokedAt: new Date() });
      }

      // The selected salon stays with the session across rotations.
      const issued = await this.issue(existing.userId, existing.familyId, em, existing.salonId);
      return { ok: true as const, userId: existing.userId, salonId: existing.salonId, ...issued };
    });
    if (!result.ok) throw invalidRefreshToken();
    return {
      userId: result.userId,
      salonId: result.salonId,
      token: result.token,
      expiresAt: result.expiresAt,
    };
  }

  /** Remembers the salon selected in this session (BS-42). */
  async setSalon(rawToken: string, salonId: string): Promise<void> {
    await this.dataSource
      .getRepository(RefreshToken)
      .update({ tokenHash: hashToken(rawToken), revokedAt: IsNull() }, { salonId });
  }

  /** Revokes a single token (logout). Unknown tokens are ignored. */
  async revoke(rawToken: string): Promise<void> {
    await this.dataSource
      .getRepository(RefreshToken)
      .update({ tokenHash: hashToken(rawToken), revokedAt: IsNull() }, { revokedAt: new Date() });
  }

  async revokeAllForUser(userId: string, em: EntityManager = this.dataSource.manager) {
    await em.update(RefreshToken, { userId, revokedAt: IsNull() }, { revokedAt: new Date() });
  }

  private async revokeFamily(familyId: string, em: EntityManager) {
    await em.update(RefreshToken, { familyId, revokedAt: IsNull() }, { revokedAt: new Date() });
  }
}
