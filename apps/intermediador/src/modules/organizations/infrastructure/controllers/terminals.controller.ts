import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";
import { activateTerminalSchema, type ActivateTerminalInput } from "@easypdv/shared-validation";
import { ZodValidationPipe } from "../../../../common/pipes/zod-validation.pipe.js";
import { ActivateTerminalUseCase } from "../../application/use-cases/activate-terminal.use-case.js";

/** Chamado pelo Electron (main process) no primeiro boot sem terminal ativado. Ver docs/ELECTRON.md. */
@Controller("terminals")
export class TerminalsController {
  constructor(private readonly activateTerminalUseCase: ActivateTerminalUseCase) {}

  /**
   * Achado M7 da auditoria de segurança (2026-09-14): sem rate limit, ao
   * contrário do resto do fluxo de login/ativação deste módulo. `ThrottlerGuard`
   * puro (sem subclasse) reaproveita a policy "default" já registrada em
   * `ThrottlerModule.forRoot` (organizations.module.ts, 5 tentativas/60s) e
   * o tracker padrão dele é por IP — não há terminal/e-mail resolvido ainda
   * neste ponto do fluxo (é esse endpoint que cria o terminal).
   */
  @Post("activate")
  @UseGuards(ThrottlerGuard)
  activate(@Body(new ZodValidationPipe(activateTerminalSchema)) body: ActivateTerminalInput) {
    return this.activateTerminalUseCase.execute(body);
  }
}
