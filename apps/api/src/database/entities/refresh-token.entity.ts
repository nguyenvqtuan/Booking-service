import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

/**
 * Opaque refresh token (only its SHA-256 hash is stored). Tokens are rotated on every
 * refresh; all tokens issued from one login share a `familyId`, so reuse of a rotated
 * token revokes the whole family.
 */
@Entity('refresh_tokens')
@Unique('UQ_refresh_tokens_token_hash', ['tokenHash'])
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Implicit relation to users.id (no FK, BS-70). */
  @Index('IDX_refresh_tokens_user_id')
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'token_hash', type: 'char', length: 64 })
  tokenHash: string;

  @Index('IDX_refresh_tokens_family_id')
  @Column({ name: 'family_id', type: 'uuid' })
  familyId: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
