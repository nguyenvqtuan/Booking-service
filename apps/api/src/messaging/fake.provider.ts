import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import type { MessageChannel } from '@booking/shared';
import {
  type ReminderMessage,
  SendOutcome,
  type SmsProvider,
  type SendResult,
} from './message-provider.js';

/**
 * Development/test provider: logs instead of sending. Tests can script outcomes per phone
 * number with `respondTo` and inspect `sent`.
 */
export class FakeProvider implements SmsProvider {
  readonly name = 'fake';
  readonly sent: ReminderMessage[] = [];
  readonly texts: { to: string; content: string }[] = [];
  private readonly scripted = new Map<string, SendOutcome[]>();
  private readonly logger: Logger;

  constructor(readonly channel: MessageChannel) {
    this.logger = new Logger(`FakeProvider:${channel}`);
  }

  /** Next sends to `phone` return these outcomes in order (then Success). */
  respondTo(phone: string, ...outcomes: SendOutcome[]): void {
    this.scripted.set(phone, outcomes);
  }

  reset(): void {
    this.sent.length = 0;
    this.texts.length = 0;
    this.scripted.clear();
  }

  async sendText(to: string, content: string): Promise<SendResult> {
    const outcome = this.scripted.get(to)?.shift() ?? SendOutcome.Success;
    this.logger.log(`${outcome} -> ${to}: ${content}`);
    if (outcome !== SendOutcome.Success) return { outcome, error: `fake ${outcome}` };
    this.texts.push({ to, content });
    return { outcome, providerMsgId: `fake-${randomUUID()}` };
  }

  async send(message: ReminderMessage): Promise<SendResult> {
    const outcome = this.scripted.get(message.to)?.shift() ?? SendOutcome.Success;
    this.logger.log(`${outcome} -> ${message.to} ${JSON.stringify(message.params)}`);
    if (outcome !== SendOutcome.Success) return { outcome, error: `fake ${outcome}` };
    this.sent.push(message);
    return { outcome, providerMsgId: `fake-${randomUUID()}` };
  }
}
