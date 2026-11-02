import { Injectable, Logger } from '@nestjs/common';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

/**
 * Outgoing email. MVP implementation only logs the message; swap the provider
 * for a real transport (SMTP/SES) when one is chosen.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  async send(message: MailMessage): Promise<void> {
    this.logger.log(`Email to ${message.to}: ${message.subject}\n${message.text}`);
  }
}
