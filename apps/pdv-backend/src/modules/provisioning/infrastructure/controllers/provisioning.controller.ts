import { Body, Controller, Get, Post } from "@nestjs/common";
import { activateTerminalSchema, type ActivateTerminalInput } from "@easypdv/shared-validation";
import { ZodValidationPipe } from "../../../../common/pipes/zod-validation.pipe.js";
import { GetProvisioningStatusUseCase } from "../../application/use-cases/get-provisioning-status.use-case.js";
import { ActivateTerminalUseCase } from "../../application/use-cases/activate-terminal.use-case.js";
import { GetTerminalBusyStatusUseCase } from "../../../sales/application/use-cases/get-terminal-busy-status.use-case.js";

/**
 * Sem @UseGuards(JwtAuthGuard) de propósito: chamado pelo Electron (main
 * process) no primeiro boot, antes de qualquer login de operador acontecer —
 * e o server só escuta em 127.0.0.1 (ver main.ts), então a fronteira de
 * segurança real já é "quem tem acesso a esta máquina", não um token.
 */
@Controller("provisioning")
export class ProvisioningController {
  constructor(
    private readonly getProvisioningStatusUseCase: GetProvisioningStatusUseCase,
    private readonly activateTerminalUseCase: ActivateTerminalUseCase,
    private readonly getTerminalBusyStatusUseCase: GetTerminalBusyStatusUseCase,
  ) {}

  @Get("status")
  status() {
    return this.getProvisioningStatusUseCase.execute();
  }

  @Post("activate")
  activate(@Body(new ZodValidationPipe(activateTerminalSchema)) body: ActivateTerminalInput) {
    return this.activateTerminalUseCase.execute(body);
  }

  /** Consultado pelo Electron antes de aplicar uma atualização baixada — nunca no meio de uma venda. */
  @Get("busy-status")
  busyStatus() {
    return this.getTerminalBusyStatusUseCase.execute();
  }
}
