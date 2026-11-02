import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AccessTokenPayload } from '@booking/shared';

export interface AuthenticatedRequest {
  user: AccessTokenPayload;
}

/** Injects the verified access-token payload of the current request. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AccessTokenPayload =>
    ctx.switchToHttp().getRequest<AuthenticatedRequest>().user,
);
