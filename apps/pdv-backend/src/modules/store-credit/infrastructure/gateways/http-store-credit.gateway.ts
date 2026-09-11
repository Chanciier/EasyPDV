import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  STORE_IDENTITY_REPOSITORY,
  type StoreIdentityRepositoryPort,
} from "../../../provisioning/application/ports/store-identity-repository.port.js";
import { InsufficientStoreCreditError } from "../../domain/errors.js";
import type {
  GrantStoreCreditInput,
  RedeemStoreCreditInput,
  StoreCreditGatewayPort,
  StoreCreditGrantResult,
} from "../../application/ports/store-credit-gateway.port.js";

/** Mesmo padrão de HttpClubGateway — apiKey de terminal lida do StoreIdentity local a cada chamada. */
@Injectable()
export class HttpStoreCreditGateway implements StoreCreditGatewayPort {
  private readonly baseUrl: string;

  constructor(
    configService: ConfigService,
    @Inject(STORE_IDENTITY_REPOSITORY) private readonly storeIdentityRepository: StoreIdentityRepositoryPort,
  ) {
    this.baseUrl = configService.get<string>("INTERMEDIADOR_URL") ?? "http://127.0.0.1:4002";
  }

  async getBalance(document: string): Promise<number | null> {
    const identity = await this.storeIdentityRepository.find();
    if (!identity) {
      return null;
    }
    const response = await fetch(`${this.baseUrl}/store-credit/balance/${encodeURIComponent(document)}`, {
      headers: { "X-Terminal-Api-Key": identity.apiKey },
    });
    if (!response.ok) {
      return null;
    }
    const body = (await response.json()) as { balance: number };
    return body.balance;
  }

  async grant(input: GrantStoreCreditInput): Promise<StoreCreditGrantResult> {
    const identity = await this.storeIdentityRepository.find();
    if (!identity) {
      throw new Error("Terminal não ativado — sem identidade de loja pra gerar vale-troca.");
    }
    const response = await fetch(`${this.baseUrl}/store-credit/grants`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Terminal-Api-Key": identity.apiKey },
      body: JSON.stringify(input),
    });
    if (!response.ok) {
      // 409 aqui (desconto excede a linha) não deveria acontecer na prática —
      // GrantStoreCreditUseCase já valida o mesmo antes de chamar o gateway,
      // com preço resolvido no servidor. Se ainda assim o Intermediador
      // recusar, repassa a mensagem dele em vez de um "500 genérico" opaco —
      // defesa em profundidade, não o caminho esperado.
      //
      // 400 (falha de validação do ZodValidationPipe) NÃO tem `message` no
      // corpo — vem como `{fieldErrors, formErrors}` (achado real, 2026-09-11:
      // um telefone vazio virando 400 gerava só "Intermediador respondeu 400",
      // sem dizer QUAL campo, e o pdv-backend ainda embrulhava isso num 500
      // opaco pro operador — nada logado dava pra diagnosticar sem reproduzir
      // a chamada manualmente). describeHttpError extrai fieldErrors quando
      // message não vem.
      throw new Error(await describeHttpError(response, "POST /store-credit/grants"));
    }
    return (await response.json()) as StoreCreditGrantResult;
  }

  async redeem(input: RedeemStoreCreditInput): Promise<{ balance: number }> {
    const identity = await this.storeIdentityRepository.find();
    if (!identity) {
      throw new Error("Terminal não ativado — sem identidade de loja pra resgatar vale-troca.");
    }
    const response = await fetch(`${this.baseUrl}/store-credit/redemptions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Terminal-Api-Key": identity.apiKey },
      body: JSON.stringify(input),
    });
    if (response.status === 409) {
      throw new InsufficientStoreCreditError(input.document);
    }
    if (!response.ok) {
      throw new Error(await describeHttpError(response, "POST /store-credit/redemptions"));
    }
    return (await response.json()) as { balance: number };
  }
}

/**
 * Corpo de erro do Intermediador pode vir de dois jeitos: um DomainError
 * mapeado (`{message}`, ver DomainExceptionFilter) ou uma falha do
 * ZodValidationPipe (`{fieldErrors, formErrors}`, sem `message` nenhum — ver
 * zod-validation.pipe.ts). Sem tratar o segundo caso, a mensagem que sobe
 * pro operador (e pro log, quando o pdv-backend não sabe mapear o erro e cai
 * pra 500 opaco) é só "Intermediador respondeu 400", sem dizer qual campo.
 */
async function describeHttpError(response: Response, requestLabel: string): Promise<string> {
  const body = (await response.json().catch(() => null)) as
    | { message?: string; fieldErrors?: Record<string, string[]>; formErrors?: string[] }
    | null;
  if (body?.message) {
    return body.message;
  }
  const fieldIssues = body?.fieldErrors
    ? Object.entries(body.fieldErrors)
        .map(([field, issues]) => `${field}: ${issues.join(", ")}`)
        .join("; ")
    : "";
  if (fieldIssues || body?.formErrors?.length) {
    return [fieldIssues, ...(body?.formErrors ?? [])].filter(Boolean).join("; ");
  }
  return `Intermediador respondeu ${response.status} para ${requestLabel}`;
}
