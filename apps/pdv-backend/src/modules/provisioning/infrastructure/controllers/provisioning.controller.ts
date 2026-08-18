import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { activateTerminalSchema, type ActivateTerminalInput } from "@easypdv/shared-validation";
import { ZodValidationPipe } from "../../../../common/pipes/zod-validation.pipe.js";
import { JwtAuthGuard } from "../../../identity/infrastructure/guards/jwt-auth.guard.js";
import { RolesGuard } from "../../../identity/infrastructure/guards/roles.guard.js";
import { Roles } from "../../../identity/infrastructure/decorators/roles.decorator.js";
import { GetProvisioningStatusUseCase } from "../../application/use-cases/get-provisioning-status.use-case.js";
import { ActivateTerminalUseCase } from "../../application/use-cases/activate-terminal.use-case.js";
import { GenerateActivationCodeUseCase } from "../../application/use-cases/generate-activation-code.use-case.js";
import { GetTerminalBusyStatusUseCase } from "../../../sales/application/use-cases/get-terminal-busy-status.use-case.js";

/**
 * Sem @UseGuards(JwtAuthGuard) de propósito na classe: /status, /activate e
 * /busy-status são chamados pelo Electron (main process) no primeiro boot,
 * antes de qualquer login de operador acontecer — e o server só escuta em
 * 127.0.0.1 (ver main.ts), então a fronteira de segurança real já é "quem tem
 * acesso a esta máquina", não um token. /activation-codes é diferente: só faz
 * sentido chamado por um admin JÁ logado (gerar token pra OUTRA instalação),
 * então ganha guard só nesse método (mesmo padrão de SyncController, que
 * mistura rotas guardadas/não guardadas no mesmo controller).
 */
@Controller("provisioning")
export class ProvisioningController {
  constructor(
    private readonly getProvisioningStatusUseCase: GetProvisioningStatusUseCase,
    private readonly activateTerminalUseCase: ActivateTerminalUseCase,
    private readonly generateActivationCodeUseCase: GenerateActivationCodeUseCase,
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

  /**
   * Sempre gera código pra um terminal NOVO na MESMA loja do terminal que
   * está pedindo — V1 não cria loja nova por aqui (isso continua sendo
   * bootstrap manual meu via curl, ver OrganizationsController no
   * Intermediador). Decisão do usuário: por ora só existe uma conta Bling
   * conectada, e lojas diferentes exigiriam contas Bling diferentes —
   * então "loja nova" não é um caso real ainda.
   */
  @Post("activation-codes")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("administrador")
  generateActivationCode() {
    return this.generateActivationCodeUseCase.execute();
  }

  /** Consultado pelo Electron antes de aplicar uma atualização baixada — nunca no meio de uma venda. */
  @Get("busy-status")
  busyStatus() {
    return this.getTerminalBusyStatusUseCase.execute();
  }
}
