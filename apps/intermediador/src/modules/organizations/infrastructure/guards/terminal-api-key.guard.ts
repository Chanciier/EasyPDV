import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { VerifyTerminalApiKeyUseCase } from "../../application/use-cases/verify-terminal-api-key.use-case.js";
import { InvalidTerminalApiKeyError } from "../../domain/errors.js";

/**
 * Protege endpoints chamados pelo PDV local (ex: POST /sync) — exige o header
 * X-Terminal-Api-Key emitido em POST /terminals/activate. Fecha o risco #6
 * documentado em Decisões e Riscos Abertos (auth PDV local ↔ Intermediador
 * inexistente). Não se aplica aos endpoints de visibilidade/retry de sync
 * (GET/POST /sync/jobs*) nem aos de Bling — esses seguem sem auth (fora do
 * escopo desta sprint, precisam de auth de admin/operador, não de terminal).
 */
@Injectable()
export class TerminalApiKeyGuard implements CanActivate {
  constructor(private readonly verifyTerminalApiKeyUseCase: VerifyTerminalApiKeyUseCase) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers["x-terminal-api-key"];
    if (!apiKey || typeof apiKey !== "string") {
      throw new InvalidTerminalApiKeyError();
    }
    request.terminal = await this.verifyTerminalApiKeyUseCase.execute(apiKey);
    return true;
  }
}
