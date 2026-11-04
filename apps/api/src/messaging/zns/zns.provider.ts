import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MessageChannel } from '@booking/shared';
import {
  type MessageProvider,
  type ReminderMessage,
  SendOutcome,
  type SendResult,
} from '../message-provider.js';
import { ZNS_TOKEN_INVALID, znsOutcome } from './zns-errors.js';
import { ZnsTokenStore } from './zns-token.store.js';

interface ZnsResponse {
  error: number;
  message?: string;
  data?: { msg_id?: string };
}

/** Sends approved ZNS templates through the Zalo Business API (BS-29). */
@Injectable()
export class ZnsProvider implements MessageProvider {
  readonly channel = MessageChannel.Zns;
  readonly name = 'zalo';
  private readonly logger = new Logger(ZnsProvider.name);

  constructor(
    private readonly tokens: ZnsTokenStore,
    private readonly config: ConfigService,
  ) {}

  async send(message: ReminderMessage): Promise<SendResult> {
    let token: string;
    try {
      token = await this.tokens.getAccessToken();
    } catch (err) {
      return { outcome: SendOutcome.Transient, error: (err as Error).message };
    }

    let result = await this.call(token, message);
    if (result.code === ZNS_TOKEN_INVALID) {
      // The token was revoked/expired early: refresh once and retry.
      try {
        token = await this.tokens.refresh(token);
      } catch (err) {
        return { outcome: SendOutcome.Transient, error: (err as Error).message };
      }
      result = await this.call(token, message);
    }
    return result.result;
  }

  private async call(
    token: string,
    message: ReminderMessage,
  ): Promise<{ code?: number; result: SendResult }> {
    const templateId = this.templateFor(message.locale);
    let res: Response;
    try {
      res = await fetch(`${this.config.getOrThrow<string>('ZNS_API_URL')}/message/template`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', access_token: token },
        body: JSON.stringify({
          // ZNS expects the number without "+": 84901234567.
          phone: message.to.replace(/^\+/, ''),
          template_id: templateId,
          template_data: {
            customer_name: message.params.customerName,
            salon_name: message.params.salonName,
            service_name: message.params.serviceName,
            time: message.params.time,
            date: message.params.date,
          },
        }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch (err) {
      return {
        result: {
          outcome: SendOutcome.Transient,
          error: `ZNS request failed: ${(err as Error).message}`,
        },
      };
    }

    if (res.status >= 500 || res.status === 429) {
      return { result: { outcome: SendOutcome.Transient, error: `ZNS HTTP ${res.status}` } };
    }
    let body: ZnsResponse;
    try {
      body = (await res.json()) as ZnsResponse;
    } catch {
      return {
        result: { outcome: SendOutcome.Transient, error: `ZNS HTTP ${res.status}: invalid JSON` },
      };
    }
    if (body.error === 0) {
      return { result: { outcome: SendOutcome.Success, providerMsgId: body.data?.msg_id } };
    }
    const outcome = znsOutcome(body.error);
    if (outcome === SendOutcome.Permanent) {
      this.logger.warn(`ZNS error ${body.error}: ${body.message ?? ''}`);
    }
    return {
      code: body.error,
      result: { outcome, error: `ZNS ${body.error}: ${body.message ?? ''}`.trim() },
    };
  }

  /** Template per customer language; English falls back to Vietnamese until approved. */
  private templateFor(locale: ReminderMessage['locale']): string {
    const vi = this.config.getOrThrow<string>('ZNS_TEMPLATE_ID_VI');
    return locale === 'en' ? (this.config.get<string>('ZNS_TEMPLATE_ID_EN') ?? vi) : vi;
  }
}
