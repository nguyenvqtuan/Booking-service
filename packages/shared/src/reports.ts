import { z } from 'zod';

export const reportQuerySchema = z
  .object({ from: z.iso.date(), to: z.iso.date() })
  .refine((q) => q.from <= q.to, { message: '`from` must not be after `to`', path: ['to'] });
export type ReportQuery = z.input<typeof reportQuerySchema>;

export interface ReportTotals {
  appointments: number;
  completed: number;
  noShow: number;
  cancelled: number;
  /** noShow / (completed + noShow), 0..1; null when no appointment has finished yet. */
  noShowRate: number | null;
  /** Send attempts, one per message_logs row. */
  messages: number;
  messagesSucceeded: number;
  /** messagesSucceeded / messages, 0..1; null when nothing was sent. */
  messageSuccessRate: number | null;
}

export interface ReportMonth extends ReportTotals {
  /** Salon-local month, "YYYY-MM". */
  month: string;
}

export interface ReportDto {
  totals: ReportTotals;
  months: ReportMonth[];
}
