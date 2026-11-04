import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource, EntityManager } from 'typeorm';
import { ErrorCode } from '@booking/shared';
import { generateOpaqueToken, hashToken } from '../auth/token-hash.js';
import { AppException } from '../common/app.exception.js';
import { type Appointment, AppointmentActionToken } from '../database/entities/index.js';

const invalidToken = () =>
  new AppException(
    HttpStatus.GONE,
    ErrorCode.ActionTokenInvalid,
    'This link is invalid, expired or already used',
  );

@Injectable()
export class ActionTokenService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /** Creates a token valid until the appointment starts; returns the raw value for the link. */
  async issue(appointment: Appointment): Promise<string> {
    const token = generateOpaqueToken();
    await this.dataSource.getRepository(AppointmentActionToken).insert({
      salonId: appointment.salonId,
      appointmentId: appointment.id,
      tokenHash: hashToken(token),
      expiresAt: appointment.startAt,
    });
    return token;
  }

  /** Read-only lookup for the landing page; does not consume the token. */
  async peek(rawToken: string, now: Date = new Date()): Promise<AppointmentActionToken> {
    const row = await this.dataSource
      .getRepository(AppointmentActionToken)
      .findOneBy({ tokenHash: hashToken(rawToken) });
    return this.assertUsable(row, now);
  }

  /**
   * Runs `action` and consumes the token in one transaction. The row lock makes concurrent uses
   * of a link wait, then fail; if the action fails the rollback leaves the token usable.
   */
  async consume<T>(
    rawToken: string,
    action: (em: EntityManager, token: AppointmentActionToken) => Promise<T>,
    now: Date = new Date(),
  ): Promise<T> {
    return this.dataSource.transaction(async (em) => {
      const row = await em
        .getRepository(AppointmentActionToken)
        .createQueryBuilder('t')
        .setLock('pessimistic_write')
        .where('t.token_hash = :hash', { hash: hashToken(rawToken) })
        .getOne();
      const token = this.assertUsable(row, now);
      const result = await action(em, token);
      await em.update(AppointmentActionToken, { id: token.id }, { usedAt: now });
      return result;
    });
  }

  private assertUsable(row: AppointmentActionToken | null, now: Date): AppointmentActionToken {
    if (!row || row.usedAt || row.expiresAt.getTime() <= now.getTime()) throw invalidToken();
    return row;
  }
}
