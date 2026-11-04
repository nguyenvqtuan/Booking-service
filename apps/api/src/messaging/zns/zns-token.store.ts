import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { ProviderToken } from '../../database/entities/index.js';

export const ZNS_TOKEN_PROVIDER = 'zalo_oa';
/** Refresh a bit before the real expiry. */
const EXPIRY_MARGIN_MS = 5 * 60_000;

interface ZaloTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: string | number;
  error?: number;
  error_name?: string;
  error_description?: string;
}

/**
 * Zalo OA access token holder. Access tokens live ~25h; the refresh token is single-use, so a
 * refresh runs under a row lock and re-checks whether another worker already refreshed.
 */
@Injectable()
export class ZnsTokenStore {
  private readonly logger = new Logger(ZnsTokenStore.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  async getAccessToken(now: Date = new Date()): Promise<string> {
    const row = await this.dataSource
      .getRepository(ProviderToken)
      .findOneBy({ provider: ZNS_TOKEN_PROVIDER });
    if (row && row.expiresAt.getTime() - EXPIRY_MARGIN_MS > now.getTime()) return row.accessToken;
    return this.refresh(row?.accessToken);
  }

  /**
   * Refreshes the token. `staleAccessToken` is the token that was rejected/expired: if the stored
   * token differs, another process refreshed meanwhile and that token is returned instead.
   */
  async refresh(staleAccessToken?: string): Promise<string> {
    return this.dataSource.transaction(async (em) => {
      let row = await em
        .getRepository(ProviderToken)
        .createQueryBuilder('t')
        .setLock('pessimistic_write')
        .where('t.provider = :p', { p: ZNS_TOKEN_PROVIDER })
        .getOne();

      if (
        row &&
        staleAccessToken !== undefined &&
        row.accessToken !== staleAccessToken &&
        row.expiresAt > new Date()
      ) {
        return row.accessToken;
      }

      const refreshToken = row?.refreshToken ?? this.config.get<string>('ZNS_REFRESH_TOKEN');
      if (!refreshToken)
        throw new Error('ZNS is not configured: no refresh token (set ZNS_REFRESH_TOKEN)');

      const res = await fetch(
        `${this.config.getOrThrow<string>('ZNS_OAUTH_URL')}/v4/oa/access_token`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            secret_key: this.config.getOrThrow<string>('ZNS_APP_SECRET'),
          },
          body: new URLSearchParams({
            refresh_token: refreshToken,
            app_id: this.config.getOrThrow<string>('ZNS_APP_ID'),
            grant_type: 'refresh_token',
          }),
          signal: AbortSignal.timeout(10_000),
        },
      );
      const body = (await res.json()) as ZaloTokenResponse;
      if (!res.ok || !body.access_token || !body.refresh_token) {
        throw new Error(
          `ZNS token refresh failed: ${res.status} ${body.error ?? ''} ${body.error_description ?? body.error_name ?? ''}`.trim(),
        );
      }

      const expiresAt = new Date(Date.now() + Number(body.expires_in ?? 90_000) * 1000);
      row = em.create(ProviderToken, {
        provider: ZNS_TOKEN_PROVIDER,
        accessToken: body.access_token,
        refreshToken: body.refresh_token,
        expiresAt,
      });
      await em.save(row);
      this.logger.log(`Zalo OA access token refreshed, valid until ${expiresAt.toISOString()}`);
      return row.accessToken;
    });
  }
}
