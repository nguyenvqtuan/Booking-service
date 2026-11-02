import { createHash, randomBytes } from 'node:crypto';

/** 256-bit random token encoded as base64url (43 chars). */
export const generateOpaqueToken = (): string => randomBytes(32).toString('base64url');

/** Tokens are stored hashed so a database leak does not expose usable tokens. */
export const hashToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');
