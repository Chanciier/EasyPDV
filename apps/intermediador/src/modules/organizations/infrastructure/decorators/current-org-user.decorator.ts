import { createParamDecorator, type ExecutionContext } from "@nestjs/common";

export interface AuthenticatedOrgUser {
  orgUserId: string;
  organizationId: string;
  role: string;
}

export const CurrentOrgUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthenticatedOrgUser => {
  const request = ctx.switchToHttp().getRequest();
  return request.user;
});
