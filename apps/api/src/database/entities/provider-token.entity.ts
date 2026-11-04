import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * OAuth tokens of messaging providers (platform-level, e.g. the Zalo OA used for ZNS).
 * The refresh token is single-use, so updates happen under a row lock (BS-29).
 */
@Entity('provider_tokens')
export class ProviderToken {
  @PrimaryColumn({ type: 'varchar', length: 30 })
  provider: string;

  @Column({ name: 'access_token', type: 'text' })
  accessToken: string;

  @Column({ name: 'refresh_token', type: 'text' })
  refreshToken: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
