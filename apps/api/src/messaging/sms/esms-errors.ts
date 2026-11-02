import { SendOutcome } from '../message-provider.js';

/**
 * eSMS CodeResult -> outcome group (BS-30).
 * NOTE: verify against the eSMS documentation once the provider is finalized (BS-54);
 * unknown codes are permanent so they show up in message_logs instead of being retried.
 */
export const ESMS_SUCCESS = '100';

export const ESMS_OUTCOMES: Record<string, SendOutcome> = {
  '99': SendOutcome.Transient, // unknown error on provider side
  '101': SendOutcome.Permanent, // invalid ApiKey/SecretKey
  '102': SendOutcome.Permanent, // account locked
  '103': SendOutcome.Permanent, // insufficient balance
  '104': SendOutcome.Permanent, // brandname not registered / invalid
  '118': SendOutcome.Permanent, // SMS type invalid
  '119': SendOutcome.Permanent, // content does not match an approved template
  '124': SendOutcome.Transient, // duplicate RequestId while processing
  '146': SendOutcome.Permanent, // invalid phone number
};

export function esmsOutcome(code: string): SendOutcome {
  return ESMS_OUTCOMES[code] ?? SendOutcome.Permanent;
}
