import { Injectable } from '@nestjs/common';
import { type EntityManager, In } from 'typeorm';
import {
  isActiveStatus,
  type ReminderJobDto,
  ReminderJobStatus,
  reminderSendAt,
} from '@booking/shared';
import { type Appointment, ReminderJob } from '../database/entities/index.js';
import { ReminderSettingsService } from './reminder-settings.service.js';

/** Jobs that have not been delivered yet and may still be changed or cancelled. */
const OPEN_STATUSES = [
  ReminderJobStatus.Pending,
  ReminderJobStatus.Queued,
  ReminderJobStatus.Retrying,
];

/**
 * Keeps an appointment's reminder jobs in line with the appointment (BS-26, BS-68).
 * Must run in the same transaction as the appointment change.
 */
@Injectable()
export class ReminderScheduler {
  constructor(private readonly settings: ReminderSettingsService) {}

  async sync(em: EntityManager, appointment: Appointment, now: Date = new Date()): Promise<void> {
    const existing = await em.findBy(ReminderJob, { appointmentId: appointment.id });

    // Cancelled / completed / no-show: no more reminders.
    if (!isActiveStatus(appointment.status)) {
      await this.cancel(
        em,
        existing.filter((j) => OPEN_STATUSES.includes(j.status)),
      );
      return;
    }

    const { offsets } = await this.settings.get(appointment.salonId, em);
    const wanted = new Map(
      offsets
        .map((offset) => [offset, reminderSendAt(appointment.startAt, offset)] as const)
        .filter(([, sendAt]) => sendAt.getTime() > now.getTime()), // never schedule in the past
    );

    for (const job of existing) {
      const sendAt = wanted.get(job.offsetMinutes);
      if (!sendAt) {
        if (OPEN_STATUSES.includes(job.status)) await this.cancel(em, [job]);
        continue;
      }
      wanted.delete(job.offsetMinutes);
      const unchanged = job.sendAt.getTime() === sendAt.getTime();
      // A reminder already sent for the same time stays sent; after a reschedule it is due again.
      if (unchanged && job.status !== ReminderJobStatus.Cancelled) continue;
      await em.update(
        ReminderJob,
        { id: job.id },
        {
          sendAt,
          status: ReminderJobStatus.Pending,
          attemptCount: 0,
          lastError: null,
          sentAt: null,
        },
      );
    }

    if (wanted.size) {
      await em.insert(
        ReminderJob,
        [...wanted].map(([offsetMinutes, sendAt]) => ({
          salonId: appointment.salonId,
          appointmentId: appointment.id,
          offsetMinutes,
          sendAt,
          status: ReminderJobStatus.Pending,
        })),
      );
    }
  }

  async listFor(em: EntityManager, appointmentId: string): Promise<ReminderJobDto[]> {
    const jobs = await em.find(ReminderJob, {
      where: { appointmentId },
      order: { sendAt: 'ASC' },
    });
    return jobs.map((j) => ({
      id: j.id,
      offsetMinutes: j.offsetMinutes,
      sendAt: j.sendAt.toISOString(),
      channel: j.channel,
      status: j.status,
      attemptCount: j.attemptCount,
    }));
  }

  private async cancel(em: EntityManager, jobs: ReminderJob[]): Promise<void> {
    if (!jobs.length) return;
    await em.update(
      ReminderJob,
      { id: In(jobs.map((j) => j.id)), status: In(OPEN_STATUSES) },
      { status: ReminderJobStatus.Cancelled },
    );
  }
}
