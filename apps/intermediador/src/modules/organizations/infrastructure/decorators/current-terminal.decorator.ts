import { createParamDecorator, type ExecutionContext } from "@nestjs/common";

export interface AuthenticatedTerminal {
  terminalId: string;
  storeId: string;
  organizationId: string;
}

export const CurrentTerminal = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthenticatedTerminal => {
  const request = ctx.switchToHttp().getRequest();
  return request.terminal;
});
