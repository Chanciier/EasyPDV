import { createParamDecorator, type ExecutionContext } from "@nestjs/common";

export interface AuthenticatedUser {
  userId: string;
  role: string;
}

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
  const request = ctx.switchToHttp().getRequest();
  return request.user;
});
