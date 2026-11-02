import { SendOutcome } from '../message-provider.js';

/**
 * Zalo ZNS error codes -> outcome group (BS-29).
 * NOTE: verify this table against the current ZNS documentation when the OA / provider is
 * finalized (BS-53); unknown codes are treated as permanent so they surface in message_logs
 * instead of being retried blindly.
 */
export const ZNS_ERROR_OUTCOMES: Record<number, SendOutcome> = {
  // Recipient cannot receive ZNS -> fall back to SMS (BS-31, BS-65).
  [-108]: SendOutcome.RecipientUnreachable, // phone number invalid for Zalo
  [-118]: SendOutcome.RecipientUnreachable, // Zalo account does not exist / inactive
  [-119]: SendOutcome.RecipientUnreachable, // account cannot receive ZNS
  [-139]: SendOutcome.RecipientUnreachable, // user refused ZNS from this OA
  // Temporary -> retry with backoff (BS-32).
  [-32]: SendOutcome.Transient, // rate limit exceeded
  [-133]: SendOutcome.Transient, // outside allowed sending hours
  [-144]: SendOutcome.Transient, // daily quota of OA reached
  // Configuration problems -> permanent, needs a human (template, balance, app permissions).
  [-112]: SendOutcome.Permanent, // template data invalid
  [-114]: SendOutcome.Permanent, // template not approved / disabled
  [-124]: SendOutcome.Permanent, // access token invalid (handled by refresh first)
  [-131]: SendOutcome.Permanent, // insufficient ZNS balance
};

export const ZNS_TOKEN_INVALID = -124;

export function znsOutcome(code: number): SendOutcome {
  return ZNS_ERROR_OUTCOMES[code] ?? SendOutcome.Permanent;
}
