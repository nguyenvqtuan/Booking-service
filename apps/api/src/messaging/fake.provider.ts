import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import type { MessageChannel } from '@booking/shared';
import {
  type MessageProvider,
  type ReminderMessage,
  SendOutcome,
  type SendResult,
} from './message-provider.js';

/**
 * Development/test provider: logs instead of sending. Tests can script outcomes per phone
 * number with `respondTo` and inspect `sent`.
 */
export class FakeProvider implements MessageProvider {
  readonly name = 'fake';
  readonly sent: ReminderMessage[] = [];
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
    this.scripted.clear();
  }

  async send(message: ReminderMessage): Promise<SendResult> {
    const outcome = this.scripted.get(message.to)?.shift() ?? SendOutcome.Success;
    this.logger.log(`${outcome} -> ${message.to} ${JSON.stringify(message.params)}`);
    if (outcome !== SendOutcome.Success) return { outcome, error: `fake ${outcome}` };
    this.sent.push(message);
    return { outcome, providerMsgId: `fake-${randomUUID()}` };
  }
}
