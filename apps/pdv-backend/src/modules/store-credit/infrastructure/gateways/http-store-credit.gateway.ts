import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DEFAULT_INTERMEDIADOR_TIMEOUT_MS, getIntermediadorUrl } from "../../../../common/intermediador-config.js";
import {
  STORE_IDENTITY_REPOSITORY,
  type StoreIdentityRepositoryPort,
} from "../../../provisioning/application/ports/store-identity-repository.port.js";
import { throwDescriptiveHttpError } from "../../../../common/describe-http-error.js";
import { InsufficientStoreCreditError } from "../../domain/errors.js";
import type {
  AdjustStoreCreditInput,
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
    this.baseUrl = getIntermediadorUrl(configService);
  }

  async getBalance(document: string): Promise<number | null> {
    const identity = await this.storeIdentityRepository.find();
    if (!identity) {
      return null;
    }
    const response = await fetch(`${this.baseUrl}/store-credit/balance/${encodeURIComponent(document)}`, {
      headers: { "X-Terminal-Api-Key": identity.apiKey },
      signal: AbortSignal.timeout(DEFAULT_INTERMEDIADOR_TIMEOUT_MS),
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
      signal: AbortSignal.timeout(DEFAULT_INTERMEDIADOR_TIMEOUT_MS),
    });
    if (!response.ok) {
      // 409 aqui (desconto excede a linha) não deveria acontecer na prática —
      // GrantStoreCreditUseCase já valida o mesmo antes de chamar o gateway,
      // com preço resolvido no servidor. Se ainda assim o Intermediador
      // recusar, repassa a mensagem dele em vez de um 500 opaco — defesa em
      // profundidade, não o caminho esperado. throwDescriptiveHttpError lança
      // HttpException (não Error simples) pra mensagem sobreviver ao
      // DomainExceptionFilter e chegar de verdade na tela do operador —
      // achado real 2026-09-14: o fix de 2026-09-11 só melhorou o log
      // server-side, o "Internal Server Error" pro operador continuava igual.
      await throwDescriptiveHttpError(response, "POST /store-credit/grants");
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
      signal: AbortSignal.timeout(DEFAULT_INTERMEDIADOR_TIMEOUT_MS),
    });
    if (response.status === 409) {
      throw new InsufficientStoreCreditError(input.document);
    }
    if (!response.ok) {
      await throwDescriptiveHttpError(response, "POST /store-credit/redemptions");
    }
    return (await response.json()) as { balance: number };
  }

  async adjust(input: AdjustStoreCreditInput): Promise<{ balance: number }> {
    const identity = await this.storeIdentityRepository.find();
    if (!identity) {
      throw new Error("Terminal não ativado — sem identidade de loja pra ajustar vale-troca.");
    }
    const response = await fetch(`${this.baseUrl}/store-credit/adjustments`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Terminal-Api-Key": identity.apiKey },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(DEFAULT_INTERMEDIADOR_TIMEOUT_MS),
    });
    if (response.status === 409) {
      throw new InsufficientStoreCreditError(input.document);
    }
    if (!response.ok) {
      await throwDescriptiveHttpError(response, "POST /store-credit/adjustments");
    }
    return (await response.json()) as { balance: number };
  }
}
