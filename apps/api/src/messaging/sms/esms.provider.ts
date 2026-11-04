import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MessageChannel } from '@booking/shared';
import {
  type MessageProvider,
  type ReminderMessage,
  SendOutcome,
  type SendResult,
} from '../message-provider.js';
import { ESMS_SUCCESS, esmsOutcome } from './esms-errors.js';
import { DEFAULT_SMS_TEMPLATES, renderSms } from './sms-template.js';

interface EsmsResponse {
  CodeResult?: string;
  SMSID?: string;
  ErrorMessage?: string;
}

/** SMS brandname through eSMS (fallback channel + OTP sender, BS-30/BS-38). */
@Injectable()
export class EsmsProvider implements MessageProvider {
  readonly channel = MessageChannel.Sms;
  readonly name = 'esms';

  constructor(private readonly config: ConfigService) {}

  async send(message: ReminderMessage): Promise<SendResult> {
    const template =
      this.config.get<string>(message.locale === 'en' ? 'SMS_TEMPLATE_EN' : 'SMS_TEMPLATE_VI') ??
      DEFAULT_SMS_TEMPLATES[message.locale];
    return this.sendText(message.to, renderSms(template, message));
  }

  /** Sends a raw text (already approved template content). */
  async sendText(toE164: string, content: string): Promise<SendResult> {
    let res: Response;
    try {
      res = await fetch(
        `${this.config.getOrThrow<string>('SMS_API_URL')}/SendMultipleMessage_V4_post_json/`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ApiKey: this.config.getOrThrow<string>('SMS_API_KEY'),
            SecretKey: this.config.getOrThrow<string>('SMS_SECRET_KEY'),
            Brandname: this.config.getOrThrow<string>('SMS_BRANDNAME'),
            // eSMS expects the national format: 0901234567.
            Phone: toE164.replace(/^\+84/, '0'),
            Content: content,
            SmsType: '2', // brandname customer-care
            IsUnicode: '0',
            Sandbox: this.config.get<boolean>('SMS_SANDBOX') ? '1' : '0',
          }),
          signal: AbortSignal.timeout(15_000),
        },
      );
    } catch (err) {
      return {
        outcome: SendOutcome.Transient,
        error: `SMS request failed: ${(err as Error).message}`,
      };
    }
    if (res.status >= 500 || res.status === 429) {
      return { outcome: SendOutcome.Transient, error: `SMS HTTP ${res.status}` };
    }
    let body: EsmsResponse;
    try {
      body = (await res.json()) as EsmsResponse;
    } catch {
      return { outcome: SendOutcome.Transient, error: `SMS HTTP ${res.status}: invalid JSON` };
    }
    if (body.CodeResult === ESMS_SUCCESS) {
      return { outcome: SendOutcome.Success, providerMsgId: body.SMSID };
    }
    const code = body.CodeResult ?? `HTTP${res.status}`;
    return { outcome: esmsOutcome(code), error: `SMS ${code}: ${body.ErrorMessage ?? ''}`.trim() };
  }
}
