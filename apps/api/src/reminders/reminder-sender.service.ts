import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource, EntityManager } from 'typeorm';
import { isActiveStatus, MessageLogStatus, ReminderJobStatus, utcToLocal } from '@booking/shared';
import { ActionTokenService } from '../appointment-actions/action-token.service.js';
import {
  Appointment,
  Customer,
  MessageLog,
  ReminderJob,
  Salon,
  Service,
} from '../database/entities/index.js';
import {
  type MessageProvider,
  type ReminderMessage,
  SendOutcome,
  type SendResult,
  SMS_PROVIDER,
  ZNS_PROVIDER,
} from '../messaging/message-provider.js';
import { ReminderSettingsService } from './reminder-settings.service.js';

/** 'retry' = transient failure, the queue must try again later (BS-32). */
export type ProcessResult = 'sent' | 'skipped' | 'cancelled' | 'failed' | 'retry';

export interface ProcessOptions {
  now?: Date;
  /** False while the queue still has attempts left; transient failures are then retried. */
  isLastAttempt?: boolean;
}

const LOG_STATUS: Record<SendOutcome, MessageLogStatus> = {
  [SendOutcome.Success]: MessageLogStatus.Success,
  [SendOutcome.RecipientUnreachable]: MessageLogStatus.RecipientUnreachable,
  [SendOutcome.Transient]: MessageLogStatus.Transient,
  [SendOutcome.Permanent]: MessageLogStatus.Permanent,
};

/** Sends one reminder job (called by the queue worker). */
@Injectable()
export class ReminderSender {
  private readonly logger = new Logger(ReminderSender.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(ZNS_PROVIDER) private readonly zns: MessageProvider,
    @Inject(SMS_PROVIDER) private readonly sms: MessageProvider,
    private readonly settings: ReminderSettingsService,
    private readonly actionTokens: ActionTokenService,
    private readonly config: ConfigService,
  ) {}

  async process(reminderJobId: string, options: ProcessOptions = {}): Promise<ProcessResult> {
    const { now = new Date(), isLastAttempt = true } = options;
    const job = await this.claim(reminderJobId);
    // Not claimable: already sent/cancelled, or another worker owns it (BS-33).
    if (!job) return 'skipped';

    const context = await this.loadContext(job);
    if (
      !context ||
      !isActiveStatus(context.appointment.status) ||
      context.appointment.startAt <= now
    ) {
      await this.finish(job.id, ReminderJobStatus.Cancelled, 'Appointment no longer active');
      return 'cancelled';
    }

    const message = this.buildMessage(context, await this.actionUrl(context.appointment));
    const { result, provider } = await this.deliver(job, message);

    if (result.outcome === SendOutcome.Success) {
      await this.recordSuccess(job, provider, message.to, result);
      return 'sent';
    }
    const error = result.error ?? result.outcome;
    // Only temporary errors are retried; permanent ones (bad number, config) fail right away.
    if (result.outcome === SendOutcome.Transient && !isLastAttempt) {
      await this.finish(job.id, ReminderJobStatus.Retrying, error);
      return 'retry';
    }
    await this.finish(job.id, ReminderJobStatus.Failed, error);
    return 'failed';
  }

  /**
   * ZNS first; when the customer cannot receive ZNS and the salon enabled the fallback, SMS (BS-31).
   * Every attempt is logged; the job counts as delivered once, by whichever channel succeeded.
   */
  private async deliver(
    job: ReminderJob,
    message: ReminderMessage,
  ): Promise<{ result: SendResult; provider: MessageProvider }> {
    const zns = await this.safeSend(this.zns, message);
    if (zns.outcome === SendOutcome.Success) return { result: zns, provider: this.zns };
    await this.log(this.dataSource.manager, job, this.zns, message.to, zns);
    if (zns.outcome !== SendOutcome.RecipientUnreachable)
      return { result: zns, provider: this.zns };

    const { fallbackEnabled } = await this.settings.get(job.salonId);
    if (!fallbackEnabled) {
      const error = `${zns.error ?? 'ZNS unreachable'} (SMS fallback disabled)`;
      return { result: { ...zns, error }, provider: this.zns };
    }
    const sms = await this.safeSend(this.sms, message);
    if (sms.outcome !== SendOutcome.Success) {
      await this.log(this.dataSource.manager, job, this.sms, message.to, sms);
    }
    return { result: sms, provider: this.sms };
  }

