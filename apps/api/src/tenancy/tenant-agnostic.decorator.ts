import { SetMetadata } from '@nestjs/common';
import { TENANT_AGNOSTIC_KEY } from './tenancy.constants.js';

/**
 * Explicitly declares that an authenticated handler does not read salon data
 * (e.g. GET /auth/me is scoped by user id). Use sparingly and say why.
 */
export const TenantAgnostic = (reason: string) => SetMetadata(TENANT_AGNOSTIC_KEY, reason);
