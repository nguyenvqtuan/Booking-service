import type { Locale, MessageChannel } from '@booking/shared';

/** Outcome groups every provider maps its responses to (BS-29, BS-30). */
export enum SendOutcome {
  Success = 'success',
  /** The recipient cannot receive on this channel (e.g. no Zalo account) -> try SMS (BS-31). */
  RecipientUnreachable = 'recipient_unreachable',
  /** Temporary failure (timeout, rate limit, 5xx) -> retry with backoff (BS-32). */
  Transient = 'transient',
  /** Will not succeed by retrying (bad number, template/config error). */
  Permanent = 'permanent',
}

export interface ReminderMessage {
  /** E.164 phone number. */
  to: string;
  locale: Locale;
  params: {
    customerName: string;
    salonName: string;
    serviceName: string;
    /** Salon-local "HH:mm". */
    time: string;
    /** Salon-local "YYYY-MM-DD". */
    date: string;
  };
}

export interface SendResult {
  outcome: SendOutcome;
  providerMsgId?: string;
  error?: string;
}

export interface MessageProvider {
  readonly channel: MessageChannel;
  /** Short provider name stored in message_logs.provider. */
  readonly name: string;
  send(message: ReminderMessage): Promise<SendResult>;
}

/** DI tokens for the provider of each channel. */
export const ZNS_PROVIDER = Symbol('ZNS_PROVIDER');
export const SMS_PROVIDER = Symbol('SMS_PROVIDER');
