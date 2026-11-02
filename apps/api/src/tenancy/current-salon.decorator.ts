import { createParamDecorator, type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { AccessTokenPayload } from '@booking/shared';
import { TENANT_SCOPED_KEY } from './tenancy.constants.js';

/** Marks the decorated handler as tenant-scoped (checked by the route-coverage test). */
const markTenantScoped: ParameterDecorator = (target, propertyKey) => {
  if (propertyKey !== undefined)
    Reflect.defineMetadata(TENANT_SCOPED_KEY, true, target, propertyKey);
};

/**
 * Injects the salon id of the authenticated user, taken from the verified access token.
 * Every query in a tenant-scoped handler must filter by this id.
 */
export const CurrentSalon = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const user = ctx.switchToHttp().getRequest<{ user?: AccessTokenPayload }>().user;
    if (!user?.salonId) throw new UnauthorizedException('Missing salon context');
    return user.salonId;
  },
  [markTenantScoped],
);
