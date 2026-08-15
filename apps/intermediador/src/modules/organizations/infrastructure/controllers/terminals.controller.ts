import { Body, Controller, Post } from "@nestjs/common";
import { activateTerminalSchema, type ActivateTerminalInput } from "@easypdv/shared-validation";
import { ZodValidationPipe } from "../../../../common/pipes/zod-validation.pipe.js";
import { ActivateTerminalUseCase } from "../../application/use-cases/activate-terminal.use-case.js";

/** Chamado pelo Electron (main process) no primeiro boot sem terminal ativado. Ver docs/ELECTRON.md. */
@Controller("terminals")
export class TerminalsController {
  constructor(private readonly activateTerminalUseCase: ActivateTerminalUseCase) {}

  @Post("activate")
  activate(@Body(new ZodValidationPipe(activateTerminalSchema)) body: ActivateTerminalInput) {
    return this.activateTerminalUseCase.execute(body);
  }
}
