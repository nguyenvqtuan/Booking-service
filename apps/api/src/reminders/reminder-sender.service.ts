import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { isActiveStatus, MessageLogStatus, ReminderJobStatus, utcToLocal } from '@booking/shared';
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

export type ProcessResult = 'sent' | 'skipped' | 'cancelled' | 'failed';

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
  ) {}

  async process(reminderJobId: string, now: Date = new Date()): Promise<ProcessResult> {
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

    const message = this.buildMessage(context);
    const result = await this.deliver(job, message);

    if (result.outcome === SendOutcome.Success) {
      await this.finish(job.id, ReminderJobStatus.Sent, null);
      return 'sent';
    }
    await this.finish(job.id, ReminderJobStatus.Failed, result.error ?? result.outcome);
    return 'failed';
  }

  /**
   * ZNS first; when the customer cannot receive ZNS and the salon enabled the fallback, SMS (BS-31).
   * Every attempt is logged; the job counts as delivered once, by whichever channel succeeded.
   */
  private async deliver(job: ReminderJob, message: ReminderMessage): Promise<SendResult> {
    const zns = await this.safeSend(this.zns, message);
    await this.log(job, this.zns, message.to, zns);
    if (zns.outcome !== SendOutcome.RecipientUnreachable) return zns;

    const { fallbackEnabled } = await this.settings.get(job.salonId);
    if (!fallbackEnabled) {
      return { ...zns, error: `${zns.error ?? 'ZNS unreachable'} (SMS fallback disabled)` };
    }
    const sms = await this.safeSend(this.sms, message);
    await this.log(job, this.sms, message.to, sms);
    return sms;
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

  private buildMessage(
    ctx: NonNullable<Awaited<ReturnType<ReminderSender['loadContext']>>>,
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

  private async log(job: ReminderJob, provider: MessageProvider, to: string, result: SendResult) {
    await this.dataSource.getRepository(MessageLog).insert({
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
      .update(
        { id, status: ReminderJobStatus.Sending },
        { status, lastError, ...(status === ReminderJobStatus.Sent && { sentAt: new Date() }) },
      );
  }
}
