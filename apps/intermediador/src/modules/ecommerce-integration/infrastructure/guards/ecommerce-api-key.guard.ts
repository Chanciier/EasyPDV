import { createHash, timingSafeEqual } from "node:crypto";
import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InvalidEcommerceApiKeyError } from "../../domain/errors.js";

/**
 * Protege os endpoints chamados pelo backend do e-commerce (Sald-o-da-Reserva)
 * — fronteira de confiança separada de TerminalApiKeyGuard (que representa um
 * PDV físico). Chave estática única (X-Ecommerce-Api-Key), sem lookup em
 * banco: só existe um caller possível (o backend do site), então não há
 * necessidade do modelo multi-terminal usado pra loja física.
 *
 * organizationId nunca vem da requisição — vem de ECOMMERCE_ORGANIZATION_ID,
 * a mesma regra de "organização sempre resolvida do lado autenticado, nunca
 * do corpo" já seguida por TerminalApiKeyGuard/OrgJwtAuthGuard.
 */
@Injectable()
export class EcommerceApiKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const provided = request.headers["x-ecommerce-api-key"];
    if (!provided || typeof provided !== "string") {
      throw new InvalidEcommerceApiKeyError();
    }

    const expected = this.config.getOrThrow<string>("ECOMMERCE_API_KEY");
    if (!this.matchesConstantTime(provided, expected)) {
      throw new InvalidEcommerceApiKeyError();
    }

    return true;
  }

  // Compara hashes de tamanho fixo em vez das strings cruas — timingSafeEqual
  // exige buffers do mesmo tamanho, e strings de tamanho diferente vazariam
  // essa informação (ou lançariam) antes da comparação constante rodar.
  private matchesConstantTime(provided: string, expected: string): boolean {
    const a = createHash("sha256").update(provided).digest();
    const b = createHash("sha256").update(expected).digest();
    return timingSafeEqual(a, b);
  }
}
