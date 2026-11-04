import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import {
  AppointmentStatus,
  localDayRangeUtc,
  MessageLogStatus,
  type ReportDto,
  type ReportMonth,
  type ReportTotals,
} from '@booking/shared';
import { Salon } from '../database/entities/index.js';

interface AppointmentRow {
  month: string;
  appointments: number;
  completed: number;
  no_show: number;
  cancelled: number;
}

interface MessageRow {
  month: string;
  messages: number;
  succeeded: number;
}

const rate = (part: number, whole: number) => (whole > 0 ? part / whole : null);

function totalsOf(a: Omit<AppointmentRow, 'month'>, m: Omit<MessageRow, 'month'>): ReportTotals {
  return {
    appointments: a.appointments,
    completed: a.completed,
    noShow: a.no_show,
    cancelled: a.cancelled,
    noShowRate: rate(a.no_show, a.completed + a.no_show),
    messages: m.messages,
    messagesSucceeded: m.succeeded,
    messageSuccessRate: rate(m.succeeded, m.messages),
  };
}

const NO_APPOINTMENTS = { appointments: 0, completed: 0, no_show: 0, cancelled: 0 };
const NO_MESSAGES = { messages: 0, succeeded: 0 };

/** Salon statistics for an inclusive range of salon-local dates, grouped by local month (BS-40). */
@Injectable()
export class ReportsService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async summary(salonId: string, query: { from: string; to: string }): Promise<ReportDto> {
    const { timezone } = await this.dataSource
      .getRepository(Salon)
      .findOneByOrFail({ id: salonId });
    const from = localDayRangeUtc(query.from, timezone).from;
    const to = localDayRangeUtc(query.to, timezone).to;

    const appointments: AppointmentRow[] = await this.dataSource.query(
      `SELECT to_char(start_at AT TIME ZONE $1, 'YYYY-MM') AS month,
              count(*)::int AS appointments,
              count(*) FILTER (WHERE status = $5)::int AS completed,
              count(*) FILTER (WHERE status = $6)::int AS no_show,
              count(*) FILTER (WHERE status = $7)::int AS cancelled
       FROM appointments
       WHERE salon_id = $2 AND start_at >= $3 AND start_at < $4
       GROUP BY 1`,
      [
        timezone,
        salonId,
        from,
        to,
        AppointmentStatus.Completed,
        AppointmentStatus.NoShow,
        AppointmentStatus.Cancelled,
      ],
    );
    const messages: MessageRow[] = await this.dataSource.query(
      `SELECT to_char(created_at AT TIME ZONE $1, 'YYYY-MM') AS month,
              count(*)::int AS messages,
              count(*) FILTER (WHERE status = $5)::int AS succeeded
       FROM message_logs
       WHERE salon_id = $2 AND created_at >= $3 AND created_at < $4
       GROUP BY 1`,
      [timezone, salonId, from, to, MessageLogStatus.Success],
    );

    const monthKeys = [...new Set([...appointments, ...messages].map((r) => r.month))].sort();
    const months: ReportMonth[] = monthKeys.map((month) => ({
      month,
      ...totalsOf(
        appointments.find((r) => r.month === month) ?? NO_APPOINTMENTS,
        messages.find((r) => r.month === month) ?? NO_MESSAGES,
      ),
    }));

    const sum = <K extends string>(rows: Record<K, unknown>[], key: K) =>
      rows.reduce((total, r) => total + (r[key] as number), 0);
    return {
      months,
      totals: totalsOf(
        {
          appointments: sum(appointments, 'appointments'),
          completed: sum(appointments, 'completed'),
          no_show: sum(appointments, 'no_show'),
          cancelled: sum(appointments, 'cancelled'),
        },
        { messages: sum(messages, 'messages'), succeeded: sum(messages, 'succeeded') },
      ),
    };
  }
}
