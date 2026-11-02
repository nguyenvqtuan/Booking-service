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
  ): Promise<IssuedRefreshToken> {
    const token = generateOpaqueToken();
    const ttlDays = this.config.getOrThrow<number>('REFRESH_TOKEN_TTL_DAYS');
    const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);
    await em.insert(RefreshToken, { userId, familyId, tokenHash: hashToken(token), expiresAt });
    return { token, expiresAt };
  }

  /**
   * Rotates a refresh token: the presented token is revoked and a new one in the same family
   * is issued. Presenting an already-revoked token is treated as theft and revokes the family.
   * The conditional UPDATE makes concurrent rotations of the same token safe (only one wins).
   */
  async rotate(rawToken: string): Promise<{ userId: string } & IssuedRefreshToken> {
    const result = await this.dataSource.transaction(async (em) => {
      const existing = await em.findOne(RefreshToken, {
        where: { tokenHash: hashToken(rawToken) },
      });
      if (!existing) return { ok: false as const };

      if (existing.revokedAt) {
        await this.revokeFamily(existing.familyId, em);
        return { ok: false as const };
      }
      if (existing.expiresAt.getTime() <= Date.now()) return { ok: false as const };

      const { affected } = await em.update(
        RefreshToken,
        { id: existing.id, revokedAt: IsNull() },
        { revokedAt: new Date() },
      );
      if (!affected) return { ok: false as const };

      const issued = await this.issue(existing.userId, existing.familyId, em);
      return { ok: true as const, userId: existing.userId, ...issued };
    });
    if (!result.ok) throw invalidRefreshToken();
    return { userId: result.userId, token: result.token, expiresAt: result.expiresAt };
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