  /** The success log and the move to "sent" commit together, and only from "sending" (BS-33). */
  private async recordSuccess(
    job: ReminderJob,
    provider: MessageProvider,
    to: string,
    result: SendResult,
  ): Promise<void> {
    await this.dataSource.transaction(async (em) => {
      await this.log(em, job, provider, to, result);
      await em.update(
        ReminderJob,
        { id: job.id, status: ReminderJobStatus.Sending },
        { status: ReminderJobStatus.Sent, lastError: null, sentAt: new Date() },
      );
    });
  }

  /** queued/retrying -> sending, atomically; returns null when someone else got it first. */
  private async claim(id: string): Promise<ReminderJob | null> {
    const [rows] = (await this.dataSource.query(
      `UPDATE reminder_jobs SET status = $1, attempt_count = attempt_count + 1, updated_at = now()
       WHERE id = $2 AND status IN ($3, $4)
       RETURNING id`,
      [ReminderJobStatus.Sending, id, ReminderJobStatus.Queued, ReminderJobStatus.Retrying],
    )) as [{ id: string }[], number];
    if (!rows.length) return null;
    return this.dataSource.getRepository(ReminderJob).findOneByOrFail({ id });
  }

  private async loadContext(job: ReminderJob) {
    const em = this.dataSource.manager;
    const appointment = await em.findOneBy(Appointment, {
      id: job.appointmentId,
      salonId: job.salonId,
    });
    if (!appointment) return null;
    const [customer, service, salon] = await Promise.all([
      em.findOneBy(Customer, { id: appointment.customerId, salonId: job.salonId }),
      em.findOneBy(Service, { id: appointment.serviceId, salonId: job.salonId }),
      em.findOneBy(Salon, { id: job.salonId }),
    ]);
    if (!customer || !service || !salon) return null;
    return { appointment, customer, service, salon };
  }

  private async actionUrl(appointment: Appointment): Promise<string> {
    const token = await this.actionTokens.issue(appointment);
    return `${this.config.getOrThrow<string>('APP_WEB_URL')}/appointment/${token}`;
  }

  private buildMessage(
    ctx: NonNullable<Awaited<ReturnType<ReminderSender['loadContext']>>>,
    actionUrl: string,
  ): ReminderMessage {
    const local = utcToLocal(ctx.appointment.startAt, ctx.salon.timezone);
    return {
      to: ctx.customer.phone,
      locale: ctx.customer.locale,
      params: {
        customerName: ctx.customer.name,
        salonName: ctx.salon.name,
        serviceName: ctx.service.name,
        time: local.time,
        date: local.date,
        actionUrl,
      },
    };
  }

  /** A provider that throws is treated as a transient failure. */
  private async safeSend(provider: MessageProvider, message: ReminderMessage): Promise<SendResult> {
    try {
      return await provider.send(message);
    } catch (err) {
      this.logger.warn(`${provider.name} threw: ${(err as Error).message}`);
      return { outcome: SendOutcome.Transient, error: (err as Error).message };
    }
  }

  private async log(
    em: EntityManager,
    job: ReminderJob,
    provider: MessageProvider,
    to: string,
    result: SendResult,
  ) {
    await em.insert(MessageLog, {
      salonId: job.salonId,
      reminderJobId: job.id,
      channel: provider.channel,
      provider: provider.name,
      toPhone: to,
      providerMsgId: result.providerMsgId ?? null,
      status: LOG_STATUS[result.outcome],
      error: result.error ?? null,
    });
  }

  private async finish(id: string, status: ReminderJobStatus, lastError: string | null) {
    await this.dataSource
      .getRepository(ReminderJob)
      .update({ id, status: ReminderJobStatus.Sending }, { status, lastError });
  }
}
